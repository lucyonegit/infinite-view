import React, { memo, useCallback, useEffect, useRef } from 'react';
import type { Element } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import { getTextCommonStyle } from './utils/textUtils';

interface TextElementRendererProps {
  element: Element;
  isSelected: boolean;
}

export const TextElementRenderer = memo(function TextElementRenderer({
  element,
  isSelected,
}: TextElementRendererProps) {
  const { updateElement, interaction, setEditingId } = useEditorStore();
  const isEditing = interaction.editingId === element.id;
  const elementRef = useRef<HTMLDivElement>(null);

  // 自动进入编辑模式 (新元素)
  useEffect(() => {
    if (isSelected && !element.content && !isEditing) {
      requestAnimationFrame(() => {
        setEditingId(element.id);
      });
    }
  }, [isSelected, element.content, isEditing, element.id, setEditingId]);

  // 监听宽高变化
  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.ceil(entry.contentRect.width);
        const newHeight = Math.ceil(entry.contentRect.height);
        
        const updates: Partial<Element> = {};
        if (!element.fixedWidth && Math.abs(newWidth - element.width) > 1 && newWidth > 0) {
          updates.width = newWidth;
        }
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
  }, [element.id, element.width, element.height, element.fixedWidth, updateElement]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateElement(element.id, { content: e.target.value });
  }, [element.id, updateElement]);

  const handleTextBlur = useCallback(() => {
    setEditingId(null);
  }, [setEditingId]);

  const commonStyle = getTextCommonStyle(element);

  return (
    <div ref={elementRef} style={{ width: '100%', height: '100%' }}>
      {isEditing ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <span
            style={{
              ...commonStyle,
              visibility: 'hidden',
              display: 'inline-block',
              minWidth: '2px',
              pointerEvents: 'none',
            }}
          >
            {element.content + (element.content?.endsWith('\n') ? ' ' : '') || ' '}
          </span>
          <textarea
            value={element.content || ''}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            autoFocus
            style={{
              ...commonStyle,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              overflow: 'hidden',
            }}
          />
        </div>
      ) : (
        <span style={{ ...commonStyle, width: '100%', display: 'block' }}>
          {element.content || 'Double click to edit'}
        </span>
      )}
    </div>
  );
});
