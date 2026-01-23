import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
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
  const elementRef = useRef<HTMLDivElement>(null);

  // 如果点击创建后，内容为空且被选中，默认进入编辑模式
  useEffect(() => {
    if (element.type === 'text' && isSelected && !element.content && !isEditing) {
      requestAnimationFrame(() => {
        setIsEditing(true);
      });
    }
  }, [element.type, isSelected, element.content, isEditing]);

  // 计算位置 (store 现在存储的是相对父节点的坐标)
  const left = element.x;
  const top = element.y;

  const style: React.CSSProperties = {
    left,
    top,
    width: element.type === 'text' && !element.fixedWidth ? 'auto' : element.width,
    height: element.type === 'text' ? 'auto' : element.height, 
    minHeight: element.type === 'text' ? 30 : undefined,
    minWidth: element.type === 'text' ? 10 : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...getElementStyles(element),
  };

  // 监听高度和宽度变化 (仅针对文本元素)
  useEffect(() => {
    if (element.type !== 'text' || !elementRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.ceil(entry.contentRect.width);
        const newHeight = Math.ceil(entry.contentRect.height);
        
        const updates: Partial<Element> = {};
        
        // 动态宽度（未固定时）
        if (!element.fixedWidth && Math.abs(newWidth - element.width) > 1 && newWidth > 0) {
          updates.width = newWidth;
        }
        
        // 动态高度
        if (Math.abs(newHeight - element.height) > 1 && newHeight > 0) {
          updates.height = newHeight;
        }

        if (Object.keys(updates).length > 0) {
          requestAnimationFrame(() => {
            updateElement(element.id, updates);
          });
        }
      }
    });

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [element.id, element.type, element.width, element.height, element.fixedWidth, updateElement]);

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
      ref={elementRef}
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
    case 'text': {
      const fontSize = element.style?.fontSize || 24;
      if (isEditing) {
        return (
          <textarea
            value={element.content || ''}
            onChange={onTextChange}
            onBlur={onTextBlur}
            autoFocus
            style={{
              textAlign: element.style?.textAlign,
              fontSize: fontSize,
              color: element.style?.fill || '#333',
            }}
          />
        );
      }
      return (
        <span style={{ fontSize: fontSize, color: element.style?.fill || '#333', width: '100%', display: 'block' }}>
          {element.content || 'Double click to edit'}
        </span>
      );
    }

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
