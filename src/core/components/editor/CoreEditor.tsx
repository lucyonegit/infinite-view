import { useRef, useCallback, useState, useEffect, useImperativeHandle } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useEngineInstance } from '../../react/context/useEngineInstance';
import { useEditorEngine } from '../../react/hooks/useEditorEngine';
import { InternalToolbar } from './parts/InternalToolbar';
import { InternalFloatingToolbar } from './parts/InternalFloatingToolbar';
import { BaseRender, MoveableManager, SelectoManager, useSelectionBoundingBox } from '../rendering';
import { exportSelectedFrameAsImage } from '../../../utils/exportUtils';
import { useCoordinateSystem } from '../../react/hooks/useCoordinateSystem';
import type { Element, EditorDataExport } from '../../engine/types';
import type { EditorAPI } from './EditorAPI';
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

  // 4. 数据变化通知 (防抖)
  useEffect(() => {
    if (!onDataChange) return;
    const timer = setTimeout(() => {
      onDataChange(engine.exportData());
    }, 500);
    return () => clearTimeout(timer);
  }, [elements, viewport, onDataChange, engine]);

  // 5. 初始数据导入
  useEffect(() => {
    if (initialData) {
      engine.importData(initialData);
    }
  }, [initialData, engine]);

  // 6. 手势处理 (形状创建)
  useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      requestAnimationFrame(() => {
        setCreatingPreview(null);
      });
      return;
    }

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const viewer = viewerRef.current;
      if (!viewer) return;
      const container = viewer.getContainer();
      const rect = container.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      if (interaction.isCreating) return;
      
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      engine.startCreating(activeTool === 'text' ? 'text' : activeTool === 'frame' ? 'frame' : 'rectangle', worldPoint);
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!interaction.isCreating || !interaction.startPoint) return;
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      const x = Math.min(interaction.startPoint.x, worldPoint.x);
      const y = Math.min(interaction.startPoint.y, worldPoint.y);
      const width = Math.abs(worldPoint.x - interaction.startPoint.x);
      const height = Math.abs(worldPoint.y - interaction.startPoint.y);
      setCreatingPreview({ x, y, width, height });
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (!interaction.isCreating || !interaction.startPoint) return;
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      engine.finishCreating(worldPoint);
      setCreatingPreview(null);
    };

    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeTool, interaction.isCreating, interaction.startPoint, screenToWorld, engine]);

  // 7. 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if (selectedIds.length > 0) {
        if (e.key === '[' || e.key === '［') {
          engine.reorderElements(selectedIds, e.altKey ? 'back' : 'backward');
        } else if (e.key === ']' || e.key === '］') {
          engine.reorderElements(selectedIds, e.altKey ? 'front' : 'forward');
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          engine.deleteElements(selectedIds);
        } else if (e.key === 'Escape') {
          engine.deselectAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, engine]);

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
