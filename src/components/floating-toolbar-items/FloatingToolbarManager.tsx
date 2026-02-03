import React from 'react';
import type { Element } from '../../types/editor';
import { TextToolBar } from './TextToolBar';
import { ShapeToolBar } from './ShapeToolBar';
import { ImageToolBar } from './ImageToolBar';
import { GroupToolBar } from './GroupToolBar';

interface FloatingToolbarManagerProps {
  element?: Element;
  onExport: () => void;
}

/**
 * FloatingToolbarManager 负责根据选中的元素类型渲染对应的 toolbar
 */
export const FloatingToolbarManager: React.FC<FloatingToolbarManagerProps> = ({ 
  element, 
  onExport 
}) => {
  if (!element) {
    return <GroupToolBar />;
  }

  switch (element.type) {
    case 'text':
      return <TextToolBar element={element} onExport={onExport} />;
    case 'rectangle':
    case 'frame':
      return <ShapeToolBar element={element} onExport={onExport} />;
    case 'image':
      return <ImageToolBar element={element} onExport={onExport} />;
    default:
      return null;
  }
};
