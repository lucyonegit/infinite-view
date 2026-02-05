import React, { memo, useMemo } from 'react';
import type { Element } from '../../types';
import type { EditorState } from '../../EditorEngine';

interface TextElementProps {
  /** 元素数据 */
  element: Element;
  /** 编辑器状态 */
  editorState?: EditorState;
  /** 子元素 - 支持渲染状态指示器等自定义 UI */
  children?: React.ReactNode;
  /** 额外的 className，会与默认 className 合并 */
  className?: string;
  /** 额外的 style，会与默认 style 合并 */
  style?: React.CSSProperties;
}

/**
 * TextElement - 文本元素渲染组件
 * 
 * 支持通过 className 和 style 进行样式覆写，
 * 通过 children 渲染自定义 UI 内容。
 */
export const TextElement = memo(function TextElement({
  element,
  editorState,
  children,
  className,
  style,
}: TextElementProps) {
  const isSelected = editorState?.selectedIds.includes(element.id) ?? false;

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.fixedWidth ? element.width : 'auto',
    minWidth: 10,
    minHeight: 30,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    fontSize: element.style?.fontSize,
    fontFamily: element.style?.fontFamily,
    fontWeight: element.style?.fontWeight,
    fontStyle: element.style?.fontStyle,
    textDecoration: element.style?.textDecoration,
    textAlign: element.style?.textAlign,
    color: element.style?.fill,
    opacity: element.style?.opacity,
    // 业务层传入的 style 会覆盖默认样式
    ...style,
  }), [element, style]);

  const mergedClassName = useMemo(() => {
    const classes = ['text-element'];
    if (isSelected) classes.push('selected');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [isSelected, className]);

  return (
    <div
      className={mergedClassName}
      style={containerStyle}
      data-element-id={element.id}
    >
      <span>{element.content || 'Double click to edit'}</span>
      {children}
    </div>
  );
});

export default TextElement;
