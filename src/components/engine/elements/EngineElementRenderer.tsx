import { memo } from 'react';
import type { Element } from '../../../core/types';
import { EngineBasicElementRenderer } from './EngineBasicElementRenderer';
import { EngineFrameRenderer } from './EngineFrameRenderer';
import '../../elements/ElementRenderer.css';

interface EngineElementRendererProps {
  element: Element;
  isSelected: boolean;
  zoom?: number;
}

/**
 * EngineElementRenderer - 基于 EditorEngine 的元素渲染器
 */
export const EngineElementRenderer = memo(function EngineElementRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: EngineElementRendererProps) {
  if (element.type === 'frame') {
    return (
      <EngineFrameRenderer
        element={element}
        isSelected={isSelected}
        zoom={zoom}
      />
    );
  }

  return (
    <EngineBasicElementRenderer
      element={element}
      isSelected={isSelected}
    />
  );
});

export default EngineElementRenderer;
