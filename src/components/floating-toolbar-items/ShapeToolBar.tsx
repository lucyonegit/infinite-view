import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Element } from '../../core/types';
import { ColorPicker } from './ColorPicker';

interface ShapeToolBarProps {
  element: Element;
  onExport: () => void;
}

export const ShapeToolBar: React.FC<ShapeToolBarProps> = ({ element, onExport }) => {
  const { updateElement } = useEditorStore();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  return (
    <div className="toolbar-group">
      {showColorPicker && (
        <ColorPicker 
          onSelect={(color) => {
            handleUpdateStyle({ fill: color });
            setShowColorPicker(false);
          }}
        />
      )}
      <button 
        className={`toolbar-item ${showColorPicker ? 'active' : ''}`} 
        onClick={() => setShowColorPicker(!showColorPicker)}
        title="背景填充"
      >
        <div className="color-indicator" style={{ backgroundColor: element.style?.fill || '#ffffff', border: '1px solid #ddd' }} />
        <span className="label">填充</span>
      </button>

      <div className="divider" />
      
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

      <div className="divider" />
      
      <button className="toolbar-item more" title="更多">
        <span className="icon">...</span>
      </button>

      {element.type === 'frame' && (
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
  );
};
