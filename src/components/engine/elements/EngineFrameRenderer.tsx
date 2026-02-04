import React, { memo } from 'react';
import type { Element } from '../../../types/editor';
import { useEngineInstance } from '../../../core/react/EditorProvider';
import { useEditorEngine, useEditorEngineShallow } from '../../../core/react/useEditorEngine';
import { EngineElementRenderer } from './EngineElementRenderer';
import { getElementStyles } from '../../elements/utils/elementStyles';
import '../../elements/ElementRenderer.css';

interface EngineFrameRendererProps {
  element: Element;
  isSelected: boolean;
  zoom?: number;
}

/**
 * EngineFrameRenderer - Frame 渲染器
 */
export const EngineFrameRenderer = memo(function EngineFrameRenderer({ 
  element, 
  isSelected, 
  zoom = 1,
}: EngineFrameRendererProps) {
  const engine = useEngineInstance();
  
  // 订阅状态
  const selectedIds = useEditorEngine(engine, s => s.selectedIds);
  const hoverFrameId = useEditorEngine(engine, s => s.hoverFrameId);
  const children = useEditorEngineShallow(engine, s => s.elements.filter(el => el.parentId === element.id));
  
  const isHovered = hoverFrameId === element.id;
  
  const style: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
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
      
      <div className="frame-content">
        <div className="frame-background" style={backgroundStyle} />
        <div className="frame-children">
          {children.map((child) => (
            <EngineElementRenderer
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

export default EngineFrameRenderer;
