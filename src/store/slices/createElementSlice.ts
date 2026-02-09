import type { StateCreator } from 'zustand';
import type { Element, Bounds } from '../../core/engine/types';
import { EDITOR_CONFIG } from '../../constants/editor';

// ============ 辅助函数 ============

function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Slice 接口 ============

export interface ElementSliceState {
  elements: Element[];
}

export interface ElementSliceActions {
  addElement: (element: Omit<Element, 'id' | 'zIndex'>) => string;
  addImage: () => string;
  updateElement: (id: string, updates: Partial<Element>) => void;
  deleteElements: (ids: string[]) => void;
  moveElements: (ids: string[], deltaX: number, deltaY: number) => void;
  resizeElement: (id: string, bounds: Bounds) => void;
  reorderElements: (ids: string[], action: 'front' | 'back' | 'forward' | 'backward') => void;
}

export type ElementSlice = ElementSliceState & ElementSliceActions;

// ============ Slice 创建函数 ============

export const createElementSlice: StateCreator<
  ElementSlice,
  [],
  [],
  ElementSlice
> = (set, get) => ({
  // 初始状态
  elements: [],

  // ========== 元素操作 ==========

  addElement: (element) => {
    const id = generateId();
    const { elements } = get();

    // 如果是 Frame，默认放到最底层 (zIndex 最小)
    // 如果是普通元素，放到最顶层 (zIndex 最大)
    // 如果是文本，放到 2000
    let zIndex;
    if (element.type === 'frame') {
      const minZIndex = elements.reduce((min, el) => Math.min(min, el.zIndex), 0);
      zIndex = minZIndex - 1;
    } else if (element.type === 'text') {
      zIndex = 5000
    } else {
      const maxZIndex = elements.filter(el => el.type !== 'text').reduce((max, el) => Math.max(max, el.zIndex), 0);
      zIndex = maxZIndex + 1;
    }

    set((state) => ({
      elements: [
        ...state.elements,
        { ...element, id, zIndex },
      ],
    }));

    return id;
  },

  addImage: () => {
    const { elements, addElement } = get();
    const images = elements.filter(el => el.type === 'image');

    const gap = EDITOR_CONFIG.LAYOUT.DEFAULT_GAP;
    const maxWidth = EDITOR_CONFIG.LAYOUT.MAX_ROW_WIDTH;
    const imgWidth = Math.floor(
      Math.random() * (EDITOR_CONFIG.IMAGE.WIDTH.MAX - EDITOR_CONFIG.IMAGE.WIDTH.MIN + 1)
    ) + EDITOR_CONFIG.IMAGE.WIDTH.MIN;
    const imgHeight = Math.floor(
      Math.random() * (EDITOR_CONFIG.IMAGE.HEIGHT.MAX - EDITOR_CONFIG.IMAGE.HEIGHT.MIN + 1)
    ) + EDITOR_CONFIG.IMAGE.HEIGHT.MIN;

    let nextX = 0;
    let nextY = 0;

    if (images.length > 0) {
      // Find the "last" image to determine the next position
      // We sort by y then x to find the visually last one in the flow
      const sortedImages = [...images].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 1) return b.x - a.x; // Same row (roughly), sort by x descending
        return b.y - a.y; // Sort by y descending
      });

      const lastImg = sortedImages[0];
      nextX = lastImg.x + lastImg.width + gap;
      nextY = lastImg.y;

      if (nextX + imgWidth > maxWidth) {
        nextX = 0;
        nextY = lastImg.y + lastImg.height + gap;
      }
    }

    const id = addElement({
      type: 'image',
      x: nextX,
      y: nextY,
      width: imgWidth,
      height: imgHeight,
      imageUrl: `https://picsum.photos/seed/${Date.now()}/${imgWidth}/${imgHeight}`,
      style: {
        borderRadius: 4,
        fill: '#f0f0f0',
      },
      name: `Image ${images.length + 1}`,
    });

    return id;
  },

  updateElement: (id, updates) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }));
  },

  deleteElements: (ids) => {
    set((state) => ({
      elements: state.elements.filter((el) => !ids.includes(el.id)),
    }));
  },

  moveElements: (ids, deltaX, deltaY) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        ids.includes(el.id)
          ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
          : el
      ),
    }));
  },

  resizeElement: (id, bounds) => {
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...bounds } : el
      ),
    }));
  },

  reorderElements: (ids, action) => {
    const { elements } = get();
    // 找出共同的 parentId（假设是批量操作，通常是在同一层级）
    const firstElement = elements.find(el => el.id === ids[0]);
    if (!firstElement) return;
    const parentId = firstElement.parentId;

    // 过滤出同一层级的元素并排序
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
        // 保持 ids 的相对顺序，整体放到最下面
        [...ids].reverse().forEach(id => {
          const idx = newElements.findIndex(el => el.id === id);
          if (idx !== -1) newElements[idx] = { ...newElements[idx], zIndex: minZ - count++ };
        });
        break;
      }
      case 'forward':
      case 'backward': {
        // 逐个交换位置 (简化实现: 整体移动)
        // 这里为了简单，只处理单个元素的前后移动
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

    set({ elements: newElements });
  },
});
