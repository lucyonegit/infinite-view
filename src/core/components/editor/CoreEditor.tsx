import { useRef, useCallback, useState, useImperativeHandle } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useEngineInstance } from '../../react/context/useEngineInstance';
import { useEditorEngine } from '../../react/hooks/useEditorEngine';
import { InternalToolbar } from './parts/InternalToolbar';
import { InternalFloatingToolbar } from './parts/InternalFloatingToolbar';
import { BaseRender, MoveableManager, SelectoManager, useSelectionBoundingBox } from '../rendering';
import { exportSelectedFrameAsImage } from '../../../utils/exportUtils';
import { useCoordinateSystem } from '../../react/hooks/useCoordinateSystem';
import type { Element, EditorDataExport } from '../../engine';
import type { EditorAPI } from './EditorAPI';
import { useCreatingGesture } from './hooks/useCreatingGesture';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDataSync } from './hooks/useDataSync';
import './CoreEditor.css';


export interface CoreEditorProps {
  /** 初始数据 */
  initialData?: EditorDataExport;
  /** 控制 API */
  apiRef?: React.RefObject<EditorAPI | null>;
  /** 插槽 */
  slots?: {
    toolbarExtra?: React.ReactNode;
    floatingToolbarExtra?: (element?: Element) => React.ReactNode;
  };
  /** 数据变化回调 */
  onDataChange?: (data: EditorDataExport) => void;
}

/**
 * CoreEditor - 统一的核心编辑器组件
 */
export function CoreEditor({ 
  initialData, 
  apiRef, 
  slots,
  onDataChange 
}: CoreEditorProps) {
  const viewerRef = useRef<InfiniteViewer>(null);
  const engine = useEngineInstance();
  
  const [creatingPreview, setCreatingPreview] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  // 1. 订阅状态
  const activeTool = useEditorEngine(engine, s => s.activeTool);
  const elements = useEditorEngine(engine, s => s.elements);
  const selectedIds = useEditorEngine(engine, s => s.selectedIds);
  const interaction = useEditorEngine(engine, s => s.interaction);
  const viewport = useEditorEngine(engine, s => s.viewport);

  // 2. 坐标系统
  const { screenToWorld, worldToScreen } = useCoordinateSystem(zoom, viewport.x, viewport.y);

  // 3. 暴露 API
  useImperativeHandle(apiRef, () => ({
    addElement: (el) => engine.addElement(el),
    updateElement: (id, updates) => engine.updateElement(id, updates),
    deleteSelected: () => engine.deleteElements(selectedIds),
    getElements: () => engine.getState().elements,
    getSelectedElements: () => engine.getState().elements.filter(el => selectedIds.includes(el.id)),
    setZoom: (z) => {
      viewerRef.current?.setZoom(z);
      setZoom(z);
    },
    centerElement: (id) => {
      const el = elements.find(e => e.id === id);
      if (el) {
        viewerRef.current?.scrollCenter();
        // 这里简化了，实际可能需要更复杂的计算来滑动到指定位置
      }
    },
    resetView: () => {
      engine.resetViewport();
      viewerRef.current?.setZoom(1);
      viewerRef.current?.scrollCenter();
      setZoom(1);
    },
    exportSelectionAsImage: async () => {
      if (selectedIds.length === 1) {
        await exportSelectedFrameAsImage(selectedIds[0], elements);
        return 'success'; // Returning a dummy string to satisfy the current EditorAPI interface
      }
      return null;
    },
    importData: (data) => engine.importData(data),
    getEngine: () => engine,
  }), [engine, selectedIds, elements]);

  // 4. Data change & Initial Import
  useDataSync({ engine, elements, viewport, initialData, onDataChange });

  // 5. Creating Gesture
  useCreatingGesture({ engine, activeTool, interaction, screenToWorld, viewerRef, setCreatingPreview });

  // 6. Keyboard Shortcuts
  useKeyboardShortcuts({ engine, selectedIds });

  // 8. 选区包围盒
  const selectionBoundingBox = useSelectionBoundingBox();

  const handleScroll = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      engine.setViewport({ x: -viewer.getScrollLeft(), y: -viewer.getScrollTop(), zoom: viewer.getZoom() });
    }
  }, [engine]);

  return (
    <div className="infinite-editor">
      <InternalToolbar extra={slots?.toolbarExtra} />
      
      <InfiniteViewer
        ref={viewerRef}
        className={`editor-viewer ${activeTool === 'hand' ? 'tool-hand' : `tool-${activeTool}`}`}
        zoom={zoom}
        useMouseDrag={activeTool === 'hand'}
        useWheelScroll={true}
        useAutoZoom={true}
        usePinch={true}
        zoomRange={[0.1, 5]}
        onScroll={handleScroll}
        onPinch={(e) => setZoom(e.zoom)}
      >
        <div className="editor-viewport">
          <div className="grid-background" style={{ '--zoom': zoom } as React.CSSProperties} />
          <div className="elements-layer">
            {elements.filter(el => !el.parentId).map((element) => (
              <BaseRender key={element.id} element={element} />
            ))}
          </div>
          {creatingPreview && (
            <div className="creating-preview" style={{ left: creatingPreview.x, top: creatingPreview.y, width: creatingPreview.width, height: creatingPreview.height }} />
          )}

          {activeTool === 'select' && (
            <MoveableManager zoom={zoom} />
          )}
        </div>
      </InfiniteViewer>

      {!interaction.isInteracting && selectionBoundingBox && (() => {
        const screenPos = worldToScreen(selectionBoundingBox.centerX, selectionBoundingBox.y);
        const selectedElement = selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0]) : undefined;
        return (
          <InternalFloatingToolbar 
            x={screenPos.x} 
            y={screenPos.y}
            element={selectedElement}
            onExport={() => exportSelectedFrameAsImage(selectedIds[0], elements)}
            extra={slots?.floatingToolbarExtra?.(selectedElement)}
          />
        );
      })()}

      {activeTool === 'select' && <SelectoManager />}
    </div>
  );
}
