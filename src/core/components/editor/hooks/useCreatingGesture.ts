import { useEffect } from 'react';
import type { EditorEngine } from '../../../engine/EditorEngine';
import type { ToolType, Point } from '../../../engine/types';

interface UseCreatingGestureProps {
  engine: EditorEngine;
  activeTool: ToolType;
  interaction: { isCreating: boolean; startPoint?: Point };
  screenToWorld: (x: number, y: number) => Point;
  viewerRef: React.RefObject<any>;
  setCreatingPreview: (preview: { x: number; y: number; width: number; height: number } | null) => void;
}

export function useCreatingGesture({
  engine,
  activeTool,
  interaction,
  screenToWorld,
  viewerRef,
  setCreatingPreview,
}: UseCreatingGestureProps) {
  useEffect(() => {
    if (activeTool === 'select' || activeTool === 'hand') {
      requestAnimationFrame(() => {
        setCreatingPreview(null);
      });
      return;
    }

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const viewer = viewerRef.current;
      if (!viewer) return;
      const container = viewer.getContainer();
      const rect = container.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      if (interaction.isCreating) return;

      const worldPoint = screenToWorld(e.clientX, e.clientY);
      engine.startCreating(activeTool === 'text' ? 'text' : activeTool === 'frame' ? 'frame' : 'rectangle', worldPoint);
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!interaction.isCreating || !interaction.startPoint) return;
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      const x = Math.min(interaction.startPoint.x, worldPoint.x);
      const y = Math.min(interaction.startPoint.y, worldPoint.y);
      const width = Math.abs(worldPoint.x - interaction.startPoint.x);
      const height = Math.abs(worldPoint.y - interaction.startPoint.y);
      setCreatingPreview({ x, y, width, height });
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (!interaction.isCreating || !interaction.startPoint) return;
      const worldPoint = screenToWorld(e.clientX, e.clientY);
      engine.finishCreating(worldPoint);
      setCreatingPreview(null);
    };

    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [activeTool, interaction.isCreating, interaction.startPoint, screenToWorld, engine, viewerRef, setCreatingPreview]);
}
