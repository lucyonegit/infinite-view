import { memo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { Element } from '../types/editor';
import './FloatingToolbar.css';

interface FloatingToolbarProps {
  /** 浮动的坐标 (基于视口或 Canvas) */
  x: number;
  y: number;
  /** 当前选中的单个元素 */
  element?: Element;
  /** 导出回调 */
  onExport: () => void;
}

const COLORS = [
  '#333333', '#ffffff', '#ff4d4f', '#52c41a', '#1890ff', '#fadb14', '#722ed1', '#eb2f96'
];

/**
 * 浮动工具栏 - 当元素被选中时展示在顶部居中
 */
export const FloatingToolbar = memo(function FloatingToolbar({ 
  x, 
  y, 
  element,
  onExport,
}: FloatingToolbarProps) {
  const { updateElement } = useEditorStore();
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    if (element) {
      updateElement(element.id, {
        style: { ...element.style, ...updates }
      });
    }
  };

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
      {showColorPicker && (
        <div className="color-picker-bubble">
          {COLORS.map(color => (
            <button
              key={color}
              className="color-swatch"
              style={{ backgroundColor: color }}
              onClick={() => {
                if (element?.type === 'text') {
                  if (showColorPicker === 'text') handleUpdateStyle({ fill: color });
                  else handleUpdateStyle({ backgroundColor: color });
                } else {
                  // 矩形和 Frame 直接修改 fill
                  handleUpdateStyle({ fill: color });
                }
                setShowColorPicker(null);
              }}
            />
          ))}
          <button 
            className="color-swatch transparent" 
            title="Transparent"
            onClick={() => {
              if (element?.type === 'text') {
                if (showColorPicker === 'bg') handleUpdateStyle({ backgroundColor: 'transparent' });
              } else {
                // 矩形和 Frame 直接将 fill 设为透明
                handleUpdateStyle({ fill: 'transparent' });
              }
              setShowColorPicker(null);
            }}
          />
        </div>
      )}
      <div className="floating-toolbar">
        <div className="toolbar-group">
          {/* 矩形和 Frame 的背景色控制 */}
          {(element?.type === 'rectangle' || element?.type === 'frame') && (
            <button 
              className={`toolbar-item ${showColorPicker === 'bg' ? 'active' : ''}`} 
              onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
              title="背景填充"
            >
              <div className="color-indicator" style={{ backgroundColor: element.style?.fill || '#ffffff', border: '1px solid #ddd' }} />
              <span className="label">填充</span>
            </button>
          )}

          {/* 文本元素的颜色控制 */}
          {element?.type === 'text' && (
            <>
              <button 
                className={`toolbar-item ${showColorPicker === 'text' ? 'active' : ''}`} 
                onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
                title="文字颜色"
              >
                <div className="color-indicator" style={{ backgroundColor: element.style?.fill || '#333' }} />
                <span className="label">文字</span>
              </button>
              <button 
                className={`toolbar-item ${showColorPicker === 'bg' ? 'active' : ''}`} 
                onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
                title="背景颜色"
              >
                <div className="color-indicator" style={{ backgroundColor: element.style?.backgroundColor || 'transparent', border: '1px solid #ddd' }} />
                <span className="label">背景</span>
              </button>
            </>
          )}

          <div className="divider" />
          
          {/* 圆角控制 - 仅针对矩形、Frame 和图片 */}
          {(element?.type === 'rectangle' || element?.type === 'frame' || element?.type === 'image') && (
            <div className="toolbar-item no-hover">
              <span className="icon" title="圆角">▢</span>
              <input
                type="number"
                className="number-input"
                min="0"
                max="500"
                value={element.style?.borderRadius ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleUpdateStyle({ 
                    borderRadius: val === '' ? undefined : Math.max(0, parseInt(val) || 0) 
                  });
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                title="圆角大小"
              />
            </div>
          )}

          <div className="divider" />
          
          <button className="toolbar-item more" title="更多">
            <span className="icon">...</span>
          </button>

          {(element?.type === 'frame' || element?.type === 'text' || element?.type === 'image') && (
            <>
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
                <span className="label">导出</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default FloatingToolbar;
