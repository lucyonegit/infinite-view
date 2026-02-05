import React, { memo, useMemo } from 'react';
import type { Element } from '../../types';
import type { EditorState } from '../../EditorEngine';
import { useEditorEngine } from '../useEditorEngine';
import { useEngineInstance } from '../EditorProvider';
import { BaseRender } from './BaseRender';
import type { CustomRenderConfig } from './BaseRender';

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
  /** 自定义渲染配置（传递给子元素）*/
  customRender?: CustomRenderConfig;
}

/**
 * FrameElement - Frame 容器元素渲染组件
 * 
 * 支持子元素渲染、标题栏显示、裁切功能。
 */
export const FrameElement = memo(function FrameElement({
  element,
  editorState,
  children,
  className,
  style,
  customRender,
}: FrameElementProps) {
  const engine = useEngineInstance();
  const isSelected = editorState?.selectedIds.includes(element.id) ?? false;
  const hoverFrameId = editorState?.hoverFrameId;
  const isHovered = hoverFrameId === element.id;
  
  // 订阅子元素
  const childElements = useEditorEngine(engine, (state) => 
    state.elements.filter(el => el.parentId === element.id)
  );

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    // Frame 容器透明，背景由内部渲染
    background: 'transparent',
    border: 'none',
    // 业务层传入的 style 会覆盖默认样式
    ...style,
  }), [element, style]);

  const backgroundStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: element.style?.fill || element.style?.backgroundColor || '#ffffff',
    borderRadius: element.style?.borderRadius,
    border: element.style?.stroke 
      ? `${element.style.strokeWidth || 1}px solid ${element.style.stroke}` 
      : undefined,
    opacity: element.style?.opacity,
    pointerEvents: 'none',
  }), [element.style]);

  const mergedClassName = useMemo(() => {
    const classes = ['infinite_view_element', 'frame-element', 'element-frame'];
    if (isSelected) classes.push('selected');
    if (isHovered) classes.push('hovered');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [isSelected, isHovered, className]);

  return (
    <div
      className={mergedClassName}
      style={containerStyle}
      data-element-id={element.id}
      data-frame="true"
    >
      {/* Frame 标题 - 在裁剪层之外 */}
      <div className="frame-label w-full flex-row justify-between">
        <span className='flex flex-row items-center'>
          <span className="frame-drag-handle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 16C9 16.5523 9.44772 17 10 17H14C14.5523 17 15 16.5523 15 16C15 15.4477 14.5523 15 14 15H10C9.44772 15 9 15.4477 9 16ZM9 12C9 12.5523 9.44772 13 10 13H14C14.5523 13 15 12.5523 15 12C15 11.4477 14.5523 11 14 11H10C9.44772 11 9 11.4477 9 12ZM9 8C9 8.55228 9.44772 9 10 9H14C14.5523 9 15 8.55228 15 8C15 7.44772 14.5523 7 14 7H10C9.44772 7 9 7.44772 9 8Z" fill="currentColor" />
              <path fillRule="evenodd" clipRule="evenodd" d="M5 2C3.34315 2 2 3.34315 2 5V19C2 20.6569 3.34315 22 5 22H19C20.6569 22 22 20.6569 22 19V5C22 3.34315 20.6569 2 19 2H5ZM4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V19C20 19.5523 19.5523 20 19 20H5C5 20 4.44772 19.5523 4 19V5Z" fill="currentColor" fillOpacity="0.5"/>
            </svg>
          </span>
          <span className="frame-icon">#</span>
          <span className="frame-name">{element.name || 'Frame'}</span>
        </span>
        <span>{element.width} × {element.height}</span>
      </div>
      
      {/* 裁剪容器 */}
      <div className="frame-content">
        {/* 背景层 - 在裁剪层内部 */}
        <div className="frame-background" style={backgroundStyle} />
        
        {/* 子元素层 */}
        <div className="frame-children">
          {childElements.map((child) => (
            <BaseRender 
              key={child.id} 
              element={child}
              customRender={customRender}
            />
          ))}
        </div>
      </div>
      
      {children}
    </div>
  );
});

export default FrameElement;
