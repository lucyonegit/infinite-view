import { useRef, useCallback, useState } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useCanvasStore } from '../store/canvasStore';
import { Toolbar } from './Toolbar';
import { ElementRenderer } from './ElementRenderer';
import { exportSelectedFrameAsImage } from '../utils/exportUtils';
import type { Point, Bounds } from '../types/canvas';
import './InfiniteCanvasEditor.css';

interface InfiniteCanvasEditorProps {
  onBack?: () => void;
}

/**
 * 无限画布编辑器主组件
 * 使用 react-infinite-viewer 实现无限画布
 */
export function InfiniteCanvasEditor({ onBack }: InfiniteCanvasEditorProps) {
  const viewerRef = useRef<InfiniteViewer>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [creatingPreview, setCreatingPreview] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(1);

  const {
    activeTool,
    elements,
    selectedIds,
    interaction,
    selectElements,
    deselectAll,
    moveElements,
    startDragging,
    stopDragging,
    startMarqueeSelect,
    updateMarqueeSelect,
    finishMarqueeSelect,
    startCreating,
    finishCreating,
    setInteraction,
    resizeElement,
    setViewport,
    addToFrame,
    removeFromFrame,
    findFrameAtPoint,
    setHoverFrame,
    hoverFrameId,
  } = useCanvasStore();

  // ============ 坐标转换 ============

  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    const viewer = viewerRef.current;
    if (!viewer) return { x: screenX, y: screenY };

    const scrollLeft = viewer.getScrollLeft();
    const scrollTop = viewer.getScrollTop();
    const currentZoom = viewer.getZoom();

    return {
      x: (screenX + scrollLeft) / currentZoom,
      y: (screenY + scrollTop) / currentZoom,
    };
  }, []);

  // ============ 缩放处理 ============

  const handleResize = useCallback((canvasPoint: Point) => {
    if (selectedIds.length !== 1 || !interaction.resizeHandle) return;
    
    const element = elements.find(el => el.id === selectedIds[0]);
    if (!element) return;

    const handle = interaction.resizeHandle;
    const newBounds = { x: element.x, y: element.y, width: element.width, height: element.height };

    switch (handle) {
      case 'nw':
        newBounds.width = element.x + element.width - canvasPoint.x;
        newBounds.height = element.y + element.height - canvasPoint.y;
        newBounds.x = canvasPoint.x;
        newBounds.y = canvasPoint.y;
        break;
      case 'ne':
        newBounds.width = canvasPoint.x - element.x;
        newBounds.height = element.y + element.height - canvasPoint.y;
        newBounds.y = canvasPoint.y;
        break;
      case 'sw':
        newBounds.width = element.x + element.width - canvasPoint.x;
        newBounds.height = canvasPoint.y - element.y;
        newBounds.x = canvasPoint.x;
        break;
      case 'se':
        newBounds.width = canvasPoint.x - element.x;
        newBounds.height = canvasPoint.y - element.y;
        break;
      case 'n':
        newBounds.height = element.y + element.height - canvasPoint.y;
        newBounds.y = canvasPoint.y;
        break;
      case 's':
        newBounds.height = canvasPoint.y - element.y;
        break;
      case 'w':
        newBounds.width = element.x + element.width - canvasPoint.x;
        newBounds.x = canvasPoint.x;
        break;
      case 'e':
        newBounds.width = canvasPoint.x - element.x;
        break;
    }

    if (newBounds.width >= 20 && newBounds.height >= 20) {
      resizeElement(selectedIds[0], newBounds);
    }
  }, [selectedIds, elements, interaction.resizeHandle, resizeElement]);

  // ============ 鼠标事件处理 ============

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = screenToCanvas(screenX, screenY);

    // 检查是否点击到元素
    const clickedElement = (e.target as HTMLElement).closest('[data-element-id]');
    const clickedElementId = clickedElement?.getAttribute('data-element-id');

    // Hand 工具由 InfiniteViewer 自动处理
    if (activeTool === 'hand') return;

    switch (activeTool) {
      case 'select':
        if (clickedElementId) {
          if (!selectedIds.includes(clickedElementId)) {
            selectElements([clickedElementId], e.shiftKey);
          }
          startDragging(canvasPoint);
        } else {
          if (!e.shiftKey) {
            deselectAll();
          }
          startMarqueeSelect(canvasPoint);
        }
        break;

      case 'rectangle':
      case 'text':
      case 'frame':
        startCreating(
          activeTool === 'text' ? 'text' : activeTool === 'frame' ? 'frame' : 'rectangle',
          canvasPoint
        );
        break;
    }
  }, [activeTool, selectedIds, screenToCanvas, selectElements, deselectAll, startDragging, startMarqueeSelect, startCreating]);

  const handleViewportMouseMove = useCallback((e: React.MouseEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = screenToCanvas(screenX, screenY);

    if (interaction.isDragging && interaction.startPoint) {
      const deltaX = canvasPoint.x - interaction.startPoint.x;
      const deltaY = canvasPoint.y - interaction.startPoint.y;
      moveElements(selectedIds, deltaX, deltaY);
      setInteraction({ startPoint: canvasPoint });

      // 实时计算是否进入了某个 Frame
      if (selectedIds.length > 0) {
        // 取第一个选中元素作为基准进行检测 (通常是一次拖动一个元素进入 Frame)
        const id = selectedIds[0];
        const element = elements.find(el => el.id === id);
        
        if (element && element.type !== 'frame') {
          // 使用鼠标当前坐标进行检测，或者使用元素中心点
          // 根据需求 "鼠标进入frame" -> 用 canvasPoint
          const targetFrame = findFrameAtPoint(canvasPoint.x, canvasPoint.y, selectedIds);
          
          if (targetFrame) {
            if (hoverFrameId !== targetFrame.id) {
              setHoverFrame(targetFrame.id);
              // 立即执行放入逻辑
              addToFrame(id, targetFrame.id);
            }
          } else {
            if (hoverFrameId) {
              setHoverFrame(null);
            }
            // 如果已经在某个 Frame 中（即 parentId 存在），且鼠标移出了所有 Frame
            if (element.parentId) {
              removeFromFrame(id);
            }
          }
        }
      }
    } else if (interaction.isMarqueeSelecting) {
      updateMarqueeSelect(canvasPoint);
    } else if (interaction.isCreating && interaction.startPoint) {
      const x = Math.min(interaction.startPoint.x, canvasPoint.x);
      const y = Math.min(interaction.startPoint.y, canvasPoint.y);
      const width = Math.abs(canvasPoint.x - interaction.startPoint.x);
      const height = Math.abs(canvasPoint.y - interaction.startPoint.y);
      setCreatingPreview({ x, y, width, height });
    } else if (interaction.isResizing && interaction.startPoint && interaction.resizeHandle) {
      handleResize(canvasPoint);
    }
  }, [interaction, screenToCanvas, moveElements, selectedIds, updateMarqueeSelect, setInteraction, handleResize, elements, findFrameAtPoint, hoverFrameId, setHoverFrame, addToFrame, removeFromFrame]);

  const handleViewportMouseUp = useCallback((e: React.MouseEvent) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = screenToCanvas(screenX, screenY);

    if (interaction.isDragging) {
      // 停止拖拽时重置 hover 状态
      setHoverFrame(null);
      stopDragging();
    } else if (interaction.isMarqueeSelecting) {
      finishMarqueeSelect();
    } else if (interaction.isCreating) {
      finishCreating(canvasPoint);
      setCreatingPreview(null);
    } else if (interaction.isResizing) {
      setInteraction({ isResizing: false, resizeHandle: undefined, startPoint: undefined });
    }
  }, [interaction, screenToCanvas, stopDragging, finishMarqueeSelect, finishCreating, setInteraction, setHoverFrame]);

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

  // ============ 计算组合选择框 ============

  const groupSelectionBounds = useCallback((): Bounds | null => {
    if (selectedIds.length <= 1) return null;

    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    if (selectedElements.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const el of selectedElements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [elements, selectedIds]);

  // ============ 渲染 ============

  const groupBounds = groupSelectionBounds();

  // 根据工具决定 InfiniteViewer 的交互模式
  const useMouseDrag = activeTool === 'hand';

  return (
    <div className="infinite-canvas-editor">
      {/* 头部 */}
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
          {/* 导出按钮 - 只有选中单个 Frame 时显示 */}
          {selectedIds.length === 1 && elements.find(el => el.id === selectedIds[0])?.type === 'frame' && (
            <button 
              className="export-btn"
              onClick={() => exportSelectedFrameAsImage(selectedIds[0], elements)}
            >
              💾 导出图片
            </button>
          )}
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
      </header>

      {/* 工具栏 */}
      <Toolbar />

      {/* InfiniteViewer 画布 */}
      <InfiniteViewer
        ref={viewerRef}
        className={`canvas-viewer ${activeTool === 'hand' ? 'tool-hand' : `tool-${activeTool}`}`}
        zoom={zoom}
        useMouseDrag={useMouseDrag}
        useWheelScroll={true}
        useAutoZoom={true}
        usePinch={true}
        pinchThreshold={0}
        zoomRange={[0.1, 5]}
        rangeX={[-2000, 2000]}
        rangeY={[-2000, 2000]}
        onScroll={handleScroll}
        onPinch={handlePinch}
      >
        <div
          ref={viewportRef}
          className="canvas-viewport"
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={handleViewportMouseUp}
          onMouseLeave={handleViewportMouseUp}
        >
          {/* 网格背景 */}
          <div className="canvas-grid-bg" />

          {/* 元素层 */}
          <div className="canvas-elements-layer">
            {elements
              .filter(el => !el.parentId) // 只在该层级渲染顶层元素
              .map((element) => (
                <ElementRenderer
                  key={element.id}
                  element={element}
                  isSelected={selectedIds.includes(element.id)}
                  zoom={zoom}
                />
              ))}
          </div>

          {/* 创建预览 */}
          {creatingPreview && (
            <div
              className="creating-preview"
              style={{
                left: creatingPreview.x,
                top: creatingPreview.y,
                width: creatingPreview.width,
                height: creatingPreview.height,
              }}
            />
          )}

          {/* 组合选择框 */}
          {groupBounds && (
            <div
              className="group-selection-box"
              style={{
                left: groupBounds.x,
                top: groupBounds.y,
                width: groupBounds.width,
                height: groupBounds.height,
              }}
            />
          )}

          {/* 框选区域 */}
          {interaction.isMarqueeSelecting && interaction.marqueeRect && (
            <div
              className="marquee-selection"
              style={{
                left: interaction.marqueeRect.x,
                top: interaction.marqueeRect.y,
                width: interaction.marqueeRect.width,
                height: interaction.marqueeRect.height,
              }}
            />
          )}
        </div>
      </InfiniteViewer>

      {/* 状态栏 */}
      <div className="editor-statusbar">
        <span className="status-item">
          <span className="status-label">Zoom:</span>
          {Math.round(zoom * 100)}%
        </span>
        <span className="status-item">
          <span className="status-label">Elements:</span>
          {elements.length}
        </span>
        {selectedIds.length > 0 && (
          <span className="status-item">
            <span className="status-label">Selected:</span>
            {selectedIds.length}
          </span>
        )}
      </div>
    </div>
  );
}

export default InfiniteCanvasEditor;
