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

    // 2. Handle Frame nesting
    if (ids.length === 1 && mouseWorld) {
      const id = ids[0];
      const el = nextElements.find(e => e.id === id);

      if (el && el.type !== 'frame') {
        if (el.parentId) {
          const parentFrame = nextElements.find(p => p.id === el.parentId);
          if (parentFrame) {
            const elementRight = el.x + el.width;
            const elementBottom = el.y + el.height;
            if (elementRight <= 0 || el.x >= parentFrame.width || elementBottom <= 0 || el.y >= parentFrame.height) {
              const worldPos = getElementWorldPos(nextElements, id);
              const idx = nextElements.findIndex(e => e.id === id);
              nextElements[idx] = { ...nextElements[idx], parentId: undefined, x: worldPos.x, y: worldPos.y };

              const pIdx = nextElements.findIndex(e => e.id === parentFrame.id);
              nextElements[pIdx] = {
                ...nextElements[pIdx],
                children: (nextElements[pIdx].children || []).filter(cid => cid !== id)
              };
            }
          }
        } else {
          const targetFrame = findFrameAtPoint(nextElements, mouseWorld.x, mouseWorld.y, ids);
          if (targetFrame) {
            if (nextHoverFrameId !== targetFrame.id) {
              nextHoverFrameId = targetFrame.id;
              const frameWorldPos = getElementWorldPos(nextElements, targetFrame.id);
              const relativeX = el.x - frameWorldPos.x;
              const relativeY = el.y - frameWorldPos.y;

              const idx = nextElements.findIndex(e => e.id === id);
              nextElements[idx] = { ...el, parentId: targetFrame.id, x: relativeX, y: relativeY };

              const fIdx = nextElements.findIndex(e => e.id === targetFrame.id);
              const children = nextElements[fIdx].children || [];
              if (!children.includes(id)) {
                nextElements[fIdx] = { ...nextElements[fIdx], children: [...children, id] };
              }
            }
          } else {
            nextHoverFrameId = null;
          }
        }
      }
    }

    return { elements: nextElements, hoverFrameId: nextHoverFrameId };
  }
}
