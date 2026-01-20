import React, { memo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Element, ResizeHandle } from '../types/editor';
import { useEditorStore } from '../store/editorStore';
import './ElementRenderer.css';

interface ElementRendererProps {
  element: Element;
  isSelected: boolean;
  zoom: number;
  /** 是否作为 Frame 的子元素渲染 (使用相对坐标) */
  isChild?: boolean;
  /** 父 Frame 的坐标 (用于计算相对位置) */
  parentOffset?: { x: number; y: number };
}

/**
 * 单个元素的渲染器
 */
export const ElementRenderer = memo(function ElementRenderer({ 
  element, 
  isSelected, 
  zoom,
  isChild = false,
  parentOffset = { x: 0, y: 0 },
}: ElementRendererProps) {
  // 如果是 Frame，使用 FrameRenderer
  if (element.type === 'frame') {
    return (
      <FrameRenderer
        element={element}
        isSelected={isSelected}
        zoom={zoom}
        isChild={isChild}
        parentOffset={parentOffset}
      />
    );
  }

  // 其他元素使用 BasicElementRenderer
  return (
    <BasicElementRenderer
      element={element}
      isSelected={isSelected}
      zoom={zoom}
      isChild={isChild}
      parentOffset={parentOffset}
    />
  );
});

/**
 * 基础元素渲染器 (非 Frame)
 */
const BasicElementRenderer = memo(function BasicElementRenderer({
  element,
  isSelected,
  zoom,
  isChild = false,
  parentOffset = { x: 0, y: 0 },
}: ElementRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateElement = useEditorStore(state => state.updateElement);

  // 计算位置 (如果是子元素，使用相对坐标)
  const left = isChild ? element.x - parentOffset.x : element.x;
  const top = isChild ? element.y - parentOffset.y : element.y;

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
      
      {/* 选中时显示缩放手柄 */}
      {isSelected && !isEditing && (
        <ResizeHandles zoom={zoom} />
      )}
    </div>
  );
});

/**
 * Frame 渲染器 - 支持子元素和裁切
 */
const FrameRenderer = memo(function FrameRenderer({ 
  element, 
  isSelected, 
  zoom,
  isChild = false,
  parentOffset = { x: 0, y: 0 },
}: ElementRendererProps) {
  const selectedIds = useEditorStore(state => state.selectedIds);
  const hoverFrameId = useEditorStore(state => state.hoverFrameId);
  
  // 响应式获取 Frame 的子元素
  const children = useEditorStore(useShallow(state => 
    state.elements.filter(el => el.parentId === element.id)
  ));
  
  // 是否正在被拖拽悬停
  const isHovered = hoverFrameId === element.id;
  
  // 计算位置
  const left = isChild ? element.x - parentOffset.x : element.x;
  const top = isChild ? element.y - parentOffset.y : element.y;

  const style: React.CSSProperties = {
    left,
    top,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    ...getElementStyles(element),
  };

  const className = `element element-frame ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;

  return (
    <div
      className={className}
      style={style}
      data-element-id={element.id}
      data-frame="true"
    >
      {/* Frame 标题 */}
      <div className="frame-label">
        <span className="frame-icon">#</span>
        <span className="frame-name">{element.name || 'Frame'}</span>
      </div>
      
      {/* 渲染子元素 */}
      <div className="frame-children">
        {children.map((child) => (
          <ElementRenderer
            key={child.id}
            element={child}
            isSelected={selectedIds.includes(child.id)}
            zoom={zoom}
            isChild={true}
            parentOffset={{ x: element.x, y: element.y }}
          />
        ))}
      </div>
      
      {/* 选中时显示缩放手柄 */}
      {isSelected && (
        <ResizeHandles zoom={zoom} />
      )}
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

/**
 * 缩放手柄组件
 */
function ResizeHandles({ zoom }: { zoom: number }) {
  const setInteraction = useEditorStore(state => state.setInteraction);
  const handles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    setInteraction({
      isResizing: true,
      resizeHandle: handle,
      startPoint: { x: e.clientX, y: e.clientY },
    });
  }, [setInteraction]);

  // 保持手柄在屏幕上的大小一致 (大约 8px)
  const handleSize = 8 / zoom;

  return (
    <div className="resize-handles">
      {handles.map((handle) => (
        <div
          key={handle}
          className={`resize-handle ${handle}`}
          style={{
            width: handleSize,
            height: handleSize,
          }}
          onMouseDown={(e) => handleMouseDown(e, handle)}
        />
      ))}
    </div>
  );
}

export default ElementRenderer;
