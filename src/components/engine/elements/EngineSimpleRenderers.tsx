import { memo } from 'react';
import type { Element } from '../../../types/editor';

interface EngineImageElementRendererProps {
  element: Element;
}

export const EngineImageElementRenderer = memo(function EngineImageElementRenderer({
  element,
}: EngineImageElementRendererProps) {
  return element.imageUrl ? (
    <img 
      src={element.imageUrl} 
      alt="" 
      draggable={false} 
      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
    />
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
      📷 Image
    </div>
  );
});

export const EngineRectangleElementRenderer = memo(function EngineRectangleElementRenderer() {
  return <div style={{ width: '100%', height: '100%' }} />;
});
