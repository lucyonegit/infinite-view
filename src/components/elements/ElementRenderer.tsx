import { memo } from 'react';
import type { Element } from '../../core/types';
import { BasicElementRenderer } from './BasicElementRenderer';
import { FrameRenderer } from './FrameRenderer';
import './ElementRenderer.css';

interface ElementRendererProps {
  element: Element;
  isSelected: boolean;
  zoom?: number;
}

/**
 * 单个元素的渲染器 - 入口组件
 * 根据元素类型路由到对应的渲染器
 */
export const ElementRenderer = memo(function ElementRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: ElementRendererProps) {
  // 如果是 Frame，使用 FrameRenderer
  if (element.type === 'frame') {
    return (
      <FrameRenderer
        element={element}
        isSelected={isSelected}
        zoom={zoom}
      />
    );
  }

  // 其他元素使用 BasicElementRenderer
  return (
    <BasicElementRenderer
      element={element}
      isSelected={isSelected}
    />
  );
});

export default ElementRenderer;
