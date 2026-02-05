import React, { memo, useCallback } from 'react';
import type { Element } from '../../../core/types';
import { useEngineInstance } from '../../../core/react/EditorProvider';
import { useEditorEngine } from '../../../core/react/useEditorEngine';
import { getElementStyles } from '../../elements/utils/elementStyles';
import { EngineTextElementRenderer } from './EngineTextElementRenderer';
import { EngineImageElementRenderer, EngineRectangleElementRenderer } from './EngineSimpleRenderers';

interface EngineBasicElementRendererProps {
  element: Element;
  isSelected: boolean;
}

/**
 * EngineBasicElementRenderer - 基础元素渲染器
 */
export const EngineBasicElementRenderer = memo(function EngineBasicElementRenderer({
  element,
  isSelected,
}: EngineBasicElementRendererProps) {
  const engine = useEngineInstance();
  
  // 订阅交互状态
  const isEditing = useEditorEngine(engine, (s) => s.interaction.editingId === element.id);

  const style: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.type === 'text' && !element.fixedWidth ? 'auto' : element.width,
    height: element.type === 'text' ? 'auto' : element.height, 
    minHeight: element.type === 'text' ? 30 : undefined,
    minWidth: element.type === 'text' ? 10 : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...getElementStyles(element),
  };

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type === 'text') {
      engine.setEditingId(element.id);
    }
  }, [element.type, element.id, engine]);

  const className = `element element-${element.type} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`;

  return (
    <div
      className={className}
      style={style}
      data-element-id={element.id}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent(element, isSelected)}
    </div>
  );
});

function renderContent(element: Element, isSelected: boolean) {
  switch (element.type) {
    case 'text':
      return <EngineTextElementRenderer element={element} isSelected={isSelected} />;
    case 'image':
      return <EngineImageElementRenderer element={element} />;
    case 'rectangle':
      return <EngineRectangleElementRenderer />;
    default:
      return null;
  }
}

export default EngineBasicElementRenderer;
