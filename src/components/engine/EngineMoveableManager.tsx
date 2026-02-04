import { useRef, useEffect, useMemo, useCallback, memo, useState, useLayoutEffect } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEngineInstance } from '../../core/react/EditorProvider';
import { useEditorEngine } from '../../core/react/useEditorEngine';
import { useCoordinateSystem } from '../../hooks/useCoordinateSystem';
import type { Element } from '../../types/editor';
import { calculateNewFontSize } from '../elements/utils/textUtils';

interface MoveableManagerProps {
  zoom: number;
  elements: Element[];
  selectedIds: string[];
}

/**
 * EngineMoveableManager - 基于 EditorEngine 的 Moveable 管理器
 */
export const EngineMoveableManager = memo(function EngineMoveableManager({ zoom, elements, selectedIds }: MoveableManagerProps) {
  const engine = useEngineInstance();
  const moveableRef = useRef<Moveable>(null);
  const lastEvent = useRef<MouseEvent | TouchEvent | null>(null);
  const isMouseDown = useRef(false);

  // 1. 订阅引擎状态
  const viewport = useEditorEngine(engine, s => s.viewport);
  const interaction = useEditorEngine(engine, s => s.interaction);
  const hoverFrameId = useEditorEngine(engine, s => s.hoverFrameId);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => { if (e.button === 0) isMouseDown.current = true; };
    const handleUp = (e: MouseEvent) => { if (e.button === 0) isMouseDown.current = false; };
    window.addEventListener('mousedown', handleDown, true);
    window.addEventListener('mouseup', handleUp, true);
    return () => {
      window.removeEventListener('mousedown', handleDown, true);
      window.removeEventListener('mouseup', handleUp, true);
    };
  }, []);

  const nestingKey = useMemo(() => {
    return selectedIds.map(id => {
      const el = elements.find(e => e.id === id);
      return `${id}:${el?.parentId || 'root'}`;
    }).join('|');
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
    
    // 使用 requestAnimationFrame 避免 React 对直接在 Effect 中调用 setState 的警告
    requestAnimationFrame(() => {
      setTargets(nextTargets);
    });

    // 检查是否有来自 Selecto 的立即拖拽事件
    const selectionEvent = engine.consumeSelectionEvent();
    if (selectionEvent && nextTargets.length > 0) {
      requestAnimationFrame(() => {
        if (moveableRef.current && isMouseDown.current) {
          moveableRef.current.dragStart(selectionEvent);
        }
      });
    }

    if (isDragging.current && lastEvent.current && nextTargets.length > 0) {
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
  }, [nestingKey, selectedIds, interaction.editingId, engine]);

  const elementGuidelines = useMemo(() => {
    const selectedElements = selectedIds.map(id => elements.find(el => el.id === id)).filter(Boolean);
    const parentIds = new Set(selectedElements.map(el => el!.parentId).filter(id => id !== undefined) as string[]);
    
    return elements
      .filter(el => {
        if (selectedIds.includes(el.id)) return false;
        if (!el.parentId) return true;
        if (parentIds.has(el.parentId)) return true;
        if (parentIds.has(el.id)) return true;
        return false;
      })
      .map(el => document.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement)
      .filter(Boolean);
  }, [elements, selectedIds]);

  useEffect(() => {
    if (moveableRef.current) moveableRef.current.updateRect();
  }, [selectedIds, elements]);

  const { screenToWorld } = useCoordinateSystem(zoom, viewport.x, viewport.y);

  const checkFrameHover = useCallback((id: string, mouseWorldX: number, mouseWorldY: number) => {
    const element = elements.find(el => el.id === id);
    if (!element || element.type === 'frame') return;

    if (element.parentId) {
      const parentFrame = elements.find(el => el.id === element.parentId);
      if (!parentFrame) return;

      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;
      if (elementRight <= 0 || element.x >= parentFrame.width || elementBottom <= 0 || element.y >= parentFrame.height) {
        engine.removeFromFrame(id);
        requestAnimationFrame(() => {
          if (moveableRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
          }
        });
      }
      return;
    }

    // 使用引擎中的 findFrameAtPoint 方法
    const targetFrame = engine.findFrameAtPoint(mouseWorldX, mouseWorldY, selectedIds);
    
    if (targetFrame) {
      if (hoverFrameId !== targetFrame.id) {
        engine.setHoverFrame(targetFrame.id);
        engine.addToFrame(id, targetFrame.id);
        requestAnimationFrame(() => {
          if (moveableRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
          }
        });
      }
    } else if (hoverFrameId) {
      engine.setHoverFrame(null);
    }
  }, [elements, selectedIds, hoverFrameId, engine]);

  const handleDrag = ({ target, delta, inputEvent }: OnDrag) => {
    const id = target.getAttribute('data-element-id');
    if (id) {
      lastEvent.current = inputEvent;
      const element = engine.getState().elements.find(el => el.id === id);
      if (element) {
        const isParentAlsoSelected = element.parentId && selectedIds.includes(element.parentId);
        if (!isParentAlsoSelected) {
          engine.updateElement(id, { x: element.x + delta[0], y: element.y + delta[1] });
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

    const newWidth = Math.floor(width);
    const newHeight = Math.floor(height);
    
    if (element.type === 'text') {
      const isCorner = direction[0] !== 0 && direction[1] !== 0;
      if (isCorner && resizeStartElement.current) {
        const newFontSize = calculateNewFontSize(resizeStartElement.current, newWidth);
        target.style.width = `${newWidth}px`;
        const textContainer = target.querySelector('span, textarea') as HTMLElement;
        if (textContainer) textContainer.style.fontSize = `${newFontSize}px`;
        target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
        engine.updateElement(id, {
          x: element.x + drag.beforeTranslate[0],
          y: element.y + drag.beforeTranslate[1],
          width: newWidth,
          style: { ...element.style, fontSize: newFontSize }
        });
      } else {
        target.style.width = `${newWidth}px`;
        engine.updateElement(id, { x: element.x, y: element.y, width: newWidth, fixedWidth: true });
      }
    } else {
      target.style.width = `${newWidth}px`;
      target.style.height = `${newHeight}px`;
      target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
      engine.updateElement(id, {
        x: element.x + drag.beforeTranslate[0],
        y: element.y + drag.beforeTranslate[1],
        width: newWidth,
        height: newHeight,
      });
    }
  };

  const handleResizeEnd = ({ target }: { target: HTMLElement | SVGElement }) => {
    setKeepRatio(false);
    engine.setInteraction({ isResizing: false });
    resizeStartElement.current = null;
    const id = target.getAttribute('data-element-id');
    if (id) {
      const element = elements.find(el => el.id === id);
      if (element) {
        const computedStyle = window.getComputedStyle(target);
        const matrix = new DOMMatrix(computedStyle.transform);
        const finalWidth = Math.floor(parseInt(target.style.width));
        const updates: Partial<Element> = {
          x: element.x + matrix.m41,
          y: element.y + matrix.m42,
          width: finalWidth,
        };
        if (element.type !== 'text') updates.height = Math.floor(parseInt(target.style.height));
        engine.updateElement(id, updates);
        target.style.transform = '';
      }
    }
  };

  const handleDragGroup = ({ events }: OnDragGroup) => {
    const latestElements = engine.getState().elements;
    events.forEach(({ target, delta }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const element = latestElements.find(el => el.id === id);
        if (element) {
          const isParentAlsoSelected = element.parentId && selectedIds.includes(element.parentId);
          if (!isParentAlsoSelected) {
            engine.updateElement(id, { x: element.x + delta[0], y: element.y + delta[1] });
          }
        }
      }
    });
  };

  const handleResizeGroup = ({ events }: OnResizeGroup) => {
    events.forEach(({ target, width, height, drag }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        engine.updateElement(id, { x: drag.left, y: drag.top, width: Math.floor(width), height: Math.floor(height) });
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
      snappable={true}
      elementGuidelines={elementGuidelines}
      snapThreshold={5}
      isDisplaySnapDigit={false}
      onDragStart={(e) => {
        const mouseEvent = e.inputEvent as MouseEvent;
        const moveableAreas = document.querySelectorAll('.moveable-area');
        moveableAreas.forEach(area => { (area as HTMLElement).style.pointerEvents = 'none'; });
        const actualTarget = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY) as HTMLElement;
        moveableAreas.forEach(area => { (area as HTMLElement).style.pointerEvents = ''; });
        const clickedElement = actualTarget?.closest('.element');
        if (clickedElement) {
          const clickedId = clickedElement.getAttribute('data-element-id');
          if (clickedId && !selectedIds.includes(clickedId)) {
            engine.selectElements([clickedId], mouseEvent.shiftKey);
            return false;
          }
        }
        isDragging.current = true;
      }}
      onDrag={handleDrag}
      onDragEnd={() => { isDragging.current = false; lastEvent.current = null; engine.setHoverFrame(null); }}
      onResizeStart={(e) => {
        engine.setInteraction({ isResizing: true });
        const targetId = e.target.getAttribute('data-element-id');
        const targetElement = elements.find(el => el.id === targetId);
        if (targetElement) {
          resizeStartElement.current = { ...targetElement };
          setKeepRatio(targetElement.type === 'text' && (e.direction[0] !== 0 && e.direction[1] !== 0));
        }
      }}
      onResizeEnd={handleResizeEnd}
      onResize={handleResize}
      onDragGroupStart={() => { isDragging.current = true; }}
      onDragGroup={handleDragGroup}
      onDragGroupEnd={() => { isDragging.current = false; lastEvent.current = null; engine.setHoverFrame(null); }}
      onResizeGroup={handleResizeGroup}
      onClick={(e) => {
        if (e.inputEvent.detail === 2) {
          const id = (e.target as HTMLElement).getAttribute('data-element-id');
          if (id && elements.find(i => i.id === id)?.type === 'text') engine.setEditingId(id);
        }
      }}
      renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
      zoom={1 / zoom}
      className="custom-moveable"
    />
  );
});

export default EngineMoveableManager;
