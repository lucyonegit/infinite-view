import { useRef, useEffect, useMemo, useCallback, memo, useState, useLayoutEffect } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEditorStore } from '../store/editorStore';
import { useCoordinateSystem } from '../hooks/useCoordinateSystem';
import type { Element } from '../types/editor';

interface MoveableManagerProps {
  /** 当前缩放级别 */
  zoom: number;
  /** 所有元素 */
  elements: Element[];
  /** 选中的元素 ID */
  selectedIds: string[];
}

/**
 * Moveable 管理器 - 处理拖拽、缩放和吸附
 */
export const MoveableManager = memo(function MoveableManager({ zoom, elements, selectedIds }: MoveableManagerProps) {
  const moveableRef = useRef<Moveable>(null);
  const lastEvent = useRef<MouseEvent | TouchEvent | null>(null);
  
  const { 
    updateElement, 
    findFrameAtPoint, 
    addToFrame, 
    removeFromFrame,
    setHoverFrame,
    hoverFrameId,
    viewport,
    setInteraction,
    consumeSelectionEvent,
  } = useEditorStore();

  // 1. 建立一个“层级键”，仅在选中元素的父节点发生变化时更新
  const nestingKey = useMemo(() => {
    return selectedIds
      .map(id => {
        const el = elements.find(e => e.id === id);
        return `${id}:${el?.parentId || 'root'}`;
      })
      .join('|');
  }, [selectedIds, elements]);

  // 2. 将 targets 改为 state，以便我们在 DOM 真正挂载后准确查询
  const [targets, setTargets] = useState<HTMLElement[]>([]);

  // 3. 在层级发生变化（nestingKey 改变）后，同步更新 DOM 引用
  useLayoutEffect(() => {
    const nextTargets = selectedIds
      .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
      .filter(Boolean);
    
    setTargets(nextTargets);

    // 检查是否有来自 Selecto 的立即拖拽事件
    const selectionEvent = consumeSelectionEvent();
    if (selectionEvent && nextTargets.length > 0) {
      // 必须确保 Moveable 已经收到了新的 targets 属性
      // 使用 requestAnimationFrame 保证在下一帧（Moveable 渲染后）立即开始拖拽
      requestAnimationFrame(() => {
        if (moveableRef.current) {
          moveableRef.current.dragStart(selectionEvent);
        }
      });
    }

    // 如果当前正在拖拽中（这是用于处理 React 重新渲染导致的重连，不同于上面的首次点击拖拽），需要恢复拖拽会话
    if (lastEvent.current && moveableRef.current && nextTargets.length > 0) {
      requestAnimationFrame(() => {
        if (moveableRef.current && lastEvent.current) {
          moveableRef.current.dragStart(lastEvent.current);
          moveableRef.current.updateRect();
        }
      });
    }
     
  }, [nestingKey, selectedIds, consumeSelectionEvent]); // 当层级结构（ParentID）变化时触发

  const elementGuidelines = useMemo(() => {
    return elements
      .filter(el => !selectedIds.includes(el.id) && !el.parentId)
      .map(el => document.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement)
      .filter(Boolean);
  }, [elements, selectedIds]);

  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [selectedIds, elements]);

  // 使用 Hook 获取坐标转换函数
  const { screenToWorld } = useCoordinateSystem(zoom, viewport.x, viewport.y);

  const checkFrameHover = useCallback((id: string, mouseWorldX: number, mouseWorldY: number) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.type === 'frame') return;

    // Case 1: Element already has a parent Frame
    if (element.parentId) {
      const parentFrame = elements.find(el => el.id === element.parentId);
      if (!parentFrame) return;

      // Check if element is completely outside parent Frame (no overlap at all)
      // Element position is relative to parent, so check against parent's local bounds
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;
      const frameRight = parentFrame.width;
      const frameBottom = parentFrame.height;

      const isCompletelyOutside = 
        elementRight <= 0 ||           // Completely to the left
        element.x >= frameRight ||     // Completely to the right
        elementBottom <= 0 ||          // Completely above
        element.y >= frameBottom;      // Completely below

      if (isCompletelyOutside) {
        removeFromFrame(id);
        requestAnimationFrame(() => {
          if (moveableRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
          }
        });
      }
      return;
    }

    // Case 2: Root-level element - use mouse position to add to Frame
    const targetFrame = findFrameAtPoint(mouseWorldX, mouseWorldY, selectedIds);
    
    if (targetFrame) {
      if (hoverFrameId !== targetFrame.id) {
        setHoverFrame(targetFrame.id);
        addToFrame(id, targetFrame.id);
        
        requestAnimationFrame(() => {
          if (moveableRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
          }
        });
      }
    } else {
      if (hoverFrameId) {
        setHoverFrame(null);
      }
    }
  }, [elements, findFrameAtPoint, selectedIds, hoverFrameId, setHoverFrame, addToFrame, removeFromFrame]);

  const commitNesting = useCallback(() => {
    setHoverFrame(null);
  }, [setHoverFrame]);

  const handleDrag = ({ target, delta, inputEvent }: OnDrag) => {
    const id = target.getAttribute('data-element-id');
    if (id) {
      // 记录最新事件，用于可能的重挂载恢复
      lastEvent.current = inputEvent;

      const latestElements = useEditorStore.getState().elements;
      const element = latestElements.find(el => el.id === id);
      if (element) {
        // Skip position update if parent Frame is also selected (parent movement already moves child)
        const isParentAlsoSelected = element.parentId && selectedIds.includes(element.parentId);
        if (!isParentAlsoSelected) {
          updateElement(id, { 
            x: element.x + delta[0], 
            y: element.y + delta[1] 
          });

          const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);
          checkFrameHover(id, mouseWorld.x, mouseWorld.y);
        }
      }
    }
  };

  const handleResize = ({ target, width, height, drag }: OnResize) => {
    // 使用 CSS transform 直接操作 DOM，避免 React 重新渲染
    const newWidth = Math.floor(width);
    const newHeight = Math.floor(height);
    target.style.width = `${newWidth}px`;
    target.style.height = `${newHeight}px`;
    target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
    const id = target.getAttribute('data-element-id');
    if (!id) return;
    const element = elements.find(el => el.id === id);
    if (!element) return;
    updateElement(id, {
      x: element.x + drag.beforeTranslate[0],
      y: element.y + drag.beforeTranslate[1],
      width: newWidth,
      height: newHeight,
    });
  };

  const handleResizeEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
    console.log('Moveable: onResizeEnd');
    setInteraction({ isResizing: false });

    const id = target.getAttribute('data-element-id');
    if (id) {
      const element = elements.find(el => el.id === id);
      if (element) {
        // 获取最终的 transform 值
        const computedStyle = window.getComputedStyle(target);
        const matrix = new DOMMatrix(computedStyle.transform);
        
        // 提交最终位置和尺寸到 store
        updateElement(id, {
          x: element.x + matrix.m41,
          y: element.y + matrix.m42,
          width: Math.floor(parseInt(target.style.width)),
          height: Math.floor(parseInt(target.style.height)),
        });

        // 清除 transform（位置已提交到 store）
        target.style.transform = '';
      }
    }
  };

  const handleDragGroup = ({ events }: OnDragGroup) => {
    const latestElements = useEditorStore.getState().elements;
    events.forEach(({ target, delta, inputEvent }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const element = latestElements.find(el => el.id === id);
        if (element) {
          // Skip position update if parent Frame is also selected (parent movement already moves child)
          const isParentAlsoSelected = element.parentId && selectedIds.includes(element.parentId);
          if (!isParentAlsoSelected) {
            updateElement(id, { 
              x: element.x + delta[0], 
              y: element.y + delta[1] 
            });
            
            const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);
            checkFrameHover(id, mouseWorld.x, mouseWorld.y);
          }
        }
      }
    });
  };

  const handleResizeGroup = ({ events }: OnResizeGroup) => {
    events.forEach(({ target, width, height, drag }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const newWidth = Math.floor(width);
        const newHeight = Math.floor(height);
        const element = elements.find(el => el.id === id);
        if (element) {
          updateElement(id, {
            x: drag.left,
            y: drag.top,
            width: newWidth,
            height: newHeight,
          });
        }
      }
    });
  };

  if (targets.length === 0) return null;

  return (
    <Moveable
      ref={moveableRef}
      target={targets}
      draggable={true}
      resizable={true}
      dragArea={true}
      throttleDrag={0}
      throttleResize={0}
      snappable={true}
      elementGuidelines={elementGuidelines}
      snapThreshold={5}
      isDisplaySnapDigit={false}
      snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      onDragStart={() => console.log('Moveable: onDragStart')}
      onDrag={handleDrag}
      onDragEnd={() => {
        console.log('Moveable: onDragEnd');
        lastEvent.current = null; // 清除记录
        commitNesting();
      }}
      onResizeStart={() => {
        console.log('Moveable: onResizeStart');
        setInteraction({ isResizing: true });
      }}
      onResizeEnd={handleResizeEnd}
      onResize={handleResize}
      onDragGroup={handleDragGroup}
      onDragGroupEnd={() => {
        console.log('Moveable: onDragGroupEnd');
        commitNesting();
      }}
      onResizeGroup={handleResizeGroup}
      renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
      zoom={1 / zoom}
      edge={false}
      origin={false}
      className="custom-moveable"
      stopPropagation={true}
      preventDefault={true}
    />
  );
});

export default MoveableManager;
