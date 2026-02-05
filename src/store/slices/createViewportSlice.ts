import type { StateCreator } from 'zustand';
import type { Viewport } from '../../core/types';
import { EDITOR_CONFIG } from '../../constants/editor';

// ============ Slice 状态接口 ============

export interface ViewportSliceState {
  viewport: Viewport;
}

export interface ViewportSliceActions {
  setViewport: (viewport: Partial<Viewport>) => void;
  pan: (deltaX: number, deltaY: number) => void;
  zoomTo: (zoom: number, centerX?: number, centerY?: number) => void;
  resetViewport: () => void;
}

export type ViewportSlice = ViewportSliceState & ViewportSliceActions;

// ============ 初始状态 ============

const initialViewport: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

// ============ Slice 创建函数 ============

export const createViewportSlice: StateCreator<
  ViewportSlice,
  [],
  [],
  ViewportSlice
> = (set) => ({
  // 初始状态
  viewport: initialViewport,

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
    const clampedZoom = Math.min(
      Math.max(zoom, EDITOR_CONFIG.ZOOM.MIN),
      EDITOR_CONFIG.ZOOM.MAX
    );
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
});
