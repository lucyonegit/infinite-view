import { useRef, useCallback, useState, useEffect } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useEditorStore } from '../store/editorStore';
import { Toolbar } from './Toolbar';
import { ElementRenderer } from './ElementRenderer';
import { MoveableManager } from './MoveableManager';
import { SelectoManager } from './SelectoManager';
import { FloatingToolbar } from './FloatingToolbar';
import { exportSelectedFrameAsImage } from '../utils/exportUtils';
import type { Point, Bounds } from '../types/editor';
import './InfiniteEditor.css';

interface InfiniteEditorProps {
  onBack?: () => void;
}

/**
 * 无限视口编辑器主组件
 * 使用 react-infinite-viewer 实现无限视口
 */
export function InfiniteEditor({ onBack }: InfiniteEditorProps) {
  const viewerRef = useRef<InfiniteViewer>(null);
  const [creatingPreview, setCreatingPreview] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(1);

  const {
    activeTool,
    elements,
    selectedIds,
    interaction,
    startCreating,
    finishCreating,
    setViewport,
    reorderElements,
    deleteElements,
    deselectAll,
  } = useEditorStore();

  // ============ 坐标转换 ============

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

  // 世界坐标转屏幕坐标 (用于定位不随 zoom 缩放的 UI)
  const worldToScreen = useCallback((worldX: number, worldY: number): Point => {
    const viewer = viewerRef.current;
    if (!viewer) return { x: worldX, y: worldY };

    const container = viewer.getContainer();
    const rect = container.getBoundingClientRect();
    const scrollLeft = viewer.getScrollLeft();
    const scrollTop = viewer.getScrollTop();
    const currentZoom = viewer.getZoom();

    return {
      x: (worldX - scrollLeft) * currentZoom + rect.left,
      y: (worldY - scrollTop) * currentZoom + rect.top,
    };
  }, []);

  // ============ 选区计算 ============

  // 计算选中元素的包围盒 (用于定位工具条)
  const selectionBoundingBox = (() => {
    if (selectedIds.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 获取所有选中元素的世界坐标
    const { getElementWorldPos } = useEditorStore.getState();

    selectedIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const worldPos = getElementWorldPos(id);
        minX = Math.min(minX, worldPos.x);
        minY = Math.min(minY, worldPos.y);
        maxX = Math.max(maxX, worldPos.x + el.width);
        maxY = Math.max(maxY, worldPos.y + el.height);
      }
    });

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: minX + (maxX - minX) / 2,
    };
  })();

  // ============ 形状创建 (Window 级别事件保证丝滑) ============

  useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      setCreatingPreview(null);
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
      startCreating(
        activeTool === 'text' ? 'text' : activeTool === 'frame' ? 'frame' : 'rectangle',
        worldPoint
      );
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
      if (!interaction.isCreating) return;
      
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      finishCreating(worldPoint);
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
  }, [activeTool, interaction.isCreating, interaction.startPoint, screenToWorld, finishCreating, startCreating]);

  // ============ 键盘快捷键 ============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (selectedIds.length > 0) {
        if (e.key === '[' || e.key === '［') {
          reorderElements(selectedIds, e.altKey ? 'back' : 'backward');
        } else if (e.key === ']' || e.key === '］') {
          reorderElements(selectedIds, e.altKey ? 'front' : 'forward');
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          deleteElements(selectedIds);
        } else if (e.key === 'Escape') {
          deselectAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, reorderElements, deleteElements, deselectAll]);

  // ============ InfiniteViewer 事件 ============

  const handleScroll = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) {
      setViewport({
        x: -viewer.getScrollLeft(),
        y: -viewer.getScrollTop(),
        zoom: viewer.getZoom(),
      });
    }
  }, [setViewport]);

  const handlePinch = useCallback((e: { zoom: number }) => {
    setZoom(e.zoom);
  }, []);

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

  // ============ 渲染 ============

  const useMouseDrag = activeTool === 'hand';

  return (
    <div className="infinite-editor">
      <header className="editor-header">
        <div className="editor-header-left">
          <span className="editor-logo">🎨</span>
          <span className="editor-title">Canvas Editor</span>
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
          {selectedIds.length === 1 && elements.find(el => el.id === selectedIds[0])?.type === 'frame' && (
            <button className="export-btn" onClick={() => exportSelectedFrameAsImage(selectedIds[0], elements)}>💾 导出图片</button>
          )}
          {onBack && <button className="back-btn" onClick={onBack}>← Back</button>}
        </div>
      </header>
      <Toolbar />
      <InfiniteViewer
        ref={viewerRef}
        className={`editor-viewer ${activeTool === 'hand' ? 'tool-hand' : `tool-${activeTool}`}`}
        zoom={zoom}
        useMouseDrag={useMouseDrag}
        useWheelScroll={true}
        useAutoZoom={true}
        usePinch={true}
        pinchThreshold={0}
        zoomRange={[0.1, 5]}
        onScroll={handleScroll}
        onPinch={handlePinch}
      >
        <div className="editor-viewport">
          <div className="grid-background" />
          <div className="elements-layer">
            {elements.filter(el => !el.parentId).map((element) => (
              <ElementRenderer key={element.id} element={element} isSelected={selectedIds.includes(element.id)} zoom={zoom} />
            ))}
          </div>
          {creatingPreview && (
            <div className="creating-preview" style={{ left: creatingPreview.x, top: creatingPreview.y, width: creatingPreview.width, height: creatingPreview.height }} />
          )}

          {/* MoveableManager 放在视口内，这样它的 UI 也会随着视口变换 */}
          {activeTool === 'select' && (
            <MoveableManager 
              zoom={zoom} 
              elements={elements} 
              selectedIds={selectedIds} 
            />
          )}
        </div>
      </InfiniteViewer>

      {/* 浮动工具栏 - 放在 InfiniteViewer 外部，不随 zoom 缩放 */}
      {selectionBoundingBox && (() => {
        const screenPos = worldToScreen(selectionBoundingBox.centerX, selectionBoundingBox.y);
        return (
          <FloatingToolbar 
            x={screenPos.x} 
            y={screenPos.y}
            onExport={() => {
              // 如果只选中了一个 Frame，则导出该 Frame
              if (selectedIds.length === 1) {
                const el = elements.find(e => e.id === selectedIds[0]);
                if (el?.type === 'frame') {
                  exportSelectedFrameAsImage(selectedIds[0], elements);
                  return;
                }
              }
              alert('目前仅支持导出 Frame 元素');
            }}
          />
        );
      })()}

      {/* SelectoManager 放在视口外，捕捉整个视口容器的事件 */}
      {activeTool === 'select' && (
        <SelectoManager />
      )}

      <div className="editor-statusbar">
        <span className="status-item"><span className="status-label">Zoom:</span>{Math.round(zoom * 100)}%</span>
        <span className="status-item"><span className="status-label">Elements:</span>{elements.length}</span>
        {selectedIds.length > 0 && <span className="status-item"><span className="status-label">Selected:</span>{selectedIds.length}</span>}
      </div>
    </div>
  );
}

export default InfiniteEditor;
