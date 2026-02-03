import { create } from 'zustand';
import type {
  Viewport,
  InteractionState,
  EditorDataExport,
} from '../types/editor';

import { createViewportSlice, type ViewportSlice } from './slices/createViewportSlice';
import { createElementSlice, type ElementSlice } from './slices/createElementSlice';
import { createInteractionSlice, type InteractionSlice } from './slices/createInteractionSlice';
import { createFrameSlice, type FrameSlice } from './slices/createFrameSlice';
import { createFontSlice, type FontSlice } from './slices/createFontSlice';

// ============ 组合 Store 接口 ============

/**
 * 完整的 EditorStore 类型，由所有 Slice 组合而成
 */
interface EditorStore extends
  ViewportSlice,
  ElementSlice,
  InteractionSlice,
  FrameSlice,
  FontSlice {
  // 数据导入导出 (持久化预留接口)
  exportData: () => EditorDataExport;
  importData: (data: EditorDataExport) => void;
}

// ============ 初始状态 (用于 importData) ============

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

// ============ 创建 Store ============

export const useEditorStore = create<EditorStore>()((...args) => {
  const [set, get] = args;

  return {
    // 组合所有 Slice
    ...createViewportSlice(...args),
    ...createElementSlice(...args),
    ...createInteractionSlice(...args),
    ...createFrameSlice(...args),
    ...createFontSlice(...args),

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
  };
});
