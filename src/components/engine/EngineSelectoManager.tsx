import { useRef, useLayoutEffect } from 'react';
import Selecto, { type OnSelect, type OnSelectEnd } from 'react-selecto';
import { useEngineInstance } from '../../core/react/EditorProvider';
import { useEditorEngine } from '../../core/react/useEditorEngine';

/**
 * EngineSelectoManager - 基于 EditorEngine 的选择管理器
 */
export function EngineSelectoManager() {
  const engine = useEngineInstance();
  
  // 订阅状态
  const activeTool = useEditorEngine(engine, s => s.activeTool);
  const selectedIds = useEditorEngine(engine, s => s.selectedIds);
  const interaction = useEditorEngine(engine, s => s.interaction);
  
  const isDragStartOnElement = useRef(false);
  const selectoRef = useRef<Selecto>(null);

  useLayoutEffect(() => {
    if (selectoRef.current) {
      const targets = selectedIds
        .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | SVGElement)
        .filter(Boolean);
      selectoRef.current.setSelectedTargets(targets);
    }
  }, [selectedIds]);

  const enabled = activeTool === 'select';

  const onDragStart = (e: { inputEvent: MouseEvent; stop: () => void }) => {
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

    const element = target.closest('.element');
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
  };

  const onSelect = (e: OnSelect) => {
    const newSelectedIds = e.selected
      .map((el) => (el as HTMLElement | SVGElement).getAttribute('data-element-id'))
      .filter(Boolean) as string[];
    
    const eventToPass = isDragStartOnElement.current ? e.inputEvent : undefined;
    engine.selectElements(newSelectedIds, e.inputEvent.shiftKey, eventToPass);
  };

  const onSelectEnd = (e: OnSelectEnd) => {
    if (e.selected.length === 0 && !e.inputEvent.shiftKey && !e.isDragStart) {
      engine.deselectAll();
    }
  };

  return (
    <Selecto
      ref={selectoRef}
      dragContainer={document.body}
      selectableTargets={['.element']}
      hitRate={0}
      selectByClick={true}
      selectFromInside={false}
      toggleContinueSelect={['shift']}
      ratio={0}
      onDragStart={onDragStart}
      onSelect={onSelect}
      onSelectEnd={onSelectEnd}
    />
  );
}

export default EngineSelectoManager;
