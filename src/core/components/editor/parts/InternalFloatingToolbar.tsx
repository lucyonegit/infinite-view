import { memo } from 'react';
import type { Element } from '../../../engine/types';
import { InternalLayout } from './floating-toolbar/InternalLayout';
import { InternalFloatingToolbarManager } from './floating-toolbar/InternalFloatingToolbarManager';

interface InternalFloatingToolbarProps {
  x: number;
  y: number;
  element?: Element;
  onExport: () => void;
  extra?: React.ReactNode;
}

/**
 * InternalFloatingToolbar - 基于 EditorEngine 的浮动工具栏
 */
export const InternalFloatingToolbar = memo(function InternalFloatingToolbar({ 
  x, 
  y, 
  element,
  onExport,
  extra
}: InternalFloatingToolbarProps) {
  return (
    <InternalLayout x={x} y={y}>
      <InternalFloatingToolbarManager 
        element={element}
        onExport={onExport}
        extra={extra}
      />
    </InternalLayout>
  );
});
