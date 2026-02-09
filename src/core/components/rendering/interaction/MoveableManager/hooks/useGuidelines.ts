import { useMemo } from 'react';
import type { Element } from '../../../../../engine/types';

interface UseGuidelinesProps {
  elements: Element[];
  selectedIds: string[];
}

export function useGuidelines({ elements, selectedIds }: UseGuidelinesProps) {
  const elementGuidelines = useMemo(() => {
    const selectedElements = selectedIds
      .map((id) => elements.find((el) => el.id === id))
      .filter(Boolean);

    const parentIds = new Set(
      selectedElements
        .map((el) => el!.parentId)
        .filter((id): id is string => id !== undefined)
    );

    return elements
      .filter((el) => {
        if (selectedIds.includes(el.id)) return false;
        if (!el.parentId) return true;
        if (parentIds.has(el.parentId)) return true;
        if (parentIds.has(el.id)) return true;
        return false;
      })
      .map((el) => document.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement)
      .filter(Boolean);
  }, [elements, selectedIds]);

  return elementGuidelines;
}
