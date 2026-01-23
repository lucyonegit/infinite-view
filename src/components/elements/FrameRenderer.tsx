import React, { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Element } from '../../types/editor';
import { useEditorStore } from '../../store/editorStore';
import { ElementRenderer } from './ElementRenderer';
import { getElementStyles } from './utils/elementStyles';
import './ElementRenderer.css';

interface FrameRendererProps {
  element: Element;
  isSelected: boolean;
  zoom?: number;
}

/**
 * Frame 渲染器 - 支持子元素和裁切
 */
export const FrameRenderer = memo(function FrameRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: FrameRendererProps) {
  const selectedIds = useEditorStore(state => state.selectedIds);
  const hoverFrameId = useEditorStore(state => state.hoverFrameId);
  
  // 响应式获取 Frame 的子元素
  const children = useEditorStore(useShallow(state => 
    state.elements.filter(el => el.parentId === element.id)
  ));
  
  // 是否正在被拖拽悬停
  const isHovered = hoverFrameId === element.id;
  
  // 计算位置 (已是相对坐标)
  const left = element.x;
  const top = element.y;

  const style: React.CSSProperties = {
    left,
    top,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    // 背景由内部渲染，容器保持透明以防万一
    background: 'transparent',
    border: 'none',
  };

  const backgroundStyle = getElementStyles(element);
  const className = `element element-frame ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;

  return (
    <div
      className={className}
      style={style}
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
        <span>{element.width} * {element.height}</span>
      </div>
      
      {/* 裁剪容器 */}
      <div className="frame-content">
        {/* 背景层 - 在裁剪层内部 */}
        <div className="frame-background" style={backgroundStyle} />
        
        {/* 子元素层 */}
        <div className="frame-children">
          {children.map((child) => (
            <ElementRenderer
              key={child.id}
              element={child}
              isSelected={selectedIds.includes(child.id)}
              zoom={zoom}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default FrameRenderer;
