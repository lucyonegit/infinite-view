import { memo } from 'react';
import type { Element } from '../core/types';
import { Layout, FloatingToolbarManager } from './floating-toolbar-items';

interface FloatingToolbarProps {
  /** 浮动的坐标 (基于视口或 Canvas) */
  x: number;
  y: number;
  /** 当前选中的单个元素 */
  element?: Element;
  /** 导出回调 */
  onExport: () => void;
}

/**
 * 浮动工具栏 - 当元素被选中时展示在顶部居中
 * 已重构：逻辑拆分到 components/floating-toolbar-items 目录下
 */
export const FloatingToolbar = memo(function FloatingToolbar({ 
  x, 
  y, 
  element,
  onExport,
}: FloatingToolbarProps) {
  return (
    <Layout x={x} y={y}>
      <FloatingToolbarManager 
        element={element}
        onExport={onExport}
      />
    </Layout>
  );
});

export default FloatingToolbar;
