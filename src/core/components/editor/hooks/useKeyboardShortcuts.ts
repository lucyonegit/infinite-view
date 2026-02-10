import { useEffect } from 'react';
import type { EditorEngine } from '../../../engine/EditorEngine';

interface UseKeyboardShortcutsProps {
  engine: EditorEngine;
  selectedIds: string[];
}

export function useKeyboardShortcuts({ engine, selectedIds }: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) return;

      if (selectedIds.length > 0) {
        if (e.key === '[' || e.key === '［') {
          engine.reorderElements(selectedIds, e.altKey ? 'back' : 'backward');
        } else if (e.key === ']' || e.key === '］') {
          engine.reorderElements(selectedIds, e.altKey ? 'front' : 'forward');
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          engine.deleteElements(selectedIds);
        } else if (e.key === 'Escape') {
          engine.deselectAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, engine]);
}
