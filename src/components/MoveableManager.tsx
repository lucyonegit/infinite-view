import { useRef, useEffect, useMemo, useCallback, memo, useState, useLayoutEffect } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEditorStore } from '../store/editorStore';
import type { Element, Point } from '../types/editor';

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

  /** 将屏幕坐标转换为世界坐标 */
  const screenToWorld = useCallback((clientX: number, clientY: number): Point => {
    // 获取 .editor-viewer 的边界作为基准
    const container = document.querySelector('.editor-viewer');
    if (!container) return { x: clientX, y: clientY };
    
    const rect = container.getBoundingClientRect();
    
    // 世界坐标 = (屏幕坐标 - Container偏移) / zoom + scroll
    // store.viewport.x = -scrollLeft
    return {
      x: (clientX - rect.left) / zoom - viewport.x,
      y: (clientY - rect.top) / zoom - viewport.y,
    };
  }, [zoom, viewport.x, viewport.y]);

  const checkFrameHover = useCallback((id: string, mouseWorldX: number, mouseWorldY: number) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.type === 'frame') return;

    // 根据鼠标指针所在的世界坐标查找目标 Frame
    const targetFrame = findFrameAtPoint(mouseWorldX, mouseWorldY, selectedIds);
    
    if (targetFrame) {
      if (hoverFrameId !== targetFrame.id && element.parentId !== targetFrame.id) {
        setHoverFrame(targetFrame.id);
        // 执行嵌套逻辑
        addToFrame(id, targetFrame.id);
        
        requestAnimationFrame(() => {
          // 在 DOM 更新后（嵌套已生效），强制 Moveable 刷新位置和目标引用
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
      if (element.parentId) {
        removeFromFrame(id);
        requestAnimationFrame(() => {
          if (moveableRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
          }
        });
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
        updateElement(id, { 
          x: element.x + delta[0], 
          y: element.y + delta[1] 
        });

        const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);
        checkFrameHover(id, mouseWorld.x, mouseWorld.y);
      }
    }
  };

  const handleResize = ({ target, width, height, drag }: OnResize) => {
    // 使用 CSS transform 直接操作 DOM，避免 React 重新渲染
    target.style.width = `${width}px`;
    target.style.height = `${height}px`;
    target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
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
          width: parseFloat(target.style.width),
          height: parseFloat(target.style.height),
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
          updateElement(id, { 
            x: element.x + delta[0], 
            y: element.y + delta[1] 
          });
          
          const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);
          checkFrameHover(id, mouseWorld.x, mouseWorld.y);
        }
      }
    });
  };

  const handleResizeGroup = ({ events }: OnResizeGroup) => {
    events.forEach(({ target, width, height, drag }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const element = elements.find(el => el.id === id);
        if (element) {
          updateElement(id, {
            x: drag.left,
            y: drag.top,
            width,
            height,
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
