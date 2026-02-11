import { useCallback, useRef } from 'react';
import type { OnDrag, OnResize, OnDragGroup, OnResizeGroup } from 'react-moveable';
import type { EditorEngine } from '../../../../../engine/EditorEngine';
import type { Element } from '../../../../../engine/types';
import type { MoveableManagerProps } from '../types';
import { calculateNewFontSize } from '../../../../../utils/textUtils';

interface UseMoveableEventsProps extends Pick<MoveableManagerProps,
  'onDrag' | 'onResize' | 'onResizeEnd' | 'onDragStart' | 'onDragEnd' | 'onResizeStart'
> {
  engine: EditorEngine;
  elements: Element[];
  screenToWorld: (x: number, y: number) => { x: number; y: number };
  setKeepRatio: (keepRatio: boolean) => void;
  lastEventRef: React.MutableRefObject<MouseEvent | TouchEvent | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
}

export function useMoveableEvents({
  engine,
  screenToWorld,
  setKeepRatio,
  lastEventRef,
  isDraggingRef,
  onDrag,
  onDragEnd,
  onResize,
  onResizeEnd,
}: UseMoveableEventsProps) {
  const resizeStartElementRef = useRef<Element | null>(null);

  const getEventCoords = (e: MouseEvent | TouchEvent) => {
    if ('clientX' in e) return { x: e.clientX, y: e.clientY };
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: 0, y: 0 };
  };

  const handleDrag = useCallback(({ target, delta, beforeTranslate, inputEvent }: OnDrag) => {
    const id = target.getAttribute('data-element-id');
    if (!id) return;

    const { elements } = engine.getState();
    const element = elements.find((el: Element) => el.id === id);
    if (!element) return;

    lastEventRef.current = inputEvent;
    const coords = getEventCoords(inputEvent);
    const mouseWorld = screenToWorld(coords.x, coords.y);

    // 视觉更新：直接通过 transform 移动，不触发 React 重绘
    target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;

    // 业务回调
    onDrag?.({ elementId: id, element, delta: [delta[0], delta[1]] as [number, number], inputEvent });

    // 引擎更新：检测是否跨越了 Frame 边界（实时裁剪支持）
    const matrix = new DOMMatrix(window.getComputedStyle(target).transform);
    const currentHoverFrameId = engine.handleDragPreview([id], mouseWorld);

    // 如果当前 Hover 的 Frame 与元素的 parentId 不一致，说明发生了嵌套转换
    // 我们触发一个“状态置换”，让 React 更新 DOM 结构，从而获得实时裁剪效果
    if (currentHoverFrameId !== (element.parentId || null)) {
      engine.transaction(() => {
        engine.handleDrag([id], [matrix.m41, matrix.m42], mouseWorld);
        // 置换后，由于坐标系变了，Moveable 的 transform 会失效或产生偏移
        // 这里需要重置 DOM 状态，让下一步 Moveable 重新计算
        target.style.transform = '';
      });
    }
  }, [screenToWorld, onDrag, engine, lastEventRef]);

  const handleResize = useCallback(({ target, width, height, drag, direction }: OnResize) => {
    const id = target.getAttribute('data-element-id');
    if (!id) return;

    const { elements } = engine.getState();
    const element = elements.find((el: Element) => el.id === id);
    if (!element) return;

    if (!engine.getState().interaction.isResizing) {
      engine.setInteraction({ isResizing: true, isInteracting: true });
    }

    const newWidth = Math.floor(width);
    const newHeight = Math.floor(height);
    const isCorner = direction[0] !== 0 && direction[1] !== 0;

    // 视觉更新：直接修改 DOM 样式，不依赖 React 重绘
    target.style.width = `${newWidth}px`;
    target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;

    if (element.type === 'text') {
      const textContainer = target.querySelector('span, textarea') as HTMLElement;
      if (textContainer && isCorner && resizeStartElementRef.current) {
        const newFontSize = calculateNewFontSize(resizeStartElementRef.current, newWidth);
        textContainer.style.fontSize = `${newFontSize}px`;
      }
    } else {
      target.style.height = `${newHeight}px`;
    }

    // 引擎更新：只更新宽高（及字号），不更新坐标 x, y
    // 这避免了交互中 left/top 的变化导致与 transform 产生偏移冲突
    engine.handleResize(id, {
      width: newWidth,
      height: (element.type !== 'text' ? newHeight : undefined) as any,
    }, isCorner, resizeStartElementRef.current || undefined);

    onResize?.({ elementId: id, element, width: newWidth, height: newHeight, direction: direction as [number, number], isCorner });
  }, [onResize, engine]);

  const handleDragEnd = useCallback(({ target }: { target: HTMLElement | SVGElement }) => {
    const id = target.getAttribute('data-element-id');
    if (id) {
      const { elements } = engine.getState();
      const element = elements.find((el: Element) => el.id === id);
      if (element && lastEventRef.current) {
        const computedStyle = window.getComputedStyle(target);
        const matrix = new DOMMatrix(computedStyle.transform);
        const coords = getEventCoords(lastEventRef.current);
        const mouseWorld = screenToWorld(coords.x, coords.y);

        // 批量更新：一次性提交累计位移，让引擎处理嵌套逻辑和坐标转换
        engine.transaction(() => {
          engine.handleDrag([id], [matrix.m41, matrix.m42], mouseWorld);
          engine.setInteraction({ isDragging: false, isInteracting: false });
          engine.setHoverFrame(null);
          isDraggingRef.current = false;
          lastEventRef.current = null;
        });

        // 延迟清理视觉偏移
        requestAnimationFrame(() => {
          target.style.transform = '';
        });

        onDragEnd?.({ elementId: id, element });
      }
    }
  }, [engine, onDragEnd, screenToWorld, lastEventRef, isDraggingRef]);

  const handleResizeEnd = useCallback(({ target }: { target: HTMLElement | SVGElement }) => {
    setKeepRatio(false);
    resizeStartElementRef.current = null;

    const id = target.getAttribute('data-element-id');
    if (id) {
      const { elements } = engine.getState();
      const element = elements.find((el: Element) => el.id === id);
      if (element) {
        onResizeEnd?.({ elementId: id, element });

        const computedStyle = window.getComputedStyle(target);
        const matrix = new DOMMatrix(computedStyle.transform);

        const finalWidth = Math.floor(parseFloat(target.style.width));
        const updates: Partial<Element> = {
          x: Math.round(element.x + matrix.m41),
          y: Math.round(element.y + matrix.m42),
          width: finalWidth,
        };

        if (element.type !== 'text') {
          updates.height = Math.floor(parseFloat(target.style.height));
        }

        // 使用 transaction 批量更新状态：先更新坐标和尺寸，再重置交互状态
        engine.transaction(() => {
          engine.updateElement(id, updates);
          engine.setInteraction({ isResizing: false, isInteracting: false });
          isDraggingRef.current = false;
          lastEventRef.current = null;
        });

        // 延迟清空 transform，给 React 留出渲染新坐标的时间，避免跳动
        requestAnimationFrame(() => {
          target.style.transform = '';
        });
      }
    }
  }, [onResizeEnd, engine, setKeepRatio, isDraggingRef, lastEventRef]);

  const handleDragGroup = useCallback(({ events }: OnDragGroup) => {
    if (events.length === 0) return;
    const { selectedIds } = engine.getState();

    events.forEach(({ target, beforeTranslate }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const { elements } = engine.getState();
        const element = elements.find(el => el.id === id);
        // 如果父级也在选中组中，子元素会跟随父级移动，不需要重复应用位移
        if (element?.parentId && selectedIds.includes(element.parentId)) return;

        target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
      }
    });
  }, [engine]);

  const handleDragGroupEnd = useCallback(({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
    const { selectedIds } = engine.getState();

    targets.forEach(target => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const { elements } = engine.getState();
        const element = elements.find((el: Element) => el.id === id);
        if (element) {
          // 逻辑同上：如果父级也被选中，则跳过子级的状态更新
          if (element.parentId && selectedIds.includes(element.parentId)) {
            // 虽然不更新状态，但也要清理 transform
            requestAnimationFrame(() => { target.style.transform = ''; });
            return;
          }

          const computedStyle = window.getComputedStyle(target);
          const matrix = new DOMMatrix(computedStyle.transform);
          engine.updateElement(id, {
            x: Math.round(element.x + matrix.m41),
            y: Math.round(element.y + matrix.m42),
          });
          requestAnimationFrame(() => { target.style.transform = ''; });
        }
      }
    });
    engine.setInteraction({ isDragging: false, isInteracting: false });
    isDraggingRef.current = false;
    lastEventRef.current = null;
    engine.setHoverFrame(null);
  }, [engine, isDraggingRef, lastEventRef]);

  const handleResizeGroup = useCallback(({ events }: OnResizeGroup) => {
    const { selectedIds } = engine.getState();

    events.forEach(({ target, width, height, drag, direction }) => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const { elements: currentElements } = engine.getState();
        const element = currentElements.find(el => el.id === id);
        if (!element) return;

        // 如果父级也在选中组中，子元素会跟随父级缩放，不需要重复应用位移
        if (element.parentId && selectedIds.includes(element.parentId)) return;

        const newWidth = Math.floor(width);
        const newHeight = Math.floor(height);
        const isCorner = direction[0] !== 0 && direction[1] !== 0;

        target.style.width = `${newWidth}px`;
        target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;

        // 如果是文本元素，显式设为 auto 确保不被之前的固定高度阻塞
        if (element?.type === 'text') {
          target.style.height = 'auto';

          // 如果是角部缩放，同步缩放字号
          const textContainer = target.querySelector('span, textarea') as HTMLElement;
          if (textContainer && isCorner && resizeStartElementRef.current) {
            // 注意：多选缩放时，resizeStartElementRef.current 可能不适用于所有元素
            // 但在 Moveable 的 Group 逻辑中，通常会有基准引用，这里我们回退到 element 自身
            const baseElement = currentElements.find(el => el.id === id) || element;
            const newFontSize = calculateNewFontSize(baseElement, newWidth);
            textContainer.style.fontSize = `${newFontSize}px`;
          }
        } else {
          target.style.height = `${newHeight}px`;
        }
      }
    });
  }, [engine]);

  const handleResizeGroupEnd = useCallback(({ targets }: { targets: (HTMLElement | SVGElement)[] }) => {
    const { selectedIds } = engine.getState();

    engine.transaction(() => {
      targets.forEach(target => {
        const id = target.getAttribute('data-element-id');
        if (id) {
          const { elements: currentElements } = engine.getState();
          const element = currentElements.find((el: Element) => el.id === id);
          if (element) {
            // 逻辑同上：如果父级也被选中，则跳过子级
            if (element.parentId && selectedIds.includes(element.parentId)) {
              requestAnimationFrame(() => { target.style.transform = ''; });
              return;
            }

            const computedStyle = window.getComputedStyle(target);
            const matrix = new DOMMatrix(computedStyle.transform);

            // 文本元素使用 offsetHeight 探测内容高度，其他使用样式值
            const finalWidth = Math.floor(parseFloat(target.style.width));
            const finalHeight = element.type === 'text'
              ? (target as HTMLElement).offsetHeight
              : Math.floor(parseFloat(target.style.height));

            engine.updateElement(id, {
              x: Math.round(element.x + matrix.m41),
              y: Math.round(element.y + matrix.m42),
              width: finalWidth,
              height: finalHeight,
            });

            requestAnimationFrame(() => { target.style.transform = ''; });
          }
        }
      });
      engine.setInteraction({ isResizing: false, isInteracting: false });
      isDraggingRef.current = false;
      lastEventRef.current = null;
    });
  }, [engine, isDraggingRef, lastEventRef]);

  return {
    handleDrag,
    handleDragEnd,
    handleResize,
    handleResizeEnd,
    handleDragGroup,
    handleDragGroupEnd,
    handleResizeGroup,
    handleResizeGroupEnd,
    resizeStartElementRef,
  };
}
