import Konva from 'konva';
import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { Rect, Text, Group, Image as KonvaImage } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';
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
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const nodeRef = useRef<Konva.Group>(null);
  
  // 变换基础 - 用于在变换期间锁定 node.width/height，防止加速缩小的反馈环路
  const [baseDimensions, setBaseDimensions] = useState<{ width: number; height: number } | null>(null);
  // 实时尺寸 ref - 仅用于辅助 getClientRect
  const liveDimensions = useRef({ width: element.width, height: element.height });
  
  const { interaction, setInteraction } = useEditorStore();

  useLayoutEffect(() => {
    liveDimensions.current = { width: element.width, height: element.height };
  }, [element.width, element.height]);

  // 处理拖拽恢复
  useLayoutEffect(() => {
    if (interaction.draggingId === element.id && nodeRef.current) {
      const stage = nodeRef.current.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (pointerPos) {
        lastPos.current = { x: pointerPos.x, y: pointerPos.y };
        nodeRef.current.startDrag();
      }
    }
  }, [element.id, interaction.draggingId]);

  useEffect(() => {
    if (element.type === 'image' && element.imageUrl) {
      const img = new window.Image();
      img.src = element.imageUrl;
      img.onload = () => setImage(img);
    }
  }, [element.imageUrl, element.type]);

  // Konva uses numeric values for colors and opacity
  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    // 【关键】变换期间锁定 width/height 为起始值，让 scaleX/Y 承担所有变化量的表征
    width: baseDimensions ? baseDimensions.width : element.width,
    height: baseDimensions ? baseDimensions.height : element.height,
    rotation: element.rotation || 0,
    draggable: true,
    opacity: element.style?.opacity ?? 1,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect?.(element.id, e.evt.shiftKey);
    },
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (pointerPos) {
        lastPos.current = { x: pointerPos.x, y: pointerPos.y };
      } else {
        lastPos.current = { x: e.target.x(), y: e.target.y() };
      }
      setInteraction({ draggingId: element.id });
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (!lastPos.current || !pointerPos) return;
      const deltaX = pointerPos.x - lastPos.current.x;
      const deltaY = pointerPos.y - lastPos.current.y;
      lastPos.current = { x: pointerPos.x, y: pointerPos.y };
      onDragMove?.(element.id, deltaX, deltaY);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      lastPos.current = null;
      setInteraction({ draggingId: null });
      onDragEnd?.(element.id, e.target.x(), e.target.y());
    },
    onTransformStart: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      const node = e.target as Konva.Node;
      // 捕获起始尺寸
      setBaseDimensions({
        width: node.width(),
        height: node.height(),
      });
    },
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      const node = e.target as Konva.Node;
      if (!baseDimensions) return;

      const newWidth = Math.max(5, baseDimensions.width * node.scaleX());
      const newHeight = Math.max(5, baseDimensions.height * node.scaleY());
      
      liveDimensions.current = { width: newWidth, height: newHeight };
      
      onTransform?.(element.id, {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight,
        rotation: node.rotation(),
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      const node = e.target as Konva.Node;
      if (!baseDimensions) return;

      const finalWidth = Math.max(5, baseDimensions.width * node.scaleX());
      const finalHeight = Math.max(5, baseDimensions.height * node.scaleY());
      const finalRotation = node.rotation();
      const finalX = node.x();
      const finalY = node.y();

      // 清除变换态
      setBaseDimensions(null);

      // 同步最终物理属性到 Node
      node.setAttrs({
        scaleX: 1,
        scaleY: 1,
        width: finalWidth,
        height: finalHeight,
      });

      onTransformEnd?.(element.id, {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        rotation: finalRotation,
      });
    },
  };

  if (element.type === 'frame') {
    return (
      <Group 
        {...commonProps} 
        ref={nodeRef}
        clipX={0} 
        clipY={0} 
        clipWidth={element.width} 
        clipHeight={element.height}
        // getClientRect must return the ACTUAL visual bounds of the Frame
        // We calculate width * scaleX to get the true visual size, ignoring children
        getClientRect={() => {
          const node = nodeRef.current;
          if (!node) return { x: 0, y: 0, width: 0, height: 0 };
          
          // Calculate the ACTUAL visual size: node's local size * current scale
          const visualWidth = node.width() * node.scaleX();
          const visualHeight = node.height() * node.scaleY();
          const absPos = node.getAbsolutePosition();
          
          return {
            x: absPos.x,
            y: absPos.y,
            width: visualWidth,
            height: visualHeight
          };
        }}
      >
        {/* Frame Background */}
        <Rect
          name="frame-background"
          width={element.width}
          height={element.height}
          fill={element.style?.backgroundColor || '#fff'}
          cornerRadius={element.style?.borderRadius || 0}
          stroke={isSelected ? '#1890ff' : (element.style?.stroke || 'transparent')}
          strokeWidth={isSelected ? 2 : (element.style?.strokeWidth || 0)}
          strokeScaleEnabled={false} // 防拉伸：缩放时保持线条粗细不变
        />
        {/* Nested Elements - 包裹在独立的 Group 内并返回空包围盒，彻底隔离子元素对 Frame 包围盒的影响 */}
        <Group getClientRect={() => ({ x: 0, y: 0, width: 0, height: 0 })}>
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
      </Group>
    );
  }

  switch (element.type) {
    case 'rectangle':
      return (
        <Group {...commonProps} ref={nodeRef}>
          <Rect
            width={element.width}
            height={element.height}
            fill={element.style?.backgroundColor || element.style?.fill || '#eee'}
            cornerRadius={element.style?.borderRadius || 0}
            stroke={isSelected ? '#1890ff' : (element.style?.stroke || 'transparent')}
            strokeWidth={isSelected ? 2 : (element.style?.strokeWidth || 0)}
            strokeScaleEnabled={false}
          />
        </Group>
      );
    case 'image':
      return (
        <Group {...commonProps} ref={nodeRef}>
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
        <Group {...commonProps} ref={nodeRef}>
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
