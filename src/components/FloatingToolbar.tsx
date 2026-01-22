import { memo } from 'react';
import './FloatingToolbar.css';

interface FloatingToolbarProps {
  /** 浮动的坐标 (基于视口或 Canvas) */
  x: number;
  y: number;
  /** 导出回调 */
  onExport: () => void;
}

/**
 * 浮动工具栏 - 当元素被选中时展示在顶部居中
 */
export const FloatingToolbar = memo(function FloatingToolbar({ 
  x, 
  y, 
  onExport,
}: FloatingToolbarProps) {
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
        <div className="toolbar-group">
          <button className="toolbar-item" title="放大">
            <span className="icon">HD</span>
            <span className="label">放大</span>
          </button>
          <div className="divider" />
          <button className="toolbar-item" title="移除背景">
            <span className="icon">🖼️</span>
            <span className="label">移除背景</span>
          </button>
          <button className="toolbar-item" title="Mockup">
            <span className="icon">👕</span>
            <span className="label">Mockup</span>
          </button>
          <button className="toolbar-item" title="擦除">
            <span className="icon">🧹</span>
            <span className="label">擦除</span>
          </button>
          <div className="divider" />
          <button className="toolbar-item" title="编辑元素">
            <span className="icon">⚙️</span>
            <span className="label">编辑元素</span>
          </button>
          <button className="toolbar-item" title="编辑文字">
            <span className="icon">T</span>
            <span className="label">编辑文字</span>
            <span className="badge">New</span>
          </button>
          <button className="toolbar-item" title="扩展">
            <span className="icon">⤢</span>
            <span className="label">扩展</span>
          </button>
          <button className="toolbar-item more" title="更多">
            <span className="icon">...</span>
          </button>
          <div className="divider" />
          <button 
            className="toolbar-item export-action" 
            title="导出图片"
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
          >
            <span className="icon">⬇️</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default FloatingToolbar;
