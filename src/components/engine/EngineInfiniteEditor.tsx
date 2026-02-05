import { useRef, useCallback, useState, useEffect } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useEngineInstance } from '../../core/react/EditorProvider';
import { useEditorEngine, useEditorEngineShallow } from '../../core/react/useEditorEngine';
import { EngineToolbar } from './EngineToolbar';
import { EngineFloatingToolbar } from './EngineFloatingToolbar';
import { BaseRender, MoveableManager, SelectoManager } from '../../core/react/components';
import { exportSelectedFrameAsImage } from '../../utils/exportUtils';
import { useCoordinateSystem } from '../../core/react/hooks/useCoordinateSystem';
import type { Point, Bounds, Element, Viewport } from '../../core/types';
import './EngineInfiniteEditor.css';

/**
 * EngineInfiniteEditor - 基于 EditorEngine 的无限视口编辑器
 */
export function EngineInfiniteEditor() {
  const viewerRef = useRef<InfiniteViewer>(null);
  const engine = useEngineInstance();
  
  const [creatingPreview, setCreatingPreview] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(1);

  // 1. 订阅核心状态
  const activeTool = useEditorEngine(engine, s => s.activeTool);
  const elements = useEditorEngine(engine, s => s.elements);
  const selectedIds = useEditorEngine(engine, s => s.selectedIds);
  const interaction = useEditorEngine(engine, s => s.interaction);
  const viewport = useEditorEngine(engine, s => s.viewport);

  // 2. 坐标转换逻辑 (保持现状，它们是纯 UI 逻辑)
  const screenToWorld = useCallback((clientX: number, clientY: number): Point => {
    const viewer = viewerRef.current;
    if (!viewer) return { x: clientX, y: clientY };
    const container = viewer.getContainer();
    const rect = container.getBoundingClientRect();
    const scrollLeft = viewer.getScrollLeft();
    const scrollTop = viewer.getScrollTop();
    const currentZoom = viewer.getZoom();
    return {
      x: (clientX - rect.left) / currentZoom + scrollLeft,
      y: (clientY - rect.top) / currentZoom + scrollTop,
    };
  }, []);


  // 3. 选区包围盒计算 (使用浅比较，因为返回的是新对象)
  const selectionBoundingBox = useEditorEngineShallow(engine, s => {
    const { selectedIds, elements } = s;
    if (selectedIds.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const worldPos = engine.getElementWorldPos(id);
        minX = Math.min(minX, worldPos.x);
        minY = Math.min(minY, worldPos.y);
        maxX = Math.max(maxX, worldPos.x + el.width);
        maxY = Math.max(maxY, worldPos.y + el.height);
      }
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, centerX: minX + (maxX - minX) / 2 };
  });

  // 4. 形状创建手势
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

  // 5. 键盘快捷键
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

  // 6. Viewer 控制
  const handleScroll = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      engine.setViewport({ x: -viewer.getScrollLeft(), y: -viewer.getScrollTop(), zoom: viewer.getZoom() });
    }
  }, [engine]);

  const handleZoom = useCallback((delta: number) => {
    const viewer = viewerRef.current;
    if (viewer) {
      const newZoom = Math.min(Math.max(zoom + delta, 0.1), 5);
      viewer.setZoom(newZoom);
      setZoom(newZoom);
    }
  }, [zoom]);

  const handleResetView = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      viewer.setZoom(1);
      viewer.scrollCenter();
      setZoom(1);
    }
  }, []);

  const useMouseDrag = activeTool === 'hand';

  return (
    <div className="infinite-editor">
      <header className="editor-header">
        <div className="editor-header-left">
          <span className="editor-logo">🚀</span>
          <span className="editor-title">Engine Editor</span>
        </div>
        <div className="editor-header-center">
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => handleZoom(-0.1)}>−</button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => handleZoom(0.1)}>+</button>
            <button className="zoom-btn" onClick={handleResetView} title="Reset">⟲</button>
          </div>
        </div>
        <div className="editor-header-right">
          {selectedIds.length === 1 && ['frame', 'text'].includes(elements.find(el => el.id === selectedIds[0])?.type || '') && (
            <button className="export-btn" onClick={() => exportSelectedFrameAsImage(selectedIds[0], elements)}>💾 导出图片</button>
          )}
          <button className="back-btn" onClick={() => window.location.href = "/"}>← Home</button>
        </div>
      </header>
      
      <EngineToolbar />
      
      <InfiniteViewer
        ref={viewerRef}
        className={`editor-viewer ${activeTool === 'hand' ? 'tool-hand' : `tool-${activeTool}`}`}
        zoom={zoom}
        useMouseDrag={useMouseDrag}
        useWheelScroll={true}
        useAutoZoom={true}
        usePinch={true}
        zoomRange={[0.1, 5]}
        onScroll={handleScroll}
        onPinch={(e) => setZoom(e.zoom)}
      >
        <div className="editor-viewport">
          <div className="grid-background" />
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

      <EngineFloatingToolbarWrapper 
        selectionBoundingBox={selectionBoundingBox}
        selectedIds={selectedIds}
        elements={elements}
        zoom={zoom}
        viewport={interaction.isPanning ? interaction.startPoint ? { x: -interaction.startPoint.x, y: -interaction.startPoint.y } : viewport : viewport} // 简化逻辑
      />

      {activeTool === 'select' && <SelectoManager />}

      <div className="editor-statusbar">
        <span className="status-item"><span className="status-label">Zoom:</span>{Math.round(zoom * 100)}%</span>
        <span className="status-item"><span className="status-label">Elements:</span>{elements.length}</span>
        {selectedIds.length > 0 && <span className="status-item"><span className="status-label">Selected:</span>{selectedIds.length}</span>}
      </div>
    </div>
  );
}

/**
 * 包装组件，用于安全地处理坐标转换并渲染工具栏
 */
function EngineFloatingToolbarWrapper({ 
  selectionBoundingBox, 
  selectedIds, 
  elements, 
  zoom, 
  viewport 
}: { 
  selectionBoundingBox: { centerX: number; y: number } | null; 
  selectedIds: string[]; 
  elements: Element[]; 
  zoom: number; 
  viewport: Viewport;
}) {
  const { worldToScreen } = useCoordinateSystem(zoom, viewport.x, viewport.y);
  
  if (!selectionBoundingBox) return null;

  const screenPos = worldToScreen(selectionBoundingBox.centerX, selectionBoundingBox.y);
  const selectedElement = selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0]) : undefined;

  return (
    <EngineFloatingToolbar 
      x={screenPos.x} 
      y={screenPos.y}
      element={selectedElement}
      onExport={() => {
        if (selectedIds.length === 1) {
          const el = elements.find(e => e.id === selectedIds[0]);
          if (el?.type === 'frame' || el?.type === 'text') {
            exportSelectedFrameAsImage(selectedIds[0], elements);
            return;
          }
        }
        alert('目前仅支持导出 Frame 和 Text 元素');
      }}
    />
  );
}

export default EngineInfiniteEditor;
