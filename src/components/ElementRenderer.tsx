import React, { memo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Element } from '../types/editor';
import { useEditorStore } from '../store/editorStore';
import './ElementRenderer.css';

interface ElementRendererProps {
  element: Element;
  isSelected: boolean;
  zoom?: number;
}

/**
 * 单个元素的渲染器
 */
export const ElementRenderer = memo(function ElementRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: ElementRendererProps) {
  // 如果是 Frame，使用 FrameRenderer
  if (element.type === 'frame') {
    return (
      <FrameRenderer
        element={element}
        isSelected={isSelected}
        zoom={zoom}
      />
    );
  }

  // 其他元素使用 BasicElementRenderer
  return (
    <BasicElementRenderer
      element={element}
      isSelected={isSelected}
    />
  );
});

/**
 * 基础元素渲染器 (非 Frame)
 */
const BasicElementRenderer = memo(function BasicElementRenderer({
  element,
  isSelected,
}: Omit<ElementRendererProps, 'zoom'>) {
  const [isEditing, setIsEditing] = useState(false);
  const updateElement = useEditorStore(state => state.updateElement);

  // 计算位置 (store 现在存储的是相对父节点的坐标)
  const left = element.x;
  const top = element.y;

  const style: React.CSSProperties = {
    left,
    top,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...getElementStyles(element),
  };

  // 双击进入编辑模式 (文本)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.type === 'text') {
      setIsEditing(true);
    }
  }, [element.type]);

  // 文本内容改变
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateElement(element.id, { content: e.target.value });
  }, [element.id, updateElement]);

  // 文本失焦退出编辑
  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const className = `element element-${element.type} ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`;

  return (
    <div
      className={className}
      style={style}
      data-element-id={element.id}
      onDoubleClick={handleDoubleClick}
    >
      {renderElementContent(element, isEditing, handleTextChange, handleTextBlur)}
    </div>
  );
});

/**
 * Frame 渲染器 - 支持子元素和裁切
 */
const FrameRenderer = memo(function FrameRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: ElementRendererProps) {
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

/**
 * 根据元素类型渲染内容
 */
function renderElementContent(
  element: Element,
  isEditing: boolean,
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void,
  onTextBlur: () => void
) {
  switch (element.type) {
    case 'text':
      if (isEditing) {
        return (
          <textarea
            value={element.content || ''}
            onChange={onTextChange}
            onBlur={onTextBlur}
            autoFocus
            style={{
              textAlign: element.style?.textAlign,
              fontSize: element.style?.fontSize,
            }}
          />
        );
      }
      return <span>{element.content || 'Double click to edit'}</span>;

    case 'image':
      return element.imageUrl ? (
        <img src={element.imageUrl} alt="" draggable={false} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
          📷 Image
        </div>
      );

    case 'rectangle':
    default:
      return null;
  }
}

/**
 * 获取元素的 CSS 样式
 */
function getElementStyles(element: Element): React.CSSProperties {
  const { style } = element;
  if (!style) return {};

  return {
    background: style.fill,
    border: style.stroke ? `${style.strokeWidth || 1}px solid ${style.stroke}` : undefined,
    borderRadius: style.borderRadius,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
  };
}

export default ElementRenderer;
