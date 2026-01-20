import { create } from 'zustand';
import type {
  CanvasState,
  CanvasElement,
  ToolType,
  Viewport,
  InteractionState,
  Point,
  Bounds,
  CanvasDataExport,
  ElementType,
} from '../types/canvas';

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

interface CanvasStore extends CanvasState {
  // 视口操作
  setViewport: (viewport: Partial<Viewport>) => void;
  pan: (deltaX: number, deltaY: number) => void;
  zoomTo: (zoom: number, centerX?: number, centerY?: number) => void;
  resetViewport: () => void;

  // 工具操作
  setActiveTool: (tool: ToolType) => void;

  // 元素操作
  addElement: (element: Omit<CanvasElement, 'id' | 'zIndex'>) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElements: (ids: string[]) => void;
  moveElements: (ids: string[], deltaX: number, deltaY: number) => void;
  resizeElement: (id: string, bounds: Bounds) => void;

  // Frame 父子关系操作
  addToFrame: (elementId: string, frameId: string) => void;
  removeFromFrame: (elementId: string) => void;
  getFrameChildren: (frameId: string) => CanvasElement[];
  findFrameAtPoint: (x: number, y: number, excludeIds?: string[]) => CanvasElement | null;

  // 选择操作
  selectElements: (ids: string[], additive?: boolean) => void;
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
  finishCreating: (endPoint: Point) => CanvasElement | null;

  // 数据导入导出 (持久化预留接口)
  exportData: () => CanvasDataExport;
  importData: (data: CanvasDataExport) => void;

  // 悬停 Frame 状态 (拖动时实时检测)
  setHoverFrame: (frameId: string | null) => void;
}

// ============ 创建 Store ============

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // 初始状态
  viewport: initialViewport,
  activeTool: 'select',
  elements: [],
  selectedIds: [],
  interaction: initialInteraction,
  hoverFrameId: null,

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

  // ========== 元素操作 ==========

  addElement: (element) => {
    const id = generateId();
    const maxZIndex = get().elements.reduce((max, el) => Math.max(max, el.zIndex), 0);

    set((state) => ({
      elements: [
        ...state.elements,
        { ...element, id, zIndex: maxZIndex + 1 },
      ],
    }));

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
    const { elements } = get();
    const element = elements.find(el => el.id === elementId);
    const frame = elements.find(el => el.id === frameId);

    if (!element || !frame || frame.type !== 'frame') return;
    if (element.parentId === frameId) return; // 已经在这个 frame 中

    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === elementId) {
          // 设置元素的 parentId
          return { ...el, parentId: frameId };
        }
        if (el.id === frameId) {
          // 更新 frame 的 children 列表
          const children = el.children || [];
          if (!children.includes(elementId)) {
            return { ...el, children: [...children, elementId] };
          }
        }
        // 如果元素之前在其他 frame 中，从那个 frame 移除
        if (el.type === 'frame' && el.children?.includes(elementId) && el.id !== frameId) {
          return { ...el, children: el.children.filter(id => id !== elementId) };
        }
        return el;
      }),
    }));
  },

  removeFromFrame: (elementId) => {
    const { elements } = get();
    const element = elements.find(el => el.id === elementId);

    if (!element || !element.parentId) return;

    const oldParentId = element.parentId;

    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id === elementId) {
          return { ...el, parentId: undefined };
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
    const { elements } = get();
    // 按 zIndex 倒序查找，找到最上层的 frame
    const frames = elements
      .filter(el => el.type === 'frame' && !excludeIds.includes(el.id))
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const frame of frames) {
      if (
        x >= frame.x &&
        x <= frame.x + frame.width &&
        y >= frame.y &&
        y <= frame.y + frame.height
      ) {
        return frame;
      }
    }
    return null;
  },

  // ========== 选择操作 ==========

  selectElements: (ids, additive = false) => {
    set((state) => ({
      selectedIds: additive
        ? [...new Set([...state.selectedIds, ...ids])]
        : ids,
    }));
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: state.elements.map((el) => el.id),
    }));
  },

  deselectAll: () => {
    set({ selectedIds: [] });
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

      set({ selectedIds });
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

    const newElement: Omit<CanvasElement, 'id' | 'zIndex'> = {
      type: interaction.creatingType,
      x,
      y,
      width,
      height,
      style: {
        fill: '#ffffff',
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
      });
    }
  },

  // ========== 悬停 Frame 状态 ==========

  setHoverFrame: (frameId) => {
    set({ hoverFrameId: frameId });
  },
}));
