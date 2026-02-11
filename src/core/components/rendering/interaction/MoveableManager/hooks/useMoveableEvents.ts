import { useCallback, useRef } from 'react';
import type { OnDrag, OnResize, OnDragGroup, OnResizeGroup } from 'react-moveable';
import type { EditorEngine } from '../../../../../engine/EditorEngine';
import type { Element } from '../../../../../engine/types';
import type { MoveableManagerProps } from '../types';
import { calculateNewFontSize } from '../../../../../utils/textUtils';

interface UseMoveableEventsProps extends Pick<MoveableManagerProps,
  'onDrag' | 'onResize' | 'onResizeEnd'
> {
  engine: EditorEngine;
  elements: Element[];
  screenToWorld: (x: number, y: number) => { x: number; y: number };
  setKeepRatio: (keepRatio: boolean) => void;
  lastEventRef: React.MutableRefObject<MouseEvent | TouchEvent | null>;
}

export function useMoveableEvents({
  engine,
  screenToWorld,
  setKeepRatio,
  lastEventRef,
  onDrag,
  onResize,
  onResizeEnd,
}: UseMoveableEventsProps) {
  const resizeStartElementRef = useRef<Element | null>(null);

  const handleDrag = useCallback(({ target, delta, inputEvent }: OnDrag) => {
    const id = target.getAttribute('data-element-id');
    if (!id) return;

    const { elements } = engine.getState();
    const element = elements.find((el: Element) => el.id === id);
    if (!element) return;

    lastEventRef.current = inputEvent;
    const mouseWorld = screenToWorld(inputEvent.clientX, inputEvent.clientY);

    // 调用业务回调
    onDrag?.({ elementId: id, element, delta: [delta[0], delta[1]] as [number, number], inputEvent });

    // 调用引擎
    engine.handleDrag([id], [delta[0], delta[1]], mouseWorld);
  }, [screenToWorld, onDrag, engine, lastEventRef]);

  const handleResize = useCallback(({ target, width, height, drag, direction }: OnResize) => {
    const id = target.getAttribute('data-element-id');
    if (!id) return;

    const { elements } = engine.getState();
    const element = elements.find((el: Element) => el.id === id);
    if (!element) return;

    const newWidth = Math.floor(width);
    const newHeight = Math.floor(height);

    if (element.type === 'text') {
      const isCorner = direction[0] !== 0 && direction[1] !== 0;

      if (!engine.getState().interaction.isResizing) {
        engine.setInteraction({ isResizing: true, isInteracting: true });
      }

      if (resizeStartElementRef.current) {
        const startEl = resizeStartElementRef.current;

        if (isCorner) {
          const newFontSize = calculateNewFontSize(startEl, newWidth);

          target.style.width = `${newWidth}px`;
          const textContainer = target.querySelector('span, textarea') as HTMLElement;
          if (textContainer) {
            textContainer.style.fontSize = `${newFontSize}px`;
          }

          target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;

          // 缩放过程中不更新 x, y，只更新宽度和字号，避免与 left/top 冲突导致抖动
          // 最终位置会在 handleResizeEnd 中通过 transform 统一计算并提交
          engine.handleResize(id, {
            width: newWidth,
          }, true, startEl);
        } else {
          target.style.width = `${newWidth}px`;
          target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;

          engine.handleResize(id, {
            width: newWidth,
          }, false);
        }
      }
    } else {
      if (!engine.getState().interaction.isResizing) {
        engine.setInteraction({ isResizing: true, isInteracting: true });
      }

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

    const isCorner = direction[0] !== 0 && direction[1] !== 0;
    onResize?.({ elementId: id, element, width: newWidth, height: newHeight, direction: direction as [number, number], isCorner });
  }, [onResize, engine]);

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
        // 确保 TextElement 的 ResizeObserver 在坐标更新后再恢复工作
        engine.transaction(() => {
          engine.updateElement(id, updates);
          engine.setInteraction({ isResizing: false, isInteracting: false });
        });

        // 延迟清空 transform，给 React 留出渲染新坐标的时间，避免跳动
        requestAnimationFrame(() => {
          target.style.transform = '';
        });
      }
    }
  }, [onResizeEnd, engine, setKeepRatio]);

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

  return {
    handleDrag,
    handleResize,
    handleResizeEnd,
    handleDragGroup,
    handleResizeGroup,
    resizeStartElementRef,
  };
}
