import { useCallback, useRef, useEffect } from 'react';
import type { Point } from '../../engine/types';

export function useCoordinateSystem(
  zoom: number,
  viewportX: number,
  viewportY: number,
  containerSelector: string = '.editor-viewer'
) {
  const containerRef = useRef<Element | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  // Cache the container and its rect
  useEffect(() => {
    containerRef.current = document.querySelector(containerSelector);
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }

    // Update rect on resize
    const handleResize = () => {
      if (containerRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerSelector]);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = rectRef.current;
      if (!rect) return { x: clientX, y: clientY };

      return {
        x: (clientX - rect.left) / zoom - viewportX,
        y: (clientY - rect.top) / zoom - viewportY,
      };
    },
    [zoom, viewportX, viewportY]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point => {
      const rect = rectRef.current;
      if (!rect) return { x: worldX, y: worldY };

      return {
        x: (worldX + viewportX) * zoom + rect.left,
        y: (worldY + viewportY) * zoom + rect.top,
      };
    },
    [zoom, viewportX, viewportY]
  );

  return { screenToWorld, worldToScreen };
}

export default useCoordinateSystem;
