import { useRef, useEffect, useMemo, useState, useLayoutEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEngineInstance } from '../../EditorProvider';
import { useEditorEngine } from '../../useEditorEngine';
import { useCoordinateSystem } from '../../hooks/useCoordinateSystem';
import type { Element } from '../../../types';
import type { MoveableManagerProps, MoveableManagerRef } from './types';

/**
 * MoveableManager - 核心拖拽/缩放管理器
 * 
 * 提供可插拔的拖拽、缩放、吸附对齐能力。
 * 使用此组件即可获得完整的元素交互功能。
 */
export const MoveableManager = forwardRef<MoveableManagerRef, MoveableManagerProps>(
  function MoveableManager({ 
    zoom, 
    options = {},
    onDragStart,
    onDrag,
    onDragEnd,
    onResizeStart,
    onResize,
    onResizeEnd,
  }, ref) {
    const engine = useEngineInstance();
    const moveableRef = useRef<Moveable>(null);
    const lastEvent = useRef<MouseEvent | TouchEvent | null>(null);
    const isMouseDown = useRef(false);
    const isDragging = useRef(false);
    const resizeStartElement = useRef<Element | null>(null);

    // 订阅引擎状态
    const elements = useEditorEngine(engine, s => s.elements);
    const selectedIds = useEditorEngine(engine, s => s.selectedIds);
    const viewport = useEditorEngine(engine, s => s.viewport);
    const interaction = useEditorEngine(engine, s => s.interaction);

    // 默认配置
    const {
      draggable = true,
      resizable = true,
      snappable = true,
      snapThreshold = 5,
      renderDirections = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'],
    } = options;

    // 追踪全局鼠标状态
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

    // 层级键
    const nestingKey = useMemo(() => {
      return selectedIds.map(id => {
        const el = elements.find(e => e.id === id);
        return `${id}:${el?.parentId || 'root'}`;
      }).join('|');
    }, [selectedIds, elements]);

    // 目标元素
    const [targets, setTargets] = useState<HTMLElement[]>([]);
    const [keepRatio, setKeepRatio] = useState(false);

    // 同步 DOM 引用
    useLayoutEffect(() => {
      const nextTargets = selectedIds
        .filter(id => id !== interaction.editingId)
        .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
        .filter(Boolean);
      
      requestAnimationFrame(() => {
        setTargets(nextTargets);
      });

      // 检查 Selecto 传递的立即拖拽事件
      const selectionEvent = engine.consumeSelectionEvent();
      if (selectionEvent && nextTargets.length > 0) {
        requestAnimationFrame(() => {
          if (moveableRef.current && isMouseDown.current) {
            moveableRef.current.dragStart(selectionEvent);
          }
        });
      }

      // 拖拽中恢复
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

    // 吸附参考线
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

    // 事件处理
    const handleDrag = useCallback(({ target, delta, inputEvent }: OnDrag) => {
      const id = target.getAttribute('data-element-id');
      if (!id) return;
      
      const element = elements.find(el => el.id === id);
      if (!element) return;
      
      lastEvent.current = inputEvent;
      const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);
      
      // 调用业务回调
      onDrag?.({ elementId: id, element, delta: [delta[0], delta[1]] as [number, number], inputEvent });
      
      // 调用引擎
      engine.handleDrag([id], [delta[0], delta[1]], mouseWorld);
    }, [elements, screenToWorld, onDrag, engine]);

    const handleResize = useCallback(({ target, width, height, drag, direction }: OnResize) => {
      const id = target.getAttribute('data-element-id');
      if (!id) return;
      
      const element = elements.find(el => el.id === id);
      if (!element) return;
      
      const isCorner = direction[0] !== 0 && direction[1] !== 0;
      const newWidth = Math.floor(width);
      const newHeight = Math.floor(height);

      target.style.width = `${newWidth}px`;
      target.style.height = `${newHeight}px`;
      target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;

      // 调用业务回调
      onResize?.({ elementId: id, element, width: newWidth, height: newHeight, direction: direction as [number, number], isCorner });

      engine.handleResize(
        id, 
        { 
          x: element.x + drag.beforeTranslate[0], 
          y: element.y + drag.beforeTranslate[1], 
          width: newWidth, 
          height: newHeight 
        }, 
        isCorner, 
        resizeStartElement.current || undefined
      );
    }, [elements, onResize, engine]);

    const handleResizeEnd = useCallback(({ target }: { target: HTMLElement | SVGElement }) => {
      setKeepRatio(false);
      engine.setInteraction({ isResizing: false });
      
      const id = target.getAttribute('data-element-id');
      if (id) {
        const element = elements.find(el => el.id === id);
        if (element) {
          onResizeEnd?.({ elementId: id, element });
          
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
      resizeStartElement.current = null;
    }, [elements, onResizeEnd, engine]);

    const handleDragGroup = useCallback(({ events }: OnDragGroup) => {
      if (events.length === 0) return;
      const { delta } = events[0];
      const ids = events.map(e => e.target.getAttribute('data-element-id')).filter(Boolean) as string[];
      engine.handleDrag(ids, [delta[0], delta[1]]);
    }, [engine]);

    const handleResizeGroup = useCallback(({ events }: OnResizeGroup) => {
      events.forEach(({ target, width, height, drag }) => {
        const id = target.getAttribute('data-element-id');
        if (id) {
          engine.updateElement(id, { x: drag.left, y: drag.top, width: Math.floor(width), height: Math.floor(height) });
        }
      });
    }, [engine]);

    // 暴露 API
    useImperativeHandle(ref, () => ({
      dragStart: (e) => moveableRef.current?.dragStart(e),
      updateTargets: () => {
        const nextTargets = selectedIds
          .filter(id => id !== interaction.editingId)
          .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
          .filter(Boolean);
        setTargets(nextTargets);
      },
      updateRect: () => moveableRef.current?.updateRect(),
    }), [selectedIds, interaction.editingId]);

    if (targets.length === 0) return null;

    return (
      <Moveable
        ref={moveableRef}
        target={targets}
        draggable={draggable}
        resizable={resizable}
        keepRatio={keepRatio}
        dragArea={true}
        snappable={snappable}
        elementGuidelines={elementGuidelines}
        snapThreshold={snapThreshold}
        isDisplaySnapDigit={false}
        onDragStart={(e) => {
          const mouseEvent = e.inputEvent as MouseEvent;
          const moveableAreas = document.querySelectorAll('.moveable-area');
          moveableAreas.forEach(area => { (area as HTMLElement).style.pointerEvents = 'none'; });
          const actualTarget = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY) as HTMLElement;
          moveableAreas.forEach(area => { (area as HTMLElement).style.pointerEvents = ''; });
          
          const clickedElement = actualTarget?.closest('.infinite_view_element');
          if (clickedElement) {
            const clickedId = clickedElement.getAttribute('data-element-id');
            if (clickedId && !selectedIds.includes(clickedId)) {
              engine.selectElements([clickedId], mouseEvent.shiftKey);
              return false;
            }
          }
          
          const targetId = (e.target as HTMLElement).getAttribute('data-element-id');
          const element = elements.find(el => el.id === targetId);
          if (element && onDragStart) {
            const result = onDragStart({ elementId: targetId!, element, inputEvent: mouseEvent });
            if (result === false) return false;
          }
          
          isDragging.current = true;
        }}
        onDrag={handleDrag}
        onDragEnd={() => { 
          isDragging.current = false; 
          lastEvent.current = null; 
          engine.setHoverFrame(null);
          
          const targetId = targets[0]?.getAttribute('data-element-id');
          const element = elements.find(el => el.id === targetId);
          if (element && targetId) {
            onDragEnd?.({ elementId: targetId, element });
          }
        }}
        onResizeStart={(e) => {
          engine.setInteraction({ isResizing: true });
          const targetId = e.target.getAttribute('data-element-id');
          const targetElement = elements.find(el => el.id === targetId);
          if (targetElement) {
            resizeStartElement.current = { ...targetElement };
            setKeepRatio(targetElement.type === 'text' && (e.direction[0] !== 0 && e.direction[1] !== 0));
            onResizeStart?.({ elementId: targetId!, element: targetElement, direction: e.direction as [number, number] });
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
        renderDirections={renderDirections}
        zoom={1 / zoom}
        className="custom-moveable"
      />
    );
  }
);

export default MoveableManager;
