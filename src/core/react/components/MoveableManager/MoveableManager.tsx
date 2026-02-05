import { useRef, useEffect, useMemo, useState, useLayoutEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import Moveable, { type OnDrag, type OnResize, type OnDragGroup, type OnResizeGroup } from 'react-moveable';
import { useEngineInstance } from '../../EditorProvider';
import { useEditorEngine } from '../../useEditorEngine';
import { useCoordinateSystem } from '../../hooks/useCoordinateSystem';
import type { Element } from '../../../types';
import type { MoveableManagerProps, MoveableManagerRef } from './types';
import { calculateNewFontSize } from '../../../../components/elements/utils/textUtils';

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
      
      // requestAnimationFrame(() => {
        setTargets(nextTargets);
      // });

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
          
          engine.updateElement(id, {
            x: element.x + drag.beforeTranslate[0],
            y: element.y + drag.beforeTranslate[1],
            width: newWidth,
            style: { ...element.style, fontSize: newFontSize }
          });
        } else {
          // 侧边缩放：仅改变宽度，允许换行（高度将由 ResizeObserver 自动更新）
          // 标记为已设置固定宽度
          target.style.width = `${newWidth}px`;
          // target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
          
          engine.updateElement(id, {
            x: element.x,
            y: element.y,
            width: newWidth,
            fixedWidth: true, // 一旦手动调整宽度，就进入固定宽度模式
          });
        }
      } else {
        // 普通元素：同步更新宽高
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

      // 调用业务回调
      const isCorner = direction[0] !== 0 && direction[1] !== 0;
      onResize?.({ elementId: id, element, width: newWidth, height: newHeight, direction: direction as [number, number], isCorner });
    }, [elements, onResize, engine]);

    const handleResizeEnd = useCallback(({ target }: { target: HTMLElement | SVGElement }) => {
      setKeepRatio(false); // 重置 keepRatio 状态
      engine.setInteraction({ isResizing: false });
      resizeStartElement.current = null; // 清除开始状态

      const id = target.getAttribute('data-element-id');
      if (id) {
        const element = elements.find(el => el.id === id);
        if (element) {
          onResizeEnd?.({ elementId: id, element });
          
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

          engine.updateElement(id, updates);

          // 清除 transform（位置已提交到 store）
          target.style.transform = '';
        }
      }
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
              engine.selectElements([clickedId], mouseEvent.shiftKey, mouseEvent);
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
