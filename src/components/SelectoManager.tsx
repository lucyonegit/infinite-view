import Selecto, { type OnSelect, type OnSelectEnd } from 'react-selecto';
import { useEditorStore } from '../store/editorStore';

/**
 * 选择管理器 - 处理框选和点击选择
 * 使用 react-selecto 实现丝滑的选择体验
 */
export function SelectoManager() {
  const { selectElements, activeTool, deselectAll } = useEditorStore();

  // 只有在选择工具下才启用 Selecto
  const enabled = activeTool === 'select';

  const onDragStart = (e: { inputEvent: MouseEvent; stop: () => void }) => {
    console.log('Selecto: onDragStart', e.inputEvent.target);
    
    // 忽略右键或者不是选择工具的情况
    if (e.inputEvent.button !== 0 || !enabled) {
      e.stop();
      return;
    }
    
    const target = e.inputEvent.target as HTMLElement;
    // 如果点击的是 Moveable 的控制组件，停止 Selecto，让 Moveable 处理
    if (target.closest('.moveable-control') || target.closest('.moveable-area') || target.closest('.moveable-line')) {
      console.log('Selecto: stopped for Moveable');
      e.stop();
      return;
    }

    // 如果点击的是已经选中的元素，且未按 shift，则交给 Moveable 拖动
    const elementId = target.closest('.element')?.getAttribute('data-element-id');
    const { selectedIds } = useEditorStore.getState();
    if (elementId && selectedIds.includes(elementId) && !e.inputEvent.shiftKey) {
      console.log('Selecto: stopped for dragging selected element');
      e.stop();
      return;
    }
  };

  const onSelect = (e: OnSelect) => {
    console.log('Selecto: onSelect', e.selected.length);
    const newSelectedIds = e.selected
      .map((el) => (el as HTMLElement | SVGElement).getAttribute('data-element-id'))
      .filter(Boolean) as string[];
    
    if (e.added.length || e.removed.length) {
      selectElements(newSelectedIds, e.inputEvent.shiftKey);
    } else {
      console.log('Selecto: onSelect - no elements added or removed, skipping selectElements');
    }
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
