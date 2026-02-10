import React, { memo, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Element } from '../../../engine';

interface TextElementProps {
  /** 元素数据 */
  element: Element;
  /** 是否被选中 */
  isSelected?: boolean;
  /** 是否正在编辑 */
  isEditing?: boolean;
  /** 子元素 - 支持渲染状态指示器等自定义 UI */
  children?: React.ReactNode;
  /** 额外的 className，会与默认 className 合并 */
  className?: string;
  /** 额外的 style，会与默认 style 合并 */
  style?: React.CSSProperties;
  /** 元素更新回调 */
  onUpdate?: (id: string, updates: Partial<Element>) => void;
  /** 进入编辑模式回调 */
  onStartEditing?: (id: string) => void;
  /** 退出编辑模式回调 */
  onEndEditing?: () => void;
}

import { getTextCommonStyle } from '../../../utils/textUtils';

/**
 * TextElement - 文本元素渲染组件
 */
export const TextElement = memo(function TextElement({
  element,
  isSelected = false,
  isEditing = false,
  children,
  className,
  style,
  onUpdate,
  onStartEditing,
  onEndEditing,
}: TextElementProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLSpanElement>(null);

  // 自动进入编辑模式
  useEffect(() => {
    if (isSelected && !element.content && !isEditing && onStartEditing) {
      onStartEditing(element.id);
    }
  }, [isSelected, element.content, isEditing, element.id, onStartEditing]);

  // 监听宽高变化
  useEffect(() => {
    if (!elementRef.current || !onUpdate) return;

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
            onUpdate(element.id, updates);
          });
        }
      }
    });

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [element.id, element.width, element.height, element.fixedWidth, onUpdate]);

  // 1. 处理进入编辑模式时的初始焦点和光标位置
  useLayoutEffect(() => {
    if (isEditing && editableRef.current) {
      const el = editableRef.current;
      
      // 确保有焦点
      if (document.activeElement !== el) {
        el.focus();
      }

      // 只有在刚开始编辑时，将光标移到末尾
      const selection = window.getSelection();
      if (selection && selection.rangeCount === 0) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [isEditing]);

  // 2. 处理内容同步（例如来自外部的更新）
  useLayoutEffect(() => {
    if (isEditing && editableRef.current) {
      const el = editableRef.current;
      const targetContent = element.content || '';
      
      // 只有当 DOM 内容与数据不一致时才同步
      // 这能避免在输入过程中因为设置 innerText 导致的光标跳动
      if (el.innerText !== targetContent) {
        el.innerText = targetContent;
        
        // 如果我们强制更新了内容，且当前没有选区，则把光标放最后
        const selection = window.getSelection();
        if (selection && (selection.rangeCount === 0 || !el.contains(selection.anchorNode))) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, [element.content, isEditing]);

  const handleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
    const newContent = (e.target as HTMLSpanElement).innerText;
    onUpdate?.(element.id, { content: newContent });
  }, [element.id, onUpdate]);

  const handleBlur = useCallback(() => {
    onEndEditing?.();
  }, [onEndEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.fixedWidth ? element.width : 'auto',
    height: 'auto',
    minWidth: 20,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...style,
  }), [element.x, element.y, element.width, element.fixedWidth, element.rotation, element.zIndex, style]);

  const mergedClassName = useMemo(() => {
    const classes = ['infinite_view_element', 'text-element'];
    if (isSelected) classes.push('selected');
    if (isEditing) classes.push('editing');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [isSelected, isEditing, className]);

  const commonStyle = getTextCommonStyle(element);

  return (
    <div
      ref={elementRef}
      className={mergedClassName}
      style={containerStyle}
      data-element-id={element.id}
    >
      <span
        ref={editableRef}
        contentEditable={isEditing}
        autoFocus={isEditing}
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
      {children}
    </div>
  );
});

export default TextElement;
