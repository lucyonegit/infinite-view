import React, { memo, useMemo } from 'react';
import type { Element } from '../../types';
import type { EditorState } from '../../EditorEngine';

interface FrameElementProps {
  /** 元素数据 */
  element: Element;
  /** 编辑器状态 */
  editorState?: EditorState;
  /** 子元素 - 支持渲染自定义 UI 内容 */
  children?: React.ReactNode;
  /** 额外的 className，会与默认 className 合并 */
  className?: string;
  /** 额外的 style，会与默认 style 合并 */
  style?: React.CSSProperties;
}

/**
 * FrameElement - Frame 容器元素渲染组件
 * 
 * 支持通过 className 和 style 进行样式覆写，
 * 通过 children 渲染自定义 UI 内容。
 */
export const FrameElement = memo(function FrameElement({
  element,
  editorState,
  children,
  className,
  style,
}: FrameElementProps) {
  const isSelected = editorState?.selectedIds.includes(element.id) ?? false;

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    backgroundColor: element.style?.backgroundColor || '#ffffff',
    borderRadius: element.style?.borderRadius,
    border: element.style?.stroke 
      ? `${element.style.strokeWidth || 1}px solid ${element.style.stroke}` 
      : undefined,
    opacity: element.style?.opacity,
    overflow: 'hidden',
    // 业务层传入的 style 会覆盖默认样式
    ...style,
  }), [element, style]);

  const mergedClassName = useMemo(() => {
    const classes = ['frame-element'];
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
      {/* Frame 名称标签 */}
      {element.name && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            fontSize: 12,
            color: '#666',
            whiteSpace: 'nowrap',
          }}
        >
          {element.name}
        </div>
      )}
      {children}
    </div>
  );
});

export default FrameElement;
