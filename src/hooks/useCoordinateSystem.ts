import { useCallback } from 'react';
import type { Point } from '../core/engine/types';

/**
 * 坐标系统 Hook
 * 提供屏幕坐标与世界坐标之间的转换方法
 * 
 * @param zoom - 当前缩放级别
 * @param viewportX - 视口 X 偏移 (通常为 -scrollLeft)
 * @param viewportY - 视口 Y 偏移 (通常为 -scrollTop)
 * @param containerSelector - 容器选择器，默认为 '.editor-viewer'
 */
export function useCoordinateSystem(
  zoom: number,
  viewportX: number,
  viewportY: number,
  containerSelector: string = '.editor-viewer'
) {
  /**
   * 将屏幕坐标 (clientX, clientY) 转换为世界坐标
   */
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const container = document.querySelector(containerSelector);
      if (!container) {
        return { x: clientX, y: clientY };
      }

      const rect = container.getBoundingClientRect();

      // 世界坐标 = (屏幕坐标 - Container偏移) / zoom - viewport偏移
      // 注意: viewportX/Y 在 store 中是负的 scrollLeft/scrollTop
      return {
        x: (clientX - rect.left) / zoom - viewportX,
        y: (clientY - rect.top) / zoom - viewportY,
      };
    },
    [zoom, viewportX, viewportY, containerSelector]
  );

  /**
   * 将世界坐标转换为屏幕坐标 (反向转换)
   */
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      const container = document.querySelector(containerSelector);
      if (!container) {
        return { x: worldX, y: worldY };
      }

      const rect = container.getBoundingClientRect();

      return {
        x: (worldX + viewportX) * zoom + rect.left,
        y: (worldY + viewportY) * zoom + rect.top,
      };
    },
    [zoom, viewportX, viewportY, containerSelector]
  );

  return { screenToWorld, worldToScreen };
}

export default useCoordinateSystem;
