import { useRef, useEffect, useMemo, useCallback, memo, useState, useLayoutEffect } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEditorStore } from '../store/editorStore';
import { useCoordinateSystem } from '../hooks/useCoordinateSystem';
import type { Element } from '../types/editor';
import { calculateNewFontSize } from './elements/utils/textUtils';

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
  
  // 追踪全局鼠标状态，用于拦截快速点击导致的幽灵拖拽
  const isMouseDown = useRef(false);
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = true;
    };
    const handleUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
    };
    window.addEventListener('mousedown', handleDown, true);
    window.addEventListener('mouseup', handleUp, true);
    return () => {
      window.removeEventListener('mousedown', handleDown, true);
      window.removeEventListener('mouseup', handleUp, true);
    };
  }, []);

  const { 
    updateElement, 
    findFrameAtPoint, 
    addToFrame, 
    removeFromFrame,
    setHoverFrame,
    hoverFrameId,
    viewport,
    setInteraction,
    interaction,
    consumeSelectionEvent,
    selectElements,
    setEditingId,
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
  
  // Track if we're currently in a drag session
  const isDragging = useRef(false);
  
  // Track if we should keep ratio during resize (for text elements at corners)
  const [keepRatio, setKeepRatio] = useState(false);

  // 记录开始缩放时的初始状态，用于等比缩放计算
  const resizeStartElement = useRef<Element | null>(null);

  // 3. 在层级发生变化（nestingKey 改变）后，同步更新 DOM 引用
  useLayoutEffect(() => {
    const nextTargets = selectedIds
      .filter(id => id !== interaction.editingId) // 过滤掉正在编辑的元素，不显示 Moveable 框
      .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
      .filter(Boolean);
    
    setTargets(nextTargets);

    // 检查是否有来自 Selecto 的立即拖拽事件
    const selectionEvent = consumeSelectionEvent();
    if (selectionEvent && nextTargets.length > 0) {
      // 必须确保 Moveable 已经收到了新的 targets 属性
      // 使用 requestAnimationFrame 保证在下一帧（Moveable 渲染后）立即开始拖拽
      requestAnimationFrame(() => {
        // 关键修复：只有当鼠标仍然按下时，才启动拖拽
        // 如果是极速点击，此时鼠标可能已经抬起，必须放弃 dragStart 否则会产生幽灵拖拽
        if (moveableRef.current && isMouseDown.current) {
          moveableRef.current.dragStart(selectionEvent);
        }
      });
    }

    // 如果当前正在拖拽中，需要恢复拖拽会话
    // 使用 isDragging 标记而不是仅检查 lastEvent，确保只在真正拖拽时恢复
    if (isDragging.current && lastEvent.current && nextTargets.length > 0) {
      // Use double RAF to ensure Moveable has updated its internal state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (moveableRef.current && lastEvent.current && isDragging.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
            moveableRef.current.dragStart(lastEvent.current);
          }
        });
      });
    }
     
  }, [nestingKey, selectedIds, consumeSelectionEvent, interaction.editingId]); // 当层级结构（ParentID）变化时触发

  const elementGuidelines = useMemo(() => {
    const selectedElements = selectedIds.map(id => elements.find(el => el.id === id)).filter(Boolean);
    const parentIds = new Set(selectedElements.map(el => el!.parentId).filter(id => id !== undefined) as string[]);
    
    return elements
      .filter(el => {
        // 1. Don't snap to self or other selected elements
        if (selectedIds.includes(el.id)) return false;
        
        // 2. Root elements are always guidelines
        if (!el.parentId) return true;
        
        // 3. Siblings (elements in the same parent container)
        if (parentIds.has(el.parentId)) return true;
        
        // 4. The parent Frame itself (to snap to its edges)
        if (parentIds.has(el.id)) return true;

        return false;
      })
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

  const handleResize = ({ target, width, height, drag, direction }: OnResize) => {
    const id = target.getAttribute('data-element-id');
    if (!id) return;
    const element = elements.find(el => el.id === id);
    if (!element) return;

    // 使用 CSS transform 直接操作 DOM，避免 React 重新渲染
    const newWidth = Math.floor(width);
    const newHeight = Math.floor(height);
    
    // 如果是文本元素，特殊处理
    if (element.type === 'text') {
      const isCorner = direction[0] !== 0 && direction[1] !== 0;
      
      if (isCorner && resizeStartElement.current) {
        // 等比缩放：根据【初始宽度】的变化比例计算新字号
        const newFontSize = calculateNewFontSize(resizeStartElement.current, newWidth);
        
        target.style.width = `${newWidth}px`;
        // 同步更新 DOM 的字号以保证平滑
        const textContainer = target.querySelector('span, textarea') as HTMLElement;
        if (textContainer) {
          textContainer.style.fontSize = `${newFontSize}px`;
        }
        
        target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
        
        updateElement(id, {
          x: element.x + drag.beforeTranslate[0],
          y: element.y + drag.beforeTranslate[1],
          width: newWidth,
          style: { ...element.style, fontSize: newFontSize }
        });
      } else {
        // 侧边缩放：仅改变宽度，允许换行（高度将由 ResizeObserver 自动更新）
        // 标记为已设置固定宽度
        target.style.width = `${newWidth}px`;
        target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
        
        updateElement(id, {
          x: element.x + drag.beforeTranslate[0],
          y: element.y + drag.beforeTranslate[1],
          width: newWidth,
          fixedWidth: true, // 一旦手动调整宽度，就进入固定宽度模式
        });
      }
    } else {
      // 普通元素：同步更新宽高
      target.style.width = `${newWidth}px`;
      target.style.height = `${newHeight}px`;
      target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
      
      updateElement(id, {
        x: element.x + drag.beforeTranslate[0],
        y: element.y + drag.beforeTranslate[1],
        width: newWidth,
        height: newHeight,
      });
    }
  };

  const handleResizeEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
    console.log('Moveable: onResizeEnd');
    setKeepRatio(false); // 重置 keepRatio 状态
    setInteraction({ isResizing: false });
    resizeStartElement.current = null; // 清除开始状态

    const id = target.getAttribute('data-element-id');
    if (id) {
      const element = elements.find(el => el.id === id);
      if (element) {
        // 获取最终的 transform 值
        const computedStyle = window.getComputedStyle(target);
        const matrix = new DOMMatrix(computedStyle.transform);
        
        const finalWidth = Math.floor(parseInt(target.style.width));
        // 对于文本元素，我们通常让 ResizeObserver 处理高度
        // 但为了保持同步，我们提交当前宽度，高度则视情况而定
        const updates: Partial<Element> = {
          x: element.x + matrix.m41,
          y: element.y + matrix.m42,
          width: finalWidth,
        };

        if (element.type !== 'text') {
           updates.height = Math.floor(parseInt(target.style.height));
        }

        updateElement(id, updates);

        // 清除 transform（位置已提交到 store）
        target.style.transform = '';
      }
    }
  };

  const handleDragGroup = ({ events }: OnDragGroup) => {
    const latestElements = useEditorStore.getState().elements;
    events.forEach(({ target, delta }) => {
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
            // Note: No checkFrameHover during group drag to prevent DOM changes that break the drag session
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
      keepRatio={keepRatio}
      dragArea={true}
      throttleDrag={0}
      throttleResize={0}
      snappable={true}
      elementGuidelines={elementGuidelines}
      snapThreshold={5}
      isDisplaySnapDigit={false}
      snapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      elementSnapDirections={{ top: true, left: true, bottom: true, right: true, center: true, middle: true }}
      onDragStart={(e) => {
        console.log('Moveable: onDragStart');
        
        // dragArea 会在选中元素上创建覆盖层 (.moveable-area)
        // 需要使用 elementFromPoint 获取鼠标下真正的元素（穿透覆盖层）
        const mouseEvent = e.inputEvent as MouseEvent;
        
        // 临时隐藏 Moveable 的覆盖层以获取下方真正的元素
        const moveableAreas = document.querySelectorAll('.moveable-area');
        moveableAreas.forEach(area => {
          (area as HTMLElement).style.pointerEvents = 'none';
        });
        
        const actualTarget = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY) as HTMLElement;
        
        // 恢复覆盖层
        moveableAreas.forEach(area => {
          (area as HTMLElement).style.pointerEvents = '';
        });
        
        // 检查点击目标是否是已选中元素内部的未选中子元素
        const clickedElement = actualTarget?.closest('.element');
        if (clickedElement) {
          const clickedId = clickedElement.getAttribute('data-element-id');
          // 如果点击的元素不在已选中列表中，说明用户想选中这个子元素
          if (clickedId && !selectedIds.includes(clickedId)) {
            console.log('Moveable: stopped - selecting child element:', clickedId);
            // 手动选择子元素，因为 Selecto 不会收到这个点击事件
            selectElements([clickedId], mouseEvent.shiftKey);
            return false; // 阻止 Moveable 拖拽
          }
        }
        
        isDragging.current = true;
      }}
      onDrag={handleDrag}
      onDragEnd={() => {
        console.log('Moveable: onDragEnd');
        isDragging.current = false;
        lastEvent.current = null;
        commitNesting();
      }}
      onResizeStart={(e) => {
        console.log('Moveable: onResizeStart, direction:', e.direction);
        setInteraction({ isResizing: true });
        
        // 检查是否是文本元素
        const targetId = e.target.getAttribute('data-element-id');
        const targetElement = elements.find(el => el.id === targetId);
        
        if (targetElement) {
          // 记录开始状态用于后续计算（特别是文本的等比缩放）
          resizeStartElement.current = { ...targetElement };

          if (targetElement.type === 'text') {
            const d = e.direction;
            // 四角方向：等比缩放
            const isCorner = (d[0] !== 0 && d[1] !== 0);
            setKeepRatio(isCorner);
          } else {
            setKeepRatio(false);
          }
        }
      }}
      onResizeEnd={handleResizeEnd}
      onResize={handleResize}
      onDragGroupStart={() => {
        console.log('Moveable: onDragGroupStart');
        isDragging.current = true;
      }}
      onDragGroup={handleDragGroup}
      onDragGroupEnd={() => {
        console.log('Moveable: onDragGroupEnd');
        isDragging.current = false;
        lastEvent.current = null;
        commitNesting();
      }}
      onResizeGroup={handleResizeGroup}
      onClick={(e) => {
        // detail 为 2 表示双击
        if (e.inputEvent.detail === 2) {
          const targetElement = e.target as HTMLElement;
          const id = targetElement.getAttribute('data-element-id');
          if (id) {
            const el = elements.find(item => item.id === id);
            if (el?.type === 'text') {
              setEditingId(id);
            }
          }
        }
      }}
      onClickGroup={(e) => {
        if (e.inputEvent.detail === 2 && e.targets.length > 0) {
          // 在组合选中时，双击其中一个元素
          const targetElement = e.inputEvent.target as HTMLElement;
          const element = targetElement.closest('.element');
          const id = element?.getAttribute('data-element-id');
          if (id) {
            const el = elements.find(item => item.id === id);
            if (el?.type === 'text') {
              setEditingId(id);
            }
          }
        }
      }}
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
