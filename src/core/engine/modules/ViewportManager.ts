import type { Viewport } from '../types';
import { EDITOR_CONFIG } from '../../../constants/editor';

export class ViewportManager {
  public static setViewport(current: Viewport, updates: Partial<Viewport>): Viewport {
    return { ...current, ...updates };
  }

  public static pan(current: Viewport, deltaX: number, deltaY: number): Viewport {
    return {
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    };
  }

  public static zoomTo(current: Viewport, zoom: number, centerX?: number, centerY?: number): Viewport {
    const clampedZoom = Math.min(
      Math.max(zoom, EDITOR_CONFIG.ZOOM.MIN),
      EDITOR_CONFIG.ZOOM.MAX
    );

    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = clampedZoom / current.zoom;
      return {
        x: centerX - (centerX - current.x) * zoomRatio,
        y: centerY - (centerY - current.y) * zoomRatio,
        zoom: clampedZoom,
      };
    }

    return { ...current, zoom: clampedZoom };
  }
}
