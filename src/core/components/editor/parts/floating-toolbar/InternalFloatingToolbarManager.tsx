import React from 'react';
import type { Element } from '../../../../engine/types';
import { InternalTextToolBar } from './InternalTextToolBar';
import { InternalShapeToolBar } from './InternalShapeToolBar';
import { InternalImageToolBar, InternalGroupToolBar } from './InternalImageAndGroupToolBars';

interface InternalFloatingToolbarManagerProps {
  element?: Element;
  onExport: () => void;
  extra?: React.ReactNode;
}

/**
 * InternalFloatingToolbarManager - 负责根据选中的元素类型渲染对应的 toolbar
 */
export const InternalFloatingToolbarManager: React.FC<InternalFloatingToolbarManagerProps> = ({ 
  element, 
  onExport,
  extra
}) => {
  const renderToolbar = () => {
    if (!element) {
      return <InternalGroupToolBar />;
    }

    switch (element.type) {
      case 'text':
        return <InternalTextToolBar element={element} onExport={onExport} />;
      case 'rectangle':
      case 'frame':
        return <InternalShapeToolBar element={element} onExport={onExport} />;
      case 'image':
        return <InternalImageToolBar element={element} onExport={onExport} />;
      default:
        return null;
    }
  };

  return (
    <>
      {renderToolbar()}
      {extra && (
        <>
          <div className="divider" />
          {extra}
        </>
      )}
    </>
  );
};
