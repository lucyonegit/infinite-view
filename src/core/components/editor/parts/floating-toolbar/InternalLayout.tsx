import React, { type ReactNode } from 'react';
import './InternalFloatingToolbar.css';

interface InternalLayoutProps {
  x: number;
  y: number;
  children: ReactNode;
}

/**
 * InternalLayout - 浮动工具栏布局容器
 */
export const InternalLayout: React.FC<InternalLayoutProps> = ({ x, y, children }) => {
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
