import React, { memo, useState, useCallback } from 'react';
import type { Element } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import { getElementStyles } from './utils/elementStyles';

interface BasicElementRendererProps {
  element: Element;
  isSelected: boolean;
}

/**
 * 基础元素渲染器 (非 Frame)
 * 支持 text, image, rectangle 等基础元素类型
 */
export const BasicElementRenderer = memo(function BasicElementRenderer({
  element,
  isSelected,
}: BasicElementRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateElement = useEditorStore(state => state.updateElement);

  // 计算位置 (store 现在存储的是相对父节点的坐标)
  const left = element.x;
  const top = element.y;

  const style: React.CSSProperties = {
    left,
    top,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...getElementStyles(element),
  };

  // 双击进入编辑模式 (文本)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type === 'text') {
      setIsEditing(true);
    }
  }, [element.type]);

  // 文本内容改变
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateElement(element.id, { content: e.target.value });
  }, [element.id, updateElement]);

  // 文本失焦退出编辑
  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const className = `element element-${element.type} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`;

  return (
    <div
      className={className}
      style={style}
      data-element-id={element.id}
      onDoubleClick={handleDoubleClick}
    >
      {renderElementContent(element, isEditing, handleTextChange, handleTextBlur)}
    </div>
  );
});

/**
 * 根据元素类型渲染内容
 */
function renderElementContent(
  element: Element,
  isEditing: boolean,
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  onTextBlur: () => void
) {
  switch (element.type) {
    case 'text':
      if (isEditing) {
        return (
          <textarea
            value={element.content || ''}
            onChange={onTextChange}
            onBlur={onTextBlur}
            autoFocus
            style={{
              textAlign: element.style?.textAlign,
              fontSize: element.style?.fontSize,
            }}
          />
        );
      }
      return <span>{element.content || 'Double click to edit'}</span>;

    case 'image':
      return element.imageUrl ? (
        <img src={element.imageUrl} alt="" draggable={false} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
          📷 Image
        </div>
      );

    case 'rectangle':
    default:
      return null;
  }
}

export default BasicElementRenderer;
