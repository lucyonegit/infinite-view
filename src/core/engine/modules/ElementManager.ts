import type { Element, Bounds } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ElementManager {
  public static addElement(elements: Element[], element: Omit<Element, 'id' | 'zIndex'>): { id: string, elements: Element[] } {
    const id = uuidv4();
    let zIndex;

    if (element.type === 'frame') {
      const minZIndex = elements.reduce((min, el) => Math.min(min, el.zIndex), 0);
      zIndex = minZIndex - 1;
    } else {
      const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
      zIndex = maxZIndex + 1;
    }

    return {
      id,
      elements: [...elements, { ...element, id, zIndex } as Element]
    };
  }

  public static updateElement(elements: Element[], id: string, updates: Partial<Element>): Element[] {
    return elements.map(el => el.id === id ? { ...el, ...updates } : el);
  }

  public static deleteElements(elements: Element[], ids: string[]): Element[] {
    return elements.filter(el => !ids.includes(el.id));
  }

  public static moveElements(elements: Element[], ids: string[], deltaX: number, deltaY: number): Element[] {
    return elements.map(el =>
      ids.includes(el.id) ? { ...el, x: el.x + deltaX, y: el.y + deltaY } : el
    );
  }

  public static resizeElement(elements: Element[], id: string, bounds: Bounds): Element[] {
    return elements.map(el => el.id === id ? { ...el, ...bounds } : el);
  }

  public static reorderElements(elements: Element[], ids: string[], action: 'front' | 'back' | 'forward' | 'backward'): Element[] {
    const firstElement = elements.find(el => el.id === ids[0]);
    if (!firstElement) return elements;
    const parentId = firstElement.parentId;

    const sameLevelElements = elements
      .filter(el => el.parentId === parentId)
      .sort((a, b) => a.zIndex - b.zIndex);

    const newElements = [...elements];

    switch (action) {
      case 'front': {
        const maxZ = Math.max(...sameLevelElements.map(el => el.zIndex), 0);
        let count = 1;
        ids.forEach(id => {
          const idx = newElements.findIndex(el => el.id === id);
          if (idx !== -1) newElements[idx] = { ...newElements[idx], zIndex: maxZ + count++ };
        });
        break;
      }
      case 'back': {
        const minZ = Math.min(...sameLevelElements.map(el => el.zIndex), 0);
        let count = 1;
        [...ids].reverse().forEach(id => {
          const idx = newElements.findIndex(el => el.id === id);
          if (idx !== -1) newElements[idx] = { ...newElements[idx], zIndex: minZ - count++ };
        });
        break;
      }
      case 'forward':
      case 'backward': {
        if (ids.length !== 1) break;
        const targetId = ids[0];
        const currentIdx = sameLevelElements.findIndex(el => el.id === targetId);
        const swapIdx = action === 'forward' ? currentIdx + 1 : currentIdx - 1;

        if (swapIdx >= 0 && swapIdx < sameLevelElements.length) {
          const swapElement = sameLevelElements[swapIdx];
          const targetElement = sameLevelElements[currentIdx];

          const idx1 = newElements.findIndex(el => el.id === targetElement.id);
          const idx2 = newElements.findIndex(el => el.id === swapElement.id);

          const tempZ = newElements[idx1].zIndex;
          newElements[idx1] = { ...newElements[idx1], zIndex: newElements[idx2].zIndex };
          newElements[idx2] = { ...newElements[idx2], zIndex: tempZ };
        }
        break;
      }
    }

    return newElements;
  }
}
