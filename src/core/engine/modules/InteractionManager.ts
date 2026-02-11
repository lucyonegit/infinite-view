import type { Element, Point } from '../types';
import { getElementWorldPos, findFrameAtPoint } from '../utils';

export class InteractionManager {
  public static handleDrag(
    elements: Element[],
    hoverFrameId: string | null,
    ids: string[],
    delta: [number, number],
    mouseWorld?: Point
  ): { elements: Element[], hoverFrameId: string | null } {
    const nextElements = [...elements];
    let nextHoverFrameId = hoverFrameId;

    // 1. Move selected elements
    ids.forEach(id => {
      const idx = nextElements.findIndex(el => el.id === id);
      if (idx === -1) return;

      const el = nextElements[idx];
      const isParentAlsoSelected = el.parentId && ids.includes(el.parentId);
      if (!isParentAlsoSelected) {
        nextElements[idx] = {
          ...el,
          x: el.x + delta[0],
          y: el.y + delta[1]
        };
      }
    });

    // 2. Handle Frame nesting (Symmetric Cursor-based Logic)
    if (ids.length === 1 && mouseWorld) {
      const id = ids[0];
      const el = nextElements.find(e => e.id === id);

      if (el && el.type !== 'frame') {
        const targetFrame = findFrameAtPoint(nextElements, mouseWorld.x, mouseWorld.y, ids);
        const targetFrameId = targetFrame?.id || undefined;

        // 如果鼠标所处的 Frame 与当前父级不一致，执行嵌套/脱离转换
        if (el.parentId !== targetFrameId) {
          nextHoverFrameId = targetFrameId || null;

          // 获取当前世界坐标，作为转换基准
          const worldPos = getElementWorldPos(nextElements, id);
          const idx = nextElements.findIndex(e => e.id === id);

          if (targetFrameId) {
            // 嵌套入新 Frame
            const frameWorldPos = getElementWorldPos(nextElements, targetFrameId);
            nextElements[idx] = {
              ...el,
              parentId: targetFrameId,
              x: worldPos.x - frameWorldPos.x,
              y: worldPos.y - frameWorldPos.y
            };

            // 更新新父级的 children
            const fIdx = nextElements.findIndex(e => e.id === targetFrameId);
            const children = nextElements[fIdx].children || [];
            if (!children.includes(id)) {
              nextElements[fIdx] = { ...nextElements[fIdx], children: [...children, id] };
            }
          } else {
            // 脱离到根画布
            nextElements[idx] = {
              ...el,
              parentId: undefined,
              x: worldPos.x,
              y: worldPos.y
            };
          }

          // 如果之前有父级，从旧父级中移除
          if (el.parentId) {
            const oldPIdx = nextElements.findIndex(e => e.id === el.parentId);
            if (oldPIdx !== -1) {
              nextElements[oldPIdx] = {
                ...nextElements[oldPIdx],
                children: (nextElements[oldPIdx].children || []).filter(cid => cid !== id)
              };
            }
          }
        }
      }
    }

    return { elements: nextElements, hoverFrameId: nextHoverFrameId };
  }

  /**
   * 仅处理拖拽时的预览逻辑（如高亮目标 Frame），不实际更新元素坐标
   */
  public static handleDragPreview(
    elements: Element[],
    ids: string[],
    mouseWorld: Point
  ): string | null {
    const targetFrame = findFrameAtPoint(elements, mouseWorld.x, mouseWorld.y, ids);
    return targetFrame ? targetFrame.id : null;
  }
}
