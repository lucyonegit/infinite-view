import React, { memo, useCallback } from 'react';
import type { Element } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import { getElementStyles } from './utils/elementStyles';
import { TextElementRenderer } from './TextElementRenderer';
import { ImageElementRenderer } from './ImageElementRenderer';
import { RectangleElementRenderer } from './RectangleElementRenderer';

interface BasicElementRendererProps {
  element: Element;
  isSelected: boolean;
}

/**
 * 基础元素渲染器 - 处理通用属性 (位置、变换、选择、编辑触发)
 * 并将内容渲染委托给具体的子组件
 */
export const BasicElementRenderer = memo(function BasicElementRenderer({
  element,
  isSelected,
}: BasicElementRendererProps) {
  const { interaction, setEditingId } = useEditorStore();
  const isEditing = interaction.editingId === element.id;

  // 通用样式计算
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
      setEditingId(element.id);
    }
  }, [element.type, element.id, setEditingId]);

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
      return <TextElementRenderer element={element} isSelected={isSelected} />;
    case 'image':
      return <ImageElementRenderer element={element} />;
    case 'rectangle':
      return <RectangleElementRenderer />;
    default:
      return null;
  }
}

export default BasicElementRenderer;
