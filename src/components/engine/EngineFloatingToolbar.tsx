import { memo } from 'react';
import type { Element } from '../../types/editor';
import { EngineLayout } from './floating-toolbar-items/EngineLayout';
import { EngineFloatingToolbarManager } from './floating-toolbar-items/EngineFloatingToolbarManager';

interface EngineFloatingToolbarProps {
  x: number;
  y: number;
  element?: Element;
  onExport: () => void;
}

/**
 * EngineFloatingToolbar - 基于 EditorEngine 的浮动工具栏
 */
export const EngineFloatingToolbar = memo(function EngineFloatingToolbar({ 
  x, 
  y, 
  element,
  onExport,
}: EngineFloatingToolbarProps) {
  return (
    <EngineLayout x={x} y={y}>
      <EngineFloatingToolbarManager 
        element={element}
        onExport={onExport}
      />
    </EngineLayout>
  );
});

export default EngineFloatingToolbar;
