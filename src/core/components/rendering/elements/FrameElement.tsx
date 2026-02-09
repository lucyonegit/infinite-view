import React, { memo, useMemo } from 'react';
import type { Element } from '../../../engine';
import { useEditorEngine, useEditorEngineShallow } from '../../../react/hooks/useEditorEngine';
import { useEngineInstance } from '../../../react/context/useEngineInstance';
import { BaseRender } from '../BaseRender';
import type { CustomRenderConfig } from '../BaseRender';

interface FrameElementProps {
  /** 元素数据 */
  element: Element;
  /** 是否被选中 */
  isSelected?: boolean;
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
 * 优化点：
 * 1. 使用 useEditorEngineShallow 订阅子元素，确保只在子元素列表真实变化时触发重渲染。
 * 2. 选择器直接从 state.elements 中过滤，不依赖 Props，避免状态不同步导致的闪烁。
 */
export const FrameElement = memo(function FrameElement({
  element,
  isSelected = false,
  children,
  className,
  style,
  customRender,
}: FrameElementProps) {
  const engine = useEngineInstance();
  
  // 仅在当前 Frame 内部订阅必要状态
  const isHovered = useEditorEngine(engine, (state) => state.hoverFrameId === element.id);
  
  /**
   * 修复点：不再依赖 props 中的 element.children，而是直接从最新的 state 中过滤。
   * 这保证了当元素在根节点和 Frame 之间切换时，父容器能与全局状态同步渲染，避免出现“元素短暂消失”的情况。
   */
  const childElements = useEditorEngineShallow(engine, (state) => 
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
    background: 'transparent',
    border: 'none',
    ...style,
  }), [element.x, element.y, element.width, element.height, element.rotation, element.zIndex, style]);

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
      
      <div className="frame-content">
        <div className="frame-background" style={backgroundStyle} />
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
