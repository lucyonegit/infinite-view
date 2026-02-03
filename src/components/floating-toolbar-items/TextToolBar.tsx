import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Element } from '../../types/editor';
import { ColorPicker } from './ColorPicker';

interface TextToolBarProps {
  element: Element;
  onExport: () => void;
}

export const TextToolBar: React.FC<TextToolBarProps> = ({ element, onExport }) => {
  const { updateElement } = useEditorStore();
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);

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
            if (showColorPicker === 'text') handleUpdateStyle({ fill: color });
            else handleUpdateStyle({ backgroundColor: color });
            setShowColorPicker(null);
          }}
        />
      )}
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

      <div className="divider" />
      
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
        <span className="label">导出</span>
      </button>
    </div>
  );
};
