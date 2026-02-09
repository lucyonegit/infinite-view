import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import type Moveable from 'react-moveable';
import type { EditorEngine } from '../../../../../engine/EditorEngine';
import type { Element } from '../../../../../engine/types';

interface UseMoveableTargetsProps {
  engine: EditorEngine;
  selectedIds: string[];
  editingId: string | null;
  moveableRef: React.RefObject<Moveable | null>;
}

export function useMoveableTargets({
  engine,
  selectedIds,
  editingId,
  moveableRef,
}: UseMoveableTargetsProps) {
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastEventRef = useRef<MouseEvent | TouchEvent | null>(null);

  // 追踪全局鼠标状态
  useEffect(() => {
    const handleDown = (e: MouseEvent) => { if (e.button === 0) isMouseDownRef.current = true; };
    const handleUp = (e: MouseEvent) => { if (e.button === 0) isMouseDownRef.current = false; };
    window.addEventListener('mousedown', handleDown, true);
    window.addEventListener('mouseup', handleUp, true);
    return () => {
      window.removeEventListener('mousedown', handleDown, true);
      window.removeEventListener('mouseup', handleUp, true);
    };
  }, []);

  const updateTargets = () => {
    const nextTargets = selectedIds
      .filter((id) => id !== editingId)
      .map((id) => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement)
      .filter(Boolean);
    setTargets(nextTargets);
    return nextTargets;
  };

  // 层级键，用于 useLayoutEffect 依赖，确保在父元素变化时更新
  const nestingKey = selectedIds.map((id) => {
    const el = engine.getState().elements.find((e: Element) => e.id === id);
    return `${id}:${el?.parentId || 'root'}`;
  }).join('|');

  useLayoutEffect(() => {
    const nextTargets = updateTargets();

    // 检查 Selecto 传递的立即拖拽事件
    const selectionEvent = engine.consumeSelectionEvent();
    if (selectionEvent && nextTargets.length > 0) {
      requestAnimationFrame(() => {
        if (moveableRef.current && isMouseDownRef.current) {
          moveableRef.current.dragStart(selectionEvent);
        }
      });
    }

    // 拖拽中恢复
    if (isDraggingRef.current && lastEventRef.current && nextTargets.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (moveableRef.current && lastEventRef.current && isDraggingRef.current) {
            moveableRef.current.updateTarget();
            moveableRef.current.updateRect();
            moveableRef.current.dragStart(lastEventRef.current);
          }
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nestingKey, selectedIds, editingId, engine, moveableRef]);

  return {
    targets,
    updateTargets,
    isDraggingRef,
    lastEventRef,
  };
}
