import type { Element, Point } from './types';

export function getElementWorldPos(elements: Element[], id: string): Point {
  const element = elements.find(el => el.id === id);
  if (!element) return { x: 0, y: 0 };

  if (!element.parentId) {
    return { x: element.x, y: element.y };
  }

  const parentPos = getElementWorldPos(elements, element.parentId);
  return {
    x: parentPos.x + element.x,
    y: parentPos.y + element.y,
  };
}

export function findFrameAtPoint(elements: Element[], x: number, y: number, excludeIds: string[] = []): Element | null {
  // 找出所有非排除列表中的 Frame，按 zIndex 降序排列（最高层优先）
  const frames = elements
    .filter((el) => el.type === 'frame' && !excludeIds.includes(el.id))
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const frame of frames) {
    const worldPos = getElementWorldPos(elements, frame.id);
    if (
      x >= worldPos.x &&
      x <= worldPos.x + frame.width &&
      y >= worldPos.y &&
      y <= worldPos.y + frame.height
    ) {
      return frame;
    }
  }

  return null;
}
