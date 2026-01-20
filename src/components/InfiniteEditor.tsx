import { useRef, useCallback, useState, useEffect } from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import { useEditorStore } from '../store/editorStore';
import { Toolbar } from './Toolbar';
import { ElementRenderer } from './ElementRenderer';
import { Guidelines } from './Guidelines';
import { useSnapping, type SnapLine } from '../hooks/useSnapping';
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
  const [activeSnapLines, setActiveSnapLines] = useState<{
    horizontal: SnapLine[];
    vertical: SnapLine[];
  }>({ horizontal: [], vertical: [] });

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
    reorderElements,
    deleteElements,
  } = useEditorStore();

  // 吸附功能
  const { snap } = useSnapping(elements, selectedIds, { threshold: 8 });

  // ============ 坐标转换 ============

  const screenToWorld = useCallback((clientX: number, clientY: number): Point => {
    const viewer = viewerRef.current;
    if (!viewer) return { x: clientX, y: clientY };

    const container = viewer.getContainer();
    const rect = container.getBoundingClientRect();
    const scrollLeft = viewer.getScrollLeft();
    const scrollTop = viewer.getScrollTop();
    const currentZoom = viewer.getZoom();

    // 正确的坐标转换：
    // 1. clientX - rect.left 得到相对于容器的屏幕坐标
    // 2. 除以 zoom 转换到世界坐标系
    // 3. 加上滚动偏移（scrollLeft/scrollTop 已经是世界坐标，不需要再除以 zoom）
    return {
      x: (clientX - rect.left) / currentZoom + scrollLeft,
      y: (clientY - rect.top) / currentZoom + scrollTop,
    };
  }, []);

  // ============ 缩放处理 ============

  const handleResize = useCallback((worldPoint: Point) => {
    if (selectedIds.length !== 1 || !interaction.resizeHandle) return;
    
    const element = elements.find(el => el.id === selectedIds[0]);
    if (!element) return;

    const handle = interaction.resizeHandle;
    const newBounds = { x: element.x, y: element.y, width: element.width, height: element.height };

    switch (handle) {
      case 'nw':
        newBounds.width = element.x + element.width - worldPoint.x;
        newBounds.height = element.y + element.height - worldPoint.y;
        newBounds.x = worldPoint.x;
        newBounds.y = worldPoint.y;
        break;
      case 'ne':
        newBounds.width = worldPoint.x - element.x;
        newBounds.height = element.y + element.height - worldPoint.y;
        newBounds.y = worldPoint.y;
        break;
      case 'sw':
        newBounds.width = element.x + element.width - worldPoint.x;
        newBounds.height = worldPoint.y - element.y;
        newBounds.x = worldPoint.x;
        break;
      case 'se':
        newBounds.width = worldPoint.x - element.x;
        newBounds.height = worldPoint.y - element.y;
        break;
      case 'n':
        newBounds.height = element.y + element.height - worldPoint.y;
        newBounds.y = worldPoint.y;
        break;
      case 's':
        newBounds.height = worldPoint.y - element.y;
        break;
      case 'w':
        newBounds.width = element.x + element.width - worldPoint.x;
        newBounds.x = worldPoint.x;
        break;
      case 'e':
        newBounds.width = worldPoint.x - element.x;
        break;
    }

    if (newBounds.width >= 20 && newBounds.height >= 20) {
      resizeElement(selectedIds[0], newBounds);
    }
  }, [selectedIds, elements, interaction.resizeHandle, resizeElement]);

  // ============ 鼠标事件处理 ============

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const worldPoint = screenToWorld(e.clientX, e.clientY);

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
          startDragging(worldPoint);
        } else {
          if (!e.shiftKey) {
            deselectAll();
          }
          startMarqueeSelect(worldPoint);
        }
        break;

      case 'rectangle':
      case 'text':
      case 'frame':
        startCreating(
          activeTool === 'text' ? 'text' : activeTool === 'frame' ? 'frame' : 'rectangle',
          worldPoint
        );
        break;
    }
  }, [activeTool, selectedIds, screenToWorld, selectElements, deselectAll, startDragging, startMarqueeSelect, startCreating]);

  const handleViewportMouseMove = useCallback((e: React.MouseEvent) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (interaction.isDragging && interaction.startPoint) {
      // 获取第一个选中元素的边界（用于吸附计算）
      const firstElement = elements.find(el => el.id === selectedIds[0]);
      if (firstElement) {
        // 计算新位置（基于鼠标移动）
        const deltaX = worldPoint.x - interaction.startPoint.x;
        const deltaY = worldPoint.y - interaction.startPoint.y;
        const newBounds = {
          x: firstElement.x + deltaX,
          y: firstElement.y + deltaY,
          width: firstElement.width,
          height: firstElement.height,
        };

        // 应用吸附
        const snapResult = snap(newBounds);
        const snappedDeltaX = snapResult.x - firstElement.x;
        const snappedDeltaY = snapResult.y - firstElement.y;

        // 更新吸附线显示
        setActiveSnapLines({
          horizontal: snapResult.horizontalLines,
          vertical: snapResult.verticalLines,
        });

        // 移动元素（使用吸附后的增量）
        moveElements(selectedIds, snappedDeltaX, snappedDeltaY);
        setInteraction({ startPoint: worldPoint });
      }

      // 实时计算是否进入了某个 Frame
      if (selectedIds.length > 0) {
        // 取第一个选中元素作为基准进行检测 (通常是一次拖动一个元素进入 Frame)
        const id = selectedIds[0];
        const element = elements.find(el => el.id === id);
        
        if (element && element.type !== 'frame') {
          // 使用鼠标当前坐标进行检测，或者使用元素中心点
          // 根据需求 "鼠标进入frame" -> 用 worldPoint
          const targetFrame = findFrameAtPoint(worldPoint.x, worldPoint.y, selectedIds);
          
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
      updateMarqueeSelect(worldPoint);
    } else if (interaction.isCreating && interaction.startPoint) {
      const x = Math.min(interaction.startPoint.x, worldPoint.x);
      const y = Math.min(interaction.startPoint.y, worldPoint.y);
      const width = Math.abs(worldPoint.x - interaction.startPoint.x);
      const height = Math.abs(worldPoint.y - interaction.startPoint.y);
      setCreatingPreview({ x, y, width, height });
    } else if (interaction.isResizing && interaction.startPoint && interaction.resizeHandle) {
      handleResize(worldPoint);
    }
  }, [interaction, screenToWorld, moveElements, selectedIds, updateMarqueeSelect, setInteraction, handleResize, elements, findFrameAtPoint, hoverFrameId, setHoverFrame, addToFrame, removeFromFrame, snap]);

  const handleViewportMouseUp = useCallback((e: React.MouseEvent) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (interaction.isDragging) {
      // 停止拖拽时重置 hover 状态和吸附线
      setHoverFrame(null);
      setActiveSnapLines({ horizontal: [], vertical: [] });
      stopDragging();
    } else if (interaction.isMarqueeSelecting) {
      finishMarqueeSelect();
    } else if (interaction.isCreating) {
      finishCreating(worldPoint);
      setCreatingPreview(null);
    } else if (interaction.isResizing) {
      setInteraction({ isResizing: false, resizeHandle: undefined, startPoint: undefined });
    }
  }, [interaction, screenToWorld, stopDragging, finishMarqueeSelect, finishCreating, setInteraction, setHoverFrame]);

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

  // ============ 键盘快捷键 ============

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入，不触发快捷键
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (selectedIds.length > 0) {
        if (e.key === '[' || e.key === '［') {
          if (e.altKey) {
            reorderElements(selectedIds, 'back');
          } else {
            reorderElements(selectedIds, 'backward');
          }
        } else if (e.key === ']' || e.key === '］') {
          if (e.altKey) {
            reorderElements(selectedIds, 'front');
          } else {
            reorderElements(selectedIds, 'forward');
          }
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          deleteElements(selectedIds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, reorderElements, deleteElements]);

  // ============ Window 级别鼠标事件（用于创建模式在任意位置工作） ============

  useEffect(() => {
    // 只在创建模式下添加 window 级别事件
    if (activeTool !== 'rectangle' && activeTool !== 'text' && activeTool !== 'frame') {
      return;
    }

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      
      // 检查点击是否在 InfiniteViewer 容器内
      const viewer = viewerRef.current;
      if (!viewer) return;
      
      const container = viewer.getContainer();
      const rect = container.getBoundingClientRect();
      
      // 如果点击不在容器范围内，忽略
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }

      // 如果已经在创建中，忽略
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
    <div className="infinite-editor">
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

      {/* InfiniteViewer 视口 */}
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
        // rangeX={[-2000, 2000]}
        // rangeY={[-2000, 2000]}
        onScroll={handleScroll}
        onPinch={handlePinch}
      >
        <div
          className="editor-viewport"
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={handleViewportMouseUp}
          onMouseLeave={handleViewportMouseUp}
        >
          {/* 网格背景 */}
          <div className="grid-background" />

          {/* 元素层 */}
          <div className="elements-layer">
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

          {/* 吸附辅助线 */}
          {(activeSnapLines.horizontal.length > 0 || activeSnapLines.vertical.length > 0) && (
            <Guidelines
              horizontalLines={activeSnapLines.horizontal}
              verticalLines={activeSnapLines.vertical}
            />
          )}

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

export default InfiniteEditor;
