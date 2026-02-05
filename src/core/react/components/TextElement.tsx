import React, { memo, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Element } from '../../types';
import type { EditorState } from '../../EditorEngine';

interface TextElementProps {
  /** 元素数据 */
  element: Element;
  /** 编辑器状态 */
  editorState?: EditorState;
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

/**
 * 获取文本元素的通用样式 (用于渲染和镜像计算)
 */
function getTextCommonStyle(element: Element): React.CSSProperties {
  const fontSize = element.style?.fontSize || 24;
  return {
    fontSize: fontSize,
    fontFamily: element.style?.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    textAlign: element.style?.textAlign || 'left',
    color: element.style?.fill || '#333',
    fontWeight: element.style?.fontWeight || 'normal',
    fontStyle: element.style?.fontStyle || 'normal',
    fontSynthesis: 'weight style', // 强制浏览器在字体缺少对应变体时进行合成
    textDecoration: element.style?.textDecoration || 'none',
    backgroundColor: element.style?.backgroundColor || 'transparent',
    padding: 0,
    margin: 0,
    lineHeight: '1.2',
    whiteSpace: !element.fixedWidth ? 'pre' : 'pre-wrap',
    wordBreak: !element.fixedWidth ? 'normal' : 'break-word',
  };
}

/**
 * TextElement - 文本元素渲染组件
 * 
 * Core 层的完整文本元素组件，支持:
 * - 内联编辑 (contentEditable)
 * - 自动调整尺寸 (ResizeObserver)
 * - 固定宽度模式
 * - 通过 className 和 style 进行样式覆写
 * - 通过 children 渲染自定义 UI 内容
 */
export const TextElement = memo(function TextElement({
  element,
  editorState,
  isEditing = false,
  children,
  className,
  style,
  onUpdate,
  onStartEditing,
  onEndEditing,
}: TextElementProps) {
  const isSelected = editorState?.selectedIds.includes(element.id) ?? false;
  const elementRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLSpanElement>(null);

  // 自动进入编辑模式 (新创建的空文本元素)
  useEffect(() => {
    if (isSelected && !element.content && !isEditing && onStartEditing) {
      requestAnimationFrame(() => {
        onStartEditing(element.id);
      });
    }
  }, [isSelected, element.content, isEditing, element.id, onStartEditing]);

  // 监听宽高变化 (自动调整尺寸)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only trigger on isEditing change to avoid cursor reset during typing
  }, [isEditing]); // 仅在编辑状态切换时执行

  const handleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
    const newContent = (e.target as HTMLSpanElement).innerText;
    // 实时同步内容，但不触发 React 对内容的重新渲染
    onUpdate?.(element.id, { content: newContent });
  }, [element.id, onUpdate]);

  const handleBlur = useCallback(() => {
    onEndEditing?.();
  }, [onEndEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 阻止事件冒泡，防止触发全局快捷键（如 Backspace 删除元素）
    e.stopPropagation();
  }, []);

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.fixedWidth ? element.width : 'auto',
    height: 'auto',
    minWidth: 10,
    minHeight: 30,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    // 业务层传入的 style 会覆盖默认样式
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
      {children}
    </div>
  );
});

export default TextElement;
