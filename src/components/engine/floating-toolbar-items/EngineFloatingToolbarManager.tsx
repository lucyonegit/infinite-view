import React from 'react';
import type { Element } from '../../../types/editor';
import { EngineTextToolBar } from './EngineTextToolBar';
import { EngineShapeToolBar } from './EngineShapeToolBar';
import { EngineImageToolBar, EngineGroupToolBar } from './EngineImageAndGroupToolBars';

interface EngineFloatingToolbarManagerProps {
  element?: Element;
  onExport: () => void;
}

/**
 * EngineFloatingToolbarManager - 负责根据选中的元素类型渲染对应的 toolbar
 */
export const EngineFloatingToolbarManager: React.FC<EngineFloatingToolbarManagerProps> = ({ 
  element, 
  onExport 
}) => {
  if (!element) {
    return <EngineGroupToolBar />;
  }

  switch (element.type) {
    case 'text':
      return <EngineTextToolBar element={element} onExport={onExport} />;
    case 'rectangle':
    case 'frame':
      return <EngineShapeToolBar element={element} onExport={onExport} />;
    case 'image':
      return <EngineImageToolBar element={element} onExport={onExport} />;
    default:
      return null;
  }
};

export default EngineFloatingToolbarManager;
