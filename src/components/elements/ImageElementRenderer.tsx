import { memo } from 'react';
import type { Element } from '../../core/types';

interface ImageElementRendererProps {
  element: Element;
}

export const ImageElementRenderer = memo(function ImageElementRenderer({
  element,
}: ImageElementRendererProps) {
  return element.imageUrl ? (
    <img src={element.imageUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
      📷 Image
    </div>
  );
});
