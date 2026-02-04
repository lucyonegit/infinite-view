import React, { memo, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import type { Element } from '../../../types/editor';
import { useEngineInstance } from '../../../core/react/EditorProvider';
import { useEditorEngine } from '../../../core/react/useEditorEngine';
import { getTextCommonStyle } from '../../elements/utils/textUtils';

interface EngineTextElementRendererProps {
  element: Element;
  isSelected: boolean;
}

export const EngineTextElementRenderer = memo(function EngineTextElementRenderer({
  element,
  isSelected,
}: EngineTextElementRendererProps) {
  const engine = useEngineInstance();
  
  // 订阅交互状态
  const isEditing = useEditorEngine(engine, (s) => s.interaction.editingId === element.id);
  const elementRef = useRef<HTMLDivElement>(null);

  // 1. 自动进入编辑模式 (如果是空内容的新元素)
  useEffect(() => {
    if (isSelected && !element.content && !isEditing) {
      requestAnimationFrame(() => {
        engine.setEditingId(element.id);
      });
    }
  }, [isSelected, element.content, isEditing, element.id, engine]);

  // 2. 监听宽高变化 (ResizeObserver)
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
            engine.updateElement(element.id, updates);
          });
        }
      }
    });

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [element.id, element.width, element.height, element.fixedWidth, engine]);

  // 3. 编辑模式交互
  const editableRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (isEditing && editableRef.current) {
      const el = editableRef.current;
      el.innerText = element.content || '';
      el.focus();
      
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing, element.content]);

  const handleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
    const newContent = (e.target as HTMLSpanElement).innerText;
    engine.updateElement(element.id, { content: newContent });
  }, [element.id, engine]);

  const handleBlur = useCallback(() => {
    engine.setEditingId(null);
  }, [engine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const commonStyle = getTextCommonStyle(element);

  return (
    <div ref={elementRef} style={{ width: '100%', height: '100%' }}>
      <span
        ref={editableRef}
        contentEditable={isEditing ? 'plaintext-only' : false} // 使用 plaintext-only 更好
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ 
          ...commonStyle, 
          width: '100%', 
          display: 'block',
          outline: 'none',
          minHeight: '1em',
          cursor: isEditing ? 'text' : 'pointer'
        }}
      >
        {isEditing ? undefined : (element.content || 'Double click to edit')}
      </span>
    </div>
  );
});
