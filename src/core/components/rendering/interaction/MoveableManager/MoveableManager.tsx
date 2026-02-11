import { useRef, useEffect, useLayoutEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Moveable from 'react-moveable';
import { useEngineInstance } from '../../../../react/context/useEngineInstance';
import { useEditorEngine } from '../../../../react/hooks/useEditorEngine';
import { useCoordinateSystem } from '../../../../react/hooks/useCoordinateSystem';
import type { Element } from '../../../../engine/types';
import type { EditorState } from '../../../../engine/EditorEngine';
import type { MoveableManagerProps, MoveableManagerRef } from './types';
import { useMoveableTargets } from './hooks/useMoveableTargets';
import { useGuidelines } from './hooks/useGuidelines';
import { useMoveableEvents } from './hooks/useMoveableEvents';

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
    const [keepRatio, setKeepRatio] = useState(false);

    // 订阅状态
    const selectedIds = useEditorEngine(engine, (s: EditorState) => s.selectedIds);
    const interaction = useEditorEngine(engine, (s: EditorState) => s.interaction);
    const elements = useEditorEngine(engine, (s: EditorState) => s.elements);
    const viewport = useEditorEngine(engine, (s: EditorState) => s.viewport);

    const { screenToWorld } = useCoordinateSystem(zoom, viewport.x, viewport.y);

    // 1. 目标元素管理
    const { targets, updateTargets, isDraggingRef, lastEventRef } = useMoveableTargets({
      engine,
      selectedIds,
      editingId: interaction.editingId ?? null,
      moveableRef,
    });

    // 2. 吸附参考线管理
    const elementGuidelines = useGuidelines({ elements, selectedIds });

    // 3. 事件处理逻辑
    const {
      handleDrag,
      handleDragEnd,
      handleResize,
      handleResizeEnd,
      handleDragGroup,
      handleDragGroupEnd,
      handleResizeGroup,
      handleResizeGroupEnd,
      resizeStartElementRef,
    } = useMoveableEvents({
      engine,
      elements,
      screenToWorld,
      setKeepRatio,
      lastEventRef,
      isDraggingRef,
      onDrag,
      onDragEnd,
      onResize,
      onResizeEnd,
      onDragStart,
      onResizeStart,
    });

    // 默认配置
    const {
      draggable = true,
      resizable = true,
      snappable = true,
      snapThreshold = 5,
      renderDirections = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'],
    } = options;

    useLayoutEffect(() => {
      if (moveableRef.current) {
        requestAnimationFrame(() => {
          moveableRef.current?.updateTarget();
          moveableRef.current?.updateRect();
        });
      }
    }, [selectedIds, elements]);

    // 监听目标元素的尺寸变化，实时更新 Moveable 选框
    useEffect(() => {
      if (targets.length === 0 || !moveableRef.current) return;

      const observer = new ResizeObserver(() => {
        moveableRef.current?.updateRect();
      });

      targets.forEach(target => {
        if (target) observer.observe(target);
      });

      return () => observer.disconnect();
    }, [targets]);

    // 暴露 API
    useImperativeHandle(ref, () => ({
      dragStart: (e) => moveableRef.current?.dragStart(e),
      updateTargets,
      updateRect: () => moveableRef.current?.updateRect(),
    }), [updateTargets]);

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
          const element = elements.find((el: Element) => el.id === targetId);
          if (element && onDragStart) {
            const result = onDragStart({ elementId: targetId!, element, inputEvent: mouseEvent });
            if (result === false) return false;
          }
          
          isDraggingRef.current = true;
          engine.setInteraction({ isDragging: true, isInteracting: true });
        }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onResizeStart={(e) => {
          engine.setInteraction({ isResizing: true, isInteracting: true });
          const targetId = e.target.getAttribute('data-element-id');
          const targetElement = elements.find((el: Element) => el.id === targetId);
          if (targetElement) {
            resizeStartElementRef.current = { ...targetElement };
            setKeepRatio(targetElement.type === 'text' && (e.direction[0] !== 0 && e.direction[1] !== 0));
            onResizeStart?.({ elementId: targetId!, element: targetElement, direction: e.direction as [number, number] });
          }
        }}
        onResizeEnd={handleResizeEnd}
        onResize={handleResize}
        onDragGroupStart={() => { 
          isDraggingRef.current = true; 
          engine.setInteraction({ isDragging: true, isInteracting: true });
        }}
        onDragGroup={handleDragGroup}
        onDragGroupEnd={handleDragGroupEnd}
        onResizeGroup={handleResizeGroup}
        onResizeGroupEnd={handleResizeGroupEnd}
        onClick={(e) => {
          if (e.inputEvent.detail === 2) {
            const id = (e.target as HTMLElement).getAttribute('data-element-id');
            if (id && elements.find((i: Element) => i.id === id)?.type === 'text') engine.setEditingId(id);
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
