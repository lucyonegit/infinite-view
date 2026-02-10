import { useEffect } from 'react';
import type { EditorEngine } from '../../../engine/EditorEngine';
import type { Element, Viewport, EditorDataExport } from '../../../engine';

interface UseDataSyncProps {
  engine: EditorEngine;
  elements: Element[];
  viewport: Viewport;
  initialData?: EditorDataExport;
  onDataChange?: (data: EditorDataExport) => void;
}

export function useDataSync({
  engine,
  elements,
  viewport,
  initialData,
  onDataChange,
}: UseDataSyncProps) {
  // 1. Data change notification (debounced)
  useEffect(() => {
    if (!onDataChange) return;
    const timer = setTimeout(() => {
      onDataChange(engine.exportData());
    }, 500);
    return () => clearTimeout(timer);
  }, [elements, viewport, onDataChange, engine]);

  // 2. Initial data import
  useEffect(() => {
    if (initialData) {
      engine.importData(initialData);
    }
  }, [initialData, engine]);
}
