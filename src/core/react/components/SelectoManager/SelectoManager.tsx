import { useRef, useLayoutEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import Selecto, { type OnSelect, type OnSelectEnd } from 'react-selecto';
import { useEngineInstance } from '../../EditorProvider';
import { useEditorEngine } from '../../useEditorEngine';
import type { SelectoManagerProps, SelectoManagerRef } from './types';

/**
 * SelectoManager - 核心选择管理器
 * 
 * 提供可插拔的点击选择、框选、多选能力。
 * 使用此组件即可获得完整的选择功能。
 */
export const SelectoManager = forwardRef<SelectoManagerRef, SelectoManagerProps>(
  function SelectoManager({ options = {}, onSelect, onSelectEnd }, ref) {
    const engine = useEngineInstance();
    const selectoRef = useRef<Selecto>(null);
    const isDragStartOnElement = useRef(false);

    // 订阅状态
    const activeTool = useEditorEngine(engine, s => s.activeTool);
    const selectedIds = useEditorEngine(engine, s => s.selectedIds);
    const interaction = useEditorEngine(engine, s => s.interaction);

    // 默认配置
    const {
      dragContainer = document.body,
      selectableTargets = ['.infinite_view_element'],
      selectByClick = true,
      selectFromInside = false,
    } = options;

    // 同步选中状态
    useLayoutEffect(() => {
      if (selectoRef.current) {
        const targets = selectedIds
          .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | SVGElement)
          .filter(Boolean);
        selectoRef.current.setSelectedTargets(targets);
      }
    }, [selectedIds]);

    const enabled = activeTool === 'select';

    const handleDragStart = useCallback((e: { inputEvent: MouseEvent; stop: () => void }) => {
      const { inputEvent, stop } = e;
      const target = inputEvent.target as HTMLElement;

      if (inputEvent.button !== 0 || !enabled) {
        stop();
        return;
      }

      if (interaction.isResizing) {
        stop();
        return;
      }

      const isUI = target.closest('.editor-toolbar, .floating-toolbar, .moveable-control, .moveable-direction, .moveable-area, .moveable-line');
      if (isUI) {
        stop();
        return;
      }

      const element = target.closest('.infinite_view_element');
      const elementId = element?.getAttribute('data-element-id');
      isDragStartOnElement.current = !!elementId;

      if (elementId) {
        if (inputEvent.shiftKey) {
          const isAlreadySelected = selectedIds.includes(elementId);
          const newSelection = isAlreadySelected 
            ? selectedIds.filter(id => id !== elementId)
            : [...selectedIds, elementId];
          
          const eventToPass = isAlreadySelected ? undefined : inputEvent;
          engine.selectElements(newSelection, false, eventToPass);
        } else {
          engine.selectElements([elementId], false, inputEvent);
        }
        stop();
        return;
      }
    }, [enabled, interaction.isResizing, selectedIds, engine]);

    const handleSelect = useCallback((e: OnSelect) => {
      const newSelectedIds = e.selected
        .map((el) => (el as HTMLElement | SVGElement).getAttribute('data-element-id'))
        .filter(Boolean) as string[];
      
      const eventToPass = isDragStartOnElement.current ? e.inputEvent : undefined;
      engine.selectElements(newSelectedIds, e.inputEvent.shiftKey, eventToPass);
      
      onSelect?.({
        selectedIds: newSelectedIds,
        inputEvent: e.inputEvent,
        isAdditive: e.inputEvent.shiftKey,
      });
    }, [engine, onSelect]);

    const handleSelectEnd = useCallback((e: OnSelectEnd) => {
      const selectedIds = e.selected
        .map((el) => (el as HTMLElement | SVGElement).getAttribute('data-element-id'))
        .filter(Boolean) as string[];
      
      if (e.selected.length === 0 && !e.inputEvent.shiftKey && !e.isDragStart) {
        engine.deselectAll();
      }
      
      onSelectEnd?.({
        selectedIds,
        isDragStart: e.isDragStart,
      });
    }, [engine, onSelectEnd]);

    // 暴露 API
    useImperativeHandle(ref, () => ({
      setSelectedTargets: (ids) => {
        if (selectoRef.current) {
          const targets = ids
            .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | SVGElement)
            .filter(Boolean);
          selectoRef.current.setSelectedTargets(targets);
        }
      },
    }), []);

    return (
      <Selecto
        ref={selectoRef}
        dragContainer={dragContainer}
        selectableTargets={selectableTargets}
        hitRate={0}
        selectByClick={selectByClick}
        selectFromInside={selectFromInside}
        toggleContinueSelect={['shift']}
        ratio={0}
        onDragStart={handleDragStart}
        onSelect={handleSelect}
        onSelectEnd={handleSelectEnd}
      />
    );
  }
);

export default SelectoManager;
