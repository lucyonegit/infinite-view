import React, { memo, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
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

  const editableRef = useRef<HTMLSpanElement>(null);

  // 当进入编辑模式时，自动聚焦并处理光标
  useLayoutEffect(() => {
    if (isEditing && editableRef.current) {
      const el = editableRef.current;
      
      // 初始化内容 (仅在刚进入编辑模式时)
      // 使用 innerText 避免 React 渲染逻辑干扰光标
      el.innerText = element.content || '';
      
      el.focus();
      
      // 移动光标到末尾
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]); // 仅在编辑状态切换时执行

  const handleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
    const newContent = (e.target as HTMLSpanElement).innerText;
    // 实时同步到 store，但不触发 React 对内容的重新渲染（见下方 span 的 children 逻辑）
    updateElement(element.id, { content: newContent });
  }, [element.id, updateElement]);

  const handleBlur = useCallback(() => {
    setEditingId(null);
  }, [setEditingId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 阻止事件冒泡，防止触发全局快捷键（如 Backspace 删除元素）
    e.stopPropagation();
  }, []);

  const commonStyle = getTextCommonStyle(element);

  return (
    <div ref={elementRef} style={{ width: '100%', height: '100%' }}>
      <span
        ref={editableRef}
        contentEditable={isEditing}
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
        {/* 重要：编辑模式下设为 undefined，交由浏览器 uncontrolled 处理，避免 React 在 input 时重置光标 */}
        {isEditing ? undefined : (element.content || 'Double click to edit')}
      </span>
    </div>
  );
});
