import { useMemo, useCallback } from 'react';
import type { Element, Bounds } from '../types/editor';

export interface SnapLine {
  type: 'horizontal' | 'vertical';
  position: number;
  /** 参考元素的 ID */
  referenceId: string;
}

export interface SnapResult {
  /** 吸附后的 x 坐标 */
  x: number;
  /** 吸附后的 y 坐标 */
  y: number;
  /** 活跃的水平吸附线 */
  horizontalLines: SnapLine[];
  /** 活跃的垂直吸附线 */
  verticalLines: SnapLine[];
}

interface UseSnappingOptions {
  /** 吸附阈值（像素） */
  threshold?: number;
  /** 是否启用吸附 */
  enabled?: boolean;
}

/**
 * 吸附功能 Hook
 * 计算元素边缘和中心的对齐吸附
 */
export function useSnapping(
  elements: Element[],
  excludeIds: string[] = [],
  options: UseSnappingOptions = {}
) {
  const { threshold = 5, enabled = true } = options;

  // 计算所有可用的吸附线（排除指定元素）
  const snapLines = useMemo(() => {
    if (!enabled) return { horizontal: [], vertical: [] };

    const horizontal: { position: number; id: string }[] = [];
    const vertical: { position: number; id: string }[] = [];

    elements
      .filter(el => !excludeIds.includes(el.id))
      .forEach(el => {
        // 垂直线（x 坐标）：左边缘、中心、右边缘
        vertical.push(
          { position: el.x, id: el.id },
          { position: el.x + el.width / 2, id: el.id },
          { position: el.x + el.width, id: el.id }
        );
        // 水平线（y 坐标）：上边缘、中心、下边缘
        horizontal.push(
          { position: el.y, id: el.id },
          { position: el.y + el.height / 2, id: el.id },
          { position: el.y + el.height, id: el.id }
        );
      });

    return { horizontal, vertical };
  }, [elements, excludeIds, enabled]);

  /**
   * 计算吸附结果
   * @param bounds 当前拖拽元素的边界
   * @returns 吸附后的位置和活跃的吸附线
   */
  const snap = useCallback(
    (bounds: Bounds): SnapResult => {
      if (!enabled) {
        return {
          x: bounds.x,
          y: bounds.y,
          horizontalLines: [],
          verticalLines: [],
        };
      }

      let snappedX = bounds.x;
      let snappedY = bounds.y;
      const activeHorizontalLines: SnapLine[] = [];
      const activeVerticalLines: SnapLine[] = [];

      // 当前元素的关键点（x 坐标）
      const currentXPoints = [
        bounds.x,                      // 左边缘
        bounds.x + bounds.width / 2,   // 中心
        bounds.x + bounds.width,       // 右边缘
      ];

      // 当前元素的关键点（y 坐标）
      const currentYPoints = [
        bounds.y,                       // 上边缘
        bounds.y + bounds.height / 2,   // 中心
        bounds.y + bounds.height,       // 下边缘
      ];

      // 检查垂直对齐（x 方向吸附）
      let minXDiff = threshold;
      for (const line of snapLines.vertical) {
        for (let i = 0; i < currentXPoints.length; i++) {
          const diff = Math.abs(currentXPoints[i] - line.position);
          if (diff < minXDiff) {
            minXDiff = diff;
            // 根据是哪个关键点对齐，计算偏移
            if (i === 0) snappedX = line.position;
            else if (i === 1) snappedX = line.position - bounds.width / 2;
            else snappedX = line.position - bounds.width;

            activeVerticalLines.length = 0;
            activeVerticalLines.push({
              type: 'vertical',
              position: line.position,
              referenceId: line.id,
            });
          } else if (diff === minXDiff && diff < threshold) {
            // 添加同等距离的吸附线
            activeVerticalLines.push({
              type: 'vertical',
              position: line.position,
              referenceId: line.id,
            });
          }
        }
      }

      // 检查水平对齐（y 方向吸附）
      let minYDiff = threshold;
      for (const line of snapLines.horizontal) {
        for (let i = 0; i < currentYPoints.length; i++) {
          const diff = Math.abs(currentYPoints[i] - line.position);
          if (diff < minYDiff) {
            minYDiff = diff;
            if (i === 0) snappedY = line.position;
            else if (i === 1) snappedY = line.position - bounds.height / 2;
            else snappedY = line.position - bounds.height;

            activeHorizontalLines.length = 0;
            activeHorizontalLines.push({
              type: 'horizontal',
              position: line.position,
              referenceId: line.id,
            });
          } else if (diff === minYDiff && diff < threshold) {
            activeHorizontalLines.push({
              type: 'horizontal',
              position: line.position,
              referenceId: line.id,
            });
          }
        }
      }

      return {
        x: snappedX,
        y: snappedY,
        horizontalLines: activeHorizontalLines,
        verticalLines: activeVerticalLines,
      };
    },
    [snapLines, threshold, enabled]
  );

  return { snap };
}
