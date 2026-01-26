import { useRef, useLayoutEffect } from 'react';
import Selecto, { type OnSelect, type OnSelectEnd } from 'react-selecto';
import { useEditorStore } from '../store/editorStore';

/**
 * 选择管理器 - 处理框选和点击选择
 * 使用 react-selecto 实现丝滑的选择体验
 */
export function SelectoManager() {
  // 获取选中的元素 ID
  const { selectElements, activeTool, deselectAll, interaction, selectedIds } = useEditorStore();
  const isDragStartOnElement = useRef(false);
  const selectoRef = useRef<Selecto>(null);

  // 计算选中的 DOM 元素，用于同步 Selecto 的内部状态
  // 使用 useLayoutEffect 确保在渲染后立即同步，避免状态不一致
  useLayoutEffect(() => {
    if (selectoRef.current) {
      const targets = selectedIds
        .map(id => document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | SVGElement)
        .filter(Boolean);
      selectoRef.current.setSelectedTargets(targets);
    }
  }, [selectedIds]);

  // 只有在选择工具下才启用 Selecto
  const enabled = activeTool === 'select';

  const onDragStart = (e: { inputEvent: MouseEvent; stop: () => void }) => {
    const { inputEvent, stop } = e;
    const target = inputEvent.target as HTMLElement;

    // 1. 基础验证：仅左键且处于选择工具激活状态
    if (inputEvent.button !== 0 || !enabled) {
      stop();
      return;
    }

    // 2. 状态冲突检查：如果 Moveable 正在进行 Resizing，Selecto 退出避免冲突
    if (interaction.isResizing) {
      stop();
      return;
    }

    // 3. UI 拦截：如果点在工具栏、Moveable 控制点等 UI 上，Selecto 退出
    const isUI = target.closest('.editor-toolbar, .floating-toolbar, .moveable-control, .moveable-direction, .moveable-area, .moveable-line');
    if (isUI) {
      stop();
      return;
    }

    // 4. 元素交互处理
    const element = target.closest('.element');
    const elementId = element?.getAttribute('data-element-id');
    isDragStartOnElement.current = !!elementId;

    // 如果点击的是【已选中元素】（且没有按住 Shift）
    // 特殊处理：因为某些元素（如 Text）层级可能高于 Moveable 覆盖层，导致常规拖拽失效
    // 我们手动触发一次选择，通过 store 驱动 Moveable 开启立即拖拽
    if (elementId && selectedIds.includes(elementId) && !inputEvent.shiftKey) {
      selectElements([...selectedIds], false, inputEvent);
      stop(); // 停止 Selecto，通过 Moveable 驱动拖拽
      return;
    }
  };

  const onSelect = (e: OnSelect) => {
    console.log('Selecto: onSelect', e.selected.length, 'isDragStartOnElement:', isDragStartOnElement.current);
    const newSelectedIds = e.selected
      .map((el) => (el as HTMLElement | SVGElement).getAttribute('data-element-id'))
      .filter(Boolean) as string[];
    
    const eventToPass = isDragStartOnElement.current ? e.inputEvent : undefined;
    selectElements(newSelectedIds, e.inputEvent.shiftKey, eventToPass);
  };

  const onSelectEnd = (e: OnSelectEnd) => {
    console.log('Selecto: onSelectEnd - selected count:', e.selected.length);
    console.log('Selecto: onSelectEnd - isDragStart:', e.isDragStart);
    console.log('Selecto: onSelectEnd - inputEvent shiftKey:', e.inputEvent.shiftKey);

    // 如果最终没有选中，且不是在多选/拖拽，则清空
    if (e.selected.length === 0 && !e.inputEvent.shiftKey && !e.isDragStart) {
      console.log('Selecto: onSelectEnd - no elements selected and not multi-selecting/dragging, deselecting all');
      deselectAll();
    } else {
      console.log('Selecto: onSelectEnd - conditions not met for deselectAll');
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

export default SelectoManager;
