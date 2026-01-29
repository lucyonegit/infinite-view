import type { StateCreator } from 'zustand';
import type { Element, Point } from '../../types/editor';

// ============ Slice 接口 ============

export interface FrameSliceState {
  hoverFrameId: string | null;
}

// 依赖其他 Slice 的接口
interface ElementsGetter {
  elements: Element[];
}

export interface FrameSliceActions {
  addToFrame: (elementId: string, frameId: string) => void;
  removeFromFrame: (elementId: string) => void;
  getFrameChildren: (frameId: string) => Element[];
  findFrameAtPoint: (x: number, y: number, excludeIds?: string[]) => Element | null;
  setHoverFrame: (frameId: string | null) => void;
  getElementWorldPos: (id: string) => Point;
  /** 同步元素的 Frame 嵌套状态 (基于鼠标/中心点世界坐标) */
  syncFrameNesting: (elementId: string, worldPos: Point) => void;
}

export type FrameSlice = FrameSliceState & FrameSliceActions;

// 完整 Store 类型 (包含其他 Slice 的依赖)
type FullStore = FrameSlice & ElementsGetter;

// ============ Slice 创建函数 ============

export const createFrameSlice: StateCreator<
  FullStore,
  [],
  [],
  FrameSlice
> = (set, get) => ({
  // 初始状态
  hoverFrameId: null,

  // ========== 辅助逻辑 ==========

  /** 获取元素的世界坐标 */
  getElementWorldPos: (id: string): Point => {
    const { elements } = get();
    const element = elements.find(el => el.id === id);
    if (!element) return { x: 0, y: 0 };

    if (!element.parentId) {
      return { x: element.x, y: element.y };
    }

    const parentPos = get().getElementWorldPos(element.parentId);
    return {
      x: parentPos.x + element.x,
      y: parentPos.y + element.y,
    };
  },

  // ========== Frame 父子关系操作 ==========

  addToFrame: (elementId, frameId) => {
    const { elements, getElementWorldPos } = get();
    const element = elements.find(el => el.id === elementId);
    const frame = elements.find(el => el.id === frameId);

    if (!element || !frame || frame.type !== 'frame') return;
    if (element.parentId === frameId) return; // 已经在这个 frame 中

    // 计算世界坐标
    const worldPos = getElementWorldPos(elementId);
    const frameWorldPos = getElementWorldPos(frameId);

    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === elementId) {
          // 将世界坐标转换为相对于新 frame 的相对坐标
          const relativeX = worldPos.x - frameWorldPos.x;
          const relativeY = worldPos.y - frameWorldPos.y;
          return { ...el, parentId: frameId, x: relativeX, y: relativeY };
        }
        if (el.id === frameId) {
          const children = el.children || [];
          if (!children.includes(elementId)) {
            return { ...el, children: [...children, elementId] };
          }
        }
        if (el.type === 'frame' && el.children?.includes(elementId) && el.id !== frameId) {
          return { ...el, children: el.children.filter(id => id !== elementId) };
        }
        return el;
      }),
    }));
  },

  removeFromFrame: (elementId) => {
    const { getElementWorldPos, elements } = get();
    const element = elements.find(el => el.id === elementId);

    if (!element || !element.parentId) return;

    const oldParentId = element.parentId;
    const worldPos = getElementWorldPos(elementId);

    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === elementId) {
          return { ...el, parentId: undefined, x: worldPos.x, y: worldPos.y };
        }
        if (el.id === oldParentId) {
          return { ...el, children: (el.children || []).filter(id => id !== elementId) };
        }
        return el;
      }),
    }));
  },

  getFrameChildren: (frameId) => {
    const { elements } = get();
    return elements.filter(el => el.parentId === frameId);
  },

  findFrameAtPoint: (x, y, excludeIds = []) => {
    const { elements, getElementWorldPos } = get();
    // 按 zIndex 倒序查找，找到最上层的 frame
    const frames = elements
      .filter(el => el.type === 'frame' && !excludeIds.includes(el.id))
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const frame of frames) {
      const worldPos = getElementWorldPos(frame.id);
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
  },

  // ========== 悬停 Frame 状态 ==========

  setHoverFrame: (frameId) => {
    set({ hoverFrameId: frameId });
  },

  syncFrameNesting: (elementId, mouseWorldPos) => {
    const { elements, findFrameAtPoint, addToFrame, removeFromFrame } = get();
    const element = elements.find(el => el.id === elementId);
    if (!element || element.type === 'frame') return;

    // 仅允许图片和矩形拖入 (按用户要求)
    if (element.type !== 'image' && element.type !== 'rectangle') return;

    // 1. 检查鼠标点下的 Frame (寻找潜在的新父节点)
    const targetFrame = findFrameAtPoint(mouseWorldPos.x, mouseWorldPos.y, [elementId]);

    if (targetFrame) {
      if (element.parentId !== targetFrame.id) {
        addToFrame(elementId, targetFrame.id);
      }
      return;
    }

    // 2. 如果当前在 Frame 中且鼠标已经移出所有 Frame，检查元素是否“完全移出”
    if (element.parentId) {
      const parentFrame = elements.find(el => el.id === element.parentId);
      if (!parentFrame) return;

      // 计算相对于父 Frame 的边界
      const elementRight = element.x + element.width;
      const elementBottom = element.y + element.height;
      const frameRight = parentFrame.width;
      const frameBottom = parentFrame.height;

      const isCompletelyOutside =
        elementRight <= 0 ||
        element.x >= frameRight ||
        elementBottom <= 0 ||
        element.y >= frameBottom;

      if (isCompletelyOutside) {
        removeFromFrame(elementId);
      }
    }
  },
});
