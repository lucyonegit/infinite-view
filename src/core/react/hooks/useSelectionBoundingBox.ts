import { useEditorEngineShallow } from '../useEditorEngine';
import { useEngineInstance } from '../EditorProvider';

/**
 * 选区包围盒类型
 */
export interface SelectionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
}

/**
 * useSelectionBoundingBox - 获取当前选中元素的包围盒
 * 
 * 计算所有选中元素在世界坐标系中的最小包围矩形。
 * 使用浅比较优化，仅在选区或元素位置变化时重新计算。
 * 
 * @returns 包围盒对象，如果没有选中元素则返回 null
 * 
 * @example
 * ```tsx
 * const boundingBox = useSelectionBoundingBox();
 * if (boundingBox) {
 *   console.log('Selection center:', boundingBox.centerX);
 * }
 * ```
 */
export function useSelectionBoundingBox(): SelectionBoundingBox | null {
  const engine = useEngineInstance();

  return useEditorEngineShallow(engine, s => {
    const { selectedIds, elements } = s;

    if (selectedIds.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const worldPos = engine.getElementWorldPos(id);
        minX = Math.min(minX, worldPos.x);
        minY = Math.min(minY, worldPos.y);
        maxX = Math.max(maxX, worldPos.x + el.width);
        maxY = Math.max(maxY, worldPos.y + el.height);
      }
    });

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: minX + (maxX - minX) / 2,
    };
  });
}

export default useSelectionBoundingBox;
