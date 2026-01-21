import { create } from 'zustand';
import type {
  EditorState,
  Element,
  ToolType,
  Viewport,
  InteractionState,
  Point,
  Bounds,
  EditorDataExport,
  ElementType,
} from '../types/editor';

// ============ 初始状态 ============

const initialViewport: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

const initialInteraction: InteractionState = {
  isDragging: false,
  isPanning: false,
  isResizing: false,
  isMarqueeSelecting: false,
  isCreating: false,
};

// ============ 辅助函数 ============

function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Store 接口 ============

interface EditorStore extends EditorState {
  // 视口操作
  setViewport: (viewport: Partial<Viewport>) => void;
  pan: (deltaX: number, deltaY: number) => void;
  zoomTo: (zoom: number, centerX?: number, centerY?: number) => void;
  resetViewport: () => void;

  // 工具操作
  setActiveTool: (tool: ToolType) => void;

  // 元素操作
  addElement: (element: Omit<Element, 'id' | 'zIndex'>) => string;
  addImage: () => string;
  updateElement: (id: string, updates: Partial<Element>) => void;
  deleteElements: (ids: string[]) => void;
  moveElements: (ids: string[], deltaX: number, deltaY: number) => void;
  resizeElement: (id: string, bounds: Bounds) => void;

  // Frame 父子关系操作
  addToFrame: (elementId: string, frameId: string) => void;
  removeFromFrame: (elementId: string) => void;
  getFrameChildren: (frameId: string) => Element[];
  findFrameAtPoint: (x: number, y: number, excludeIds?: string[]) => Element | null;
  reorderElements: (ids: string[], action: 'front' | 'back' | 'forward' | 'backward') => void;

  // 选择操作
  selectElements: (ids: string[], additive?: boolean, event?: MouseEvent | TouchEvent) => void;
  consumeSelectionEvent: () => MouseEvent | TouchEvent | null;
  selectAll: () => void;
  deselectAll: () => void;

  // 交互状态
  setInteraction: (interaction: Partial<InteractionState>) => void;
  startPanning: (startPoint: Point) => void;
  stopPanning: () => void;
  startDragging: (startPoint: Point) => void;
  stopDragging: () => void;
  startMarqueeSelect: (startPoint: Point) => void;
  updateMarqueeSelect: (currentPoint: Point) => void;
  finishMarqueeSelect: () => void;
  startCreating: (type: ElementType, startPoint: Point) => void;
  finishCreating: (endPoint: Point) => Element | null;

  // 数据导入导出 (持久化预留接口)
  exportData: () => EditorDataExport;
  importData: (data: EditorDataExport) => void;

  // 悬停 Frame 状态 (拖动时实时检测)
  setHoverFrame: (frameId: string | null) => void;

  // 内部辅助
  getElementWorldPos: (id: string) => Point;
}

// ============ 创建 Store ============

export const useEditorStore = create<EditorStore>((set, get) => ({
  // 初始状态
  viewport: initialViewport,
  activeTool: 'select',
  elements: [],
  selectedIds: [],
  interaction: initialInteraction,
  hoverFrameId: null,
  lastSelectionEvent: null,

  // ========== 辅助逻辑 ==========

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

  // ========== 视口操作 ==========

  setViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    }));
  },

  pan: (deltaX, deltaY) => {
    set((state) => ({
      viewport: {
        ...state.viewport,
        x: state.viewport.x + deltaX,
        y: state.viewport.y + deltaY,
      },
    }));
  },

  zoomTo: (zoom, centerX, centerY) => {
    const clampedZoom = Math.min(Math.max(zoom, 0.1), 5);
    set((state) => {
      const { viewport } = state;

      // 如果提供了中心点，以该点为中心缩放
      if (centerX !== undefined && centerY !== undefined) {
        const zoomRatio = clampedZoom / viewport.zoom;
        return {
          viewport: {
            x: centerX - (centerX - viewport.x) * zoomRatio,
            y: centerY - (centerY - viewport.y) * zoomRatio,
            zoom: clampedZoom,
          },
        };
      }

      return {
        viewport: { ...viewport, zoom: clampedZoom },
      };
    });
  },

  resetViewport: () => {
    set({ viewport: initialViewport });
  },

  // ========== 工具操作 ==========

  setActiveTool: (tool) => {
    set({ activeTool: tool, selectedIds: tool === 'select' ? get().selectedIds : [] });
  },

  // ========== 辅助逻辑 (内部使用) ==========

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

  // ========== 元素操作 ==========

  addElement: (element) => {
    const id = generateId();
    const { elements } = get();

    // 如果是 Frame，默认放到最底层 (zIndex 最小)
    // 如果是普通元素，放到最顶层 (zIndex 最大)
    let zIndex;
    if (element.type === 'frame') {
      const minZIndex = elements.reduce((min, el) => Math.min(min, el.zIndex), 0);
      zIndex = minZIndex - 1;
    } else {
      const maxZIndex = elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
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

    const gap = 20;
    const maxWidth = 3000;
    const imgWidth = Math.floor(Math.random() * (800 - 200 + 1)) + 200;
    const imgHeight = Math.floor(Math.random() * (450 - 150 + 1)) + 150;

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
      selectedIds: state.selectedIds.filter((id) => !ids.includes(id)),
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

  // ========== 选择操作 ==========

  selectElements: (ids, additive = false, event) => {
    set((state) => ({
      selectedIds: additive
        ? [...new Set([...state.selectedIds, ...ids])]
        : ids,
      lastSelectionEvent: event || null,
    }));
  },

  consumeSelectionEvent: () => {
    const { lastSelectionEvent } = get();
    if (lastSelectionEvent) {
      set({ lastSelectionEvent: null });
    }
    return lastSelectionEvent;
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: state.elements.map((el) => el.id),
      lastSelectionEvent: null,
    }));
  },

  deselectAll: () => {
    set({ selectedIds: [], lastSelectionEvent: null });
  },

  // ========== 交互状态 ==========

  setInteraction: (interaction) => {
    set((state) => ({
      interaction: { ...state.interaction, ...interaction },
    }));
  },

  startPanning: (startPoint) => {
    set({
      interaction: {
        ...initialInteraction,
        isPanning: true,
        startPoint,
      },
    });
  },

  stopPanning: () => {
    set({
      interaction: { ...get().interaction, isPanning: false, startPoint: undefined },
    });
  },

  startDragging: (startPoint) => {
    set({
      interaction: {
        ...get().interaction,
        isDragging: true,
        startPoint,
      },
    });
  },

  stopDragging: () => {
    set({
      interaction: { ...get().interaction, isDragging: false, startPoint: undefined },
    });
  },

  startMarqueeSelect: (startPoint) => {
    set({
      interaction: {
        ...initialInteraction,
        isMarqueeSelecting: true,
        startPoint,
        marqueeRect: { x: startPoint.x, y: startPoint.y, width: 0, height: 0 },
      },
    });
  },

  updateMarqueeSelect: (currentPoint) => {
    const { interaction } = get();
    if (!interaction.startPoint) return;

    const x = Math.min(interaction.startPoint.x, currentPoint.x);
    const y = Math.min(interaction.startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - interaction.startPoint.x);
    const height = Math.abs(currentPoint.y - interaction.startPoint.y);

    set({
      interaction: {
        ...interaction,
        marqueeRect: { x, y, width, height },
      },
    });
  },

  finishMarqueeSelect: () => {
    const { interaction, elements } = get();
    const { marqueeRect } = interaction;

    if (marqueeRect && marqueeRect.width > 5 && marqueeRect.height > 5) {
      // 找出框选范围内的元素
      const selectedIds = elements
        .filter((el) => {
          return (
            el.x < marqueeRect.x + marqueeRect.width &&
            el.x + el.width > marqueeRect.x &&
            el.y < marqueeRect.y + marqueeRect.height &&
            el.y + el.height > marqueeRect.y
          );
        })
        .map((el) => el.id);

      set({ selectedIds, lastSelectionEvent: null });
    }

    set({
      interaction: { ...initialInteraction },
    });
  },

  startCreating: (type, startPoint) => {
    set({
      interaction: {
        ...initialInteraction,
        isCreating: true,
        creatingType: type,
        startPoint,
      },
    });
  },

  finishCreating: (endPoint) => {
    const { interaction } = get();
    if (!interaction.startPoint || !interaction.creatingType) {
      set({ interaction: initialInteraction });
      return null;
    }

    const x = Math.min(interaction.startPoint.x, endPoint.x);
    const y = Math.min(interaction.startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - interaction.startPoint.x);
    const height = Math.abs(endPoint.y - interaction.startPoint.y);

    // 太小的元素不创建
    if (width < 10 || height < 10) {
      set({ interaction: initialInteraction });
      return null;
    }

    const newElement: Omit<Element, 'id' | 'zIndex'> = {
      type: interaction.creatingType,
      x,
      y,
      width,
      height,
      style: {
        fill: interaction.creatingType === 'frame' ? 'rgba(255, 255, 255, 1)' : '#c9c9c9ff',
        stroke: interaction.creatingType === 'frame' ? '#e0e0e0' : undefined,
        strokeWidth: 1,
        borderRadius: 2,
      },
    };

    const id = get().addElement(newElement);
    const element = get().elements.find((el) => el.id === id);

    set({
      interaction: initialInteraction,
      selectedIds: [id],
      activeTool: 'select', // 创建后切换回选择工具
      lastSelectionEvent: null,
    });

    return element || null;
  },

  // ========== 数据导入导出 ==========

  exportData: () => {
    const { viewport, elements } = get();
    return {
      version: '1.0.0',
      viewport,
      elements,
    };
  },

  importData: (data) => {
    if (data.version) {
      set({
        viewport: data.viewport || initialViewport,
        elements: data.elements || [],
        selectedIds: [],
        interaction: initialInteraction,
        hoverFrameId: null,
        lastSelectionEvent: null,
      });
    }
  },

  // ========== 悬停 Frame 状态 ==========

  setHoverFrame: (frameId) => {
    set({ hoverFrameId: frameId });
  },
}));
