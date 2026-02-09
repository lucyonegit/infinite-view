import React, { memo, useMemo } from 'react';
import type { Element, EditorState } from '../../../engine';

interface ImageElementProps {
  /** 元素数据 */
  element: Element;
  /** 编辑器状态 */
  editorState?: EditorState;
  /** 子元素 - 支持渲染 loading、overlay 等自定义 UI */
  children?: React.ReactNode;
  /** 额外的 className，会与默认 className 合并 */
  className?: string;
  /** 额外的 style，会与默认 style 合并 */
  style?: React.CSSProperties;
}

/**
 * ImageElement - 图片元素渲染组件
 * 
 * 支持通过 className 和 style 进行样式覆写，
 * 通过 children 渲染自定义 UI 内容。
 */
export const ImageElement = memo(function ImageElement({
  element,
  editorState,
  children,
  className,
  style,
}: ImageElementProps) {
  const isSelected = editorState?.selectedIds.includes(element.id) ?? false;

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    borderRadius: element.style?.borderRadius,
    opacity: element.style?.opacity,
    overflow: 'hidden',
    // 业务层传入的 style 会覆盖默认样式
    ...style,
  }), [element, style]);

  const mergedClassName = useMemo(() => {
    const classes = ['infinite_view_element', 'image-element'];
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
      {element.imageUrl ? (
        <img
          src={element.imageUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
          📷 Image
        </div>
      )}
      {children}
    </div>
  );
});

export default ImageElement;
