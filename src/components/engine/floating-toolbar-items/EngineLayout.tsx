import React, { type ReactNode } from 'react';
import './EngineFloatingToolbar.css';

interface EngineLayoutProps {
  x: number;
  y: number;
  children: ReactNode;
}

/**
 * EngineLayout - 浮动工具栏布局容器
 */
export const EngineLayout: React.FC<EngineLayoutProps> = ({ x, y, children }) => {
  return (
    <div 
      className="floating-toolbar-container"
      style={{
        left: x,
        top: y,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="floating-toolbar">
        {children}
      </div>
    </div>
  );
};

export default EngineLayout;
