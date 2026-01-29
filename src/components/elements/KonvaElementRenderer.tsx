import Konva from 'konva';
import React, { useEffect, useState } from 'react';
import { Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import type { Element } from '../../types/editor';

interface KonvaElementRendererProps {
  element: Element;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey: boolean) => void;
  onDragMove?: (id: string, deltaX: number, deltaY: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onTransform?: (id: string, attrs: Partial<Element>) => void;
  onTransformEnd?: (id: string, attrs: Partial<Element>) => void;
  childrenElements?: Element[];
  allElements?: Element[]; // 用于深度递归查找子元素
  selectedIds?: string[];
}

export const SizeLabel: React.FC<{ 
  width: number; 
  height: number; 
  isSelected: boolean;
  offsetY?: number;
}> = ({ width, height, isSelected, offsetY = -35 }) => {
  if (!isSelected) return null;
  
  const text = `${Math.round(width)} × ${Math.round(height)}`;
  const fontSize = 12;
  // Approximate width calculation
  const labelWidth = text.length * 7 + 12;
  const labelHeight = 20;

  return (
    <Group x={width - labelWidth} y={offsetY} listening={false}>
      <Rect
        width={labelWidth}
        height={labelHeight}
        fill="rgba(0,0,0,0.8)"
        cornerRadius={4}
      />
      <Text
        text={text}
        fill="white"
        fontSize={fontSize}
        width={labelWidth}
        height={labelHeight}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
};

export const KonvaElementRenderer: React.FC<KonvaElementRendererProps> = ({
  element,
  isSelected,
  onSelect,
  onDragMove,
  onDragEnd,
  onTransform,
  onTransformEnd,
  childrenElements = [],
  allElements = [],
  selectedIds = [],
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (element.type === 'image' && element.imageUrl) {
      const img = new window.Image();
      img.src = element.imageUrl;
      img.onload = () => {
        setImage(img);
      };
    }
  }, [element.imageUrl, element.type]);

  // Konva uses numeric values for colors and opacity
  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation || 0,
    draggable: true,
    opacity: element.style?.opacity ?? 1,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect?.(element.id, e.evt.shiftKey);
    },
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (pointerPos) {
        lastPos.current = { x: pointerPos.x, y: pointerPos.y };
      } else {
        lastPos.current = { x: e.target.x(), y: e.target.y() };
      }
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      
      if (!lastPos.current || !pointerPos) return;
      
      // 使用舞台相关的指针位置来计算 Delta，不受父节点变换（平移）影响
      const deltaX = pointerPos.x - lastPos.current.x;
      const deltaY = pointerPos.y - lastPos.current.y;
      
      lastPos.current = { x: pointerPos.x, y: pointerPos.y };
      onDragMove?.(element.id, deltaX, deltaY);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      lastPos.current = null;
      onDragEnd?.(element.id, e.target.x(), e.target.y());
    },
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node;
      onTransform?.(element.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * node.scaleX()),
        height: Math.max(5, node.height() * node.scaleY()),
        rotation: node.rotation(),
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Node;
      onTransformEnd?.(element.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * node.scaleX()),
        height: Math.max(5, node.height() * node.scaleY()),
        rotation: node.rotation(),
      });
      node.scaleX(1);
      node.scaleY(1);
    },
  };

  if (element.type === 'frame') {
    return (
      <Group 
        {...commonProps} 
        clipX={0} 
        clipY={0} 
        clipWidth={element.width} 
        clipHeight={element.height}
      >
        {/* Frame Background */}
        <Rect
          width={element.width}
          height={element.height}
          fill={element.style?.backgroundColor || '#fff'}
          cornerRadius={element.style?.borderRadius || 0}
          stroke={isSelected ? '#1890ff' : (element.style?.stroke || 'transparent')}
          strokeWidth={isSelected ? 2 : (element.style?.strokeWidth || 0)}
        />
        {/* Nested Elements */}
        {[...childrenElements].sort((a, b) => a.zIndex - b.zIndex).map(child => (
          <KonvaElementRenderer
            key={child.id}
            element={child}
            isSelected={selectedIds.includes(child.id)}
            allElements={allElements}
            selectedIds={selectedIds}
            childrenElements={allElements.filter(c => c.parentId === child.id)}
            onSelect={onSelect}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onTransform={onTransform}
            onTransformEnd={onTransformEnd}
          />
        ))}
      </Group>
    );
  }

  switch (element.type) {
    case 'rectangle':
      return (
        <Group {...commonProps}>
          <Rect
            width={element.width}
            height={element.height}
            fill={element.style?.backgroundColor || element.style?.fill || '#eee'}
            cornerRadius={element.style?.borderRadius || 0}
            stroke={isSelected ? '#1890ff' : (element.style?.stroke || 'transparent')}
            strokeWidth={isSelected ? 2 : (element.style?.strokeWidth || 0)}
          />
        </Group>
      );
    case 'image':
      return (
        <Group {...commonProps}>
          {image ? (
            <KonvaImage
              image={image}
              width={element.width}
              height={element.height}
              cornerRadius={element.style?.borderRadius || 0}
            />
          ) : (
            <Rect
              width={element.width}
              height={element.height}
              fill="#eee"
              cornerRadius={element.style?.borderRadius || 0}
            />
          )}
          {isSelected && (
            <Rect
              width={element.width}
              height={element.height}
              stroke="#1890ff"
              strokeWidth={2}
              cornerRadius={element.style?.borderRadius || 0}
              listening={false}
            />
          )}
        </Group>
      );
    case 'text':
      return (
        <Group {...commonProps}>
          <Text
            width={element.width}
            height={element.height}
            text={element.content || ''}
            fontSize={element.style?.fontSize || 14}
            fontFamily={element.style?.fontFamily || 'Arial'}
            fill={element.style?.fill || '#000'}
            align={element.style?.textAlign || 'left'}
            verticalAlign="middle"
          />
        </Group>
      );
    default:
      return null;
  }
};

export const TypeLabel: React.FC<{ text: string }> = ({ text }) => {
  const fontSize = 12;
  const labelHeight = 20;

  return (
    <Group y={-labelHeight - 4} listening={false}>
      <Text
        text={text}
        fill="#666"
        fontSize={fontSize}
        fontStyle="bold"
        height={labelHeight}
        verticalAlign="middle"
      />
    </Group>
  );
};
