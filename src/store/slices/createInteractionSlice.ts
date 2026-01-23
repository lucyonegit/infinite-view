import type { StateCreator } from 'zustand';
import type { InteractionState, ToolType, ElementType, Point, Element } from '../../types/editor';

// ============ 初始状态 ============

const initialInteraction: InteractionState = {
  isDragging: false,
  isPanning: false,
  isResizing: false,
  isMarqueeSelecting: false,
  isCreating: false,
  editingId: null,
};

// ============ Slice 接口 ============

export interface InteractionSliceState {
  activeTool: ToolType;
  selectedIds: string[];
  interaction: InteractionState;
  lastSelectionEvent: MouseEvent | TouchEvent | null;
}

// 依赖其他 Slice 的接口
interface ElementsGetter {
  elements: Element[];
}

interface AddElementAction {
  addElement: (element: Omit<Element, 'id' | 'zIndex'>) => string;
}

export interface InteractionSliceActions {
  setActiveTool: (tool: ToolType) => void;
  selectElements: (ids: string[], additive?: boolean, event?: MouseEvent | TouchEvent) => void;
  consumeSelectionEvent: () => MouseEvent | TouchEvent | null;
  selectAll: () => void;
  deselectAll: () => void;
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
  setEditingId: (id: string | null) => void;
}

export type InteractionSlice = InteractionSliceState & InteractionSliceActions;

// 完整 Store 类型 (包含其他 Slice 的依赖)
type FullStore = InteractionSlice & ElementsGetter & AddElementAction;

// ============ Slice 创建函数 ============

export const createInteractionSlice: StateCreator<
  FullStore,
  [],
  [],
  InteractionSlice
> = (set, get) => ({
  // 初始状态
  activeTool: 'select',
  selectedIds: [],
  interaction: initialInteraction,
  lastSelectionEvent: null,

  // ========== 工具操作 ==========

  setActiveTool: (tool) => {
    set({ activeTool: tool, selectedIds: tool === 'select' ? get().selectedIds : [] });
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
    set(() => ({
      selectedIds: get().elements.map((el) => el.id),
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
    set((state) => ({
      interaction: { ...state.interaction, isPanning: false, startPoint: undefined },
    }));
  },

  startDragging: (startPoint) => {
    set((state) => ({
      interaction: {
        ...state.interaction,
        isDragging: true,
        startPoint,
      },
    }));
  },

  stopDragging: () => {
    set((state) => ({
      interaction: { ...state.interaction, isDragging: false, startPoint: undefined },
    }));
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
    const { interaction, addElement } = get();
    if (!interaction.startPoint || !interaction.creatingType) {
      set({ interaction: initialInteraction });
      return null;
    }

    const x = Math.min(interaction.startPoint.x, endPoint.x);
    const y = Math.min(interaction.startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - interaction.startPoint.x);
    const height = Math.abs(endPoint.y - interaction.startPoint.y);

    // 如果高度或宽度太小，且不是文本工具，则不创建
    // 文本工具允许点击创建，所以即便大小近乎为 0 也允许
    const isClick = width < 5 && height < 5;
    if (interaction.creatingType !== 'text' && isClick) {
      set({ interaction: initialInteraction });
      return null;
    }

    const newElement: Omit<Element, 'id' | 'zIndex'> = {
      type: interaction.creatingType,
      x: isClick ? interaction.startPoint.x : x,
      y: isClick ? interaction.startPoint.y : y,
      width: isClick ? (interaction.creatingType === 'text' ? 10 : width) : width,
      height: isClick ? (interaction.creatingType === 'text' ? 30 : height) : height,
      style: {
        fill: interaction.creatingType === 'frame' ? 'rgba(255, 255, 255, 1)' : '#c9c9c9ff',
        stroke: interaction.creatingType === 'frame' ? '#e0e0e0' : undefined,
        strokeWidth: 1,
        borderRadius: 2,
        fontSize: interaction.creatingType === 'text' ? 24 : undefined,
      },
      fixedWidth: interaction.creatingType === 'text' ? false : undefined, // 初始不固定宽度
    };

    const id = addElement(newElement);
    const element = get().elements.find((el) => el.id === id);

    set({
      interaction: initialInteraction,
      selectedIds: [id],
      activeTool: 'select', // 创建后切换回选择工具
      lastSelectionEvent: null,
    });

    return element || null;
  },

  setEditingId: (id) => {
    set((state) => ({
      interaction: { ...state.interaction, editingId: id },
    }));
  },
});
