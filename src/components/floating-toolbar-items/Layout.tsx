import React, { type ReactNode } from 'react';
import '../FloatingToolbar.css';

interface LayoutProps {
  x: number;
  y: number;
  children: ReactNode;
}

/**
 * Layout 组件负责控制 toolbar 的位置和动画容器
 */
export const Layout: React.FC<LayoutProps> = ({ x, y, children }) => {
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
