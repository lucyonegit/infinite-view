import Konva from 'konva';
import React, { useEffect, useState, useRef } from 'react';
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
  allElements?: Element[];
  selectedIds?: string[];
}

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
  
  // 基准捕获：使用 Ref 保证同步事件流中的数学稳定性，防止 Race Condition
  const baselineRef = useRef({ w: 0, h: 0 });
  const [currentScale, setCurrentScale] = useState({ sx: 1, sy: 1 });

  const { interaction, setInteraction } = useEditorStore();
  const isTransforming = interaction.transformingId === element.id;

  // 1. 处理拖拽恢复逻辑
  useEffect(() => {
    if (interaction.draggingId === element.id && nodeRef.current) {
      const stage = nodeRef.current.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (pointerPos) {
        lastPos.current = { x: pointerPos.x, y: pointerPos.y };
        nodeRef.current.startDrag();
      }
    }
  }, [element.id, interaction.draggingId]);

  // 2. 处理图片加载
  useEffect(() => {
    if (element.type === 'image' && element.imageUrl) {
      const img = new window.Image();
      img.src = element.imageUrl;
      img.onload = () => setImage(img);
    }
  }, [element.imageUrl, element.type]);

  // 3. 通用变换逻辑
  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    // 变换期间锁定物理宽/高，避免 Transformer 的内部数学模型漂移
    width: isTransforming ? baselineRef.current.w : element.width,
    height: isTransforming ? baselineRef.current.h : element.height,
    scaleX: isTransforming ? undefined : 1,
    scaleY: isTransforming ? undefined : 1,
    rotation: isTransforming ? undefined : (element.rotation || 0),
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
      if (pointerPos) lastPos.current = { x: pointerPos.x, y: pointerPos.y };
      setInteraction({ draggingId: element.id });
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointerPos = stage?.getRelativePointerPosition();
      if (!lastPos.current || !pointerPos) return;
      onDragMove?.(element.id, pointerPos.x - lastPos.current.x, pointerPos.y - lastPos.current.y);
      lastPos.current = { x: pointerPos.x, y: pointerPos.y };
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      lastPos.current = null;
      setInteraction({ draggingId: null });
      onDragEnd?.(element.id, e.target.x(), e.target.y());
    },
    onTransformStart: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      baselineRef.current = { w: element.width, h: element.height };
      setCurrentScale({ sx: 1, sy: 1 });
      setInteraction({ transformingId: element.id });
    },
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      const node = e.target as Konva.Node;
      const sx = node.scaleX();
      const sy = node.scaleY();
      
      setCurrentScale({ sx, sy });

      onTransform?.(element.id, {
        x: node.x(), y: node.y(),
        width: Math.max(5, baselineRef.current.w * sx),
        height: Math.max(5, baselineRef.current.h * sy),
        rotation: node.rotation(),
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      e.cancelBubble = true;
      const node = e.target as Konva.Node;
      const finalWidth = Math.max(5, baselineRef.current.w * node.scaleX());
      const finalHeight = Math.max(5, baselineRef.current.h * node.scaleY());
      
      setInteraction({ transformingId: null });
      setCurrentScale({ sx: 1, sy: 1 });

      // 手动规整 node 属性，接管 React 下次渲染
      node.setAttrs({ scaleX: 1, scaleY: 1, width: finalWidth, height: finalHeight });
      
      onTransformEnd?.(element.id, {
        x: node.x(), y: node.y(), width: finalWidth, height: finalHeight, rotation: node.rotation(),
      });
    },
  };

  if (element.type === 'frame') {
    const { sx, sy } = currentScale;
    const visualW = isTransforming ? baselineRef.current.w : element.width;
    const visualH = isTransforming ? baselineRef.current.h : element.height;

    return (
      <Group 
        {...commonProps} 
        ref={(node) => {
          if (node && element.type === 'frame') {
            // 【终极绝杀】必须直接修改实例方法。React-Konva 的 Prop 无法重写方法。
            // 强制 Transformer 的计算基准固定在背景矩形上，零误差忽略子元素。
            node.getClientRect = function(config?: any) {
              const bg = this.findOne('.frame-background');
              if (bg) return bg.getClientRect(config);
              return { x: 0, y: 0, width: 0, height: 0 };
            };
          }
          // @ts-ignore
          nodeRef.current = node;
        }}
        clipX={0} clipY={0} 
        clipWidth={visualW} clipHeight={visualH}
      >
        {/* 背景：作为视觉主控，同时是 Transformer 的计算源 */}
        <Rect
          name="frame-background"
          className="frame-background"
          width={visualW * sx}
          height={visualH * sy}
          scaleX={1 / sx} scaleY={1 / sy}
          fill={element.style?.backgroundColor || '#fff'}
          cornerRadius={element.style?.borderRadius || 0}
          stroke={isSelected ? '#1890ff' : (element.style?.stroke || 'transparent')}
          strokeWidth={isSelected ? 2 : (element.style?.strokeWidth || 0)}
          strokeScaleEnabled={false}
        />
        {/* 子元素：isTransforming 时 listening=false，防止事件穿透干扰 Transformer Handles */}
        <Group 
          scaleX={1 / sx} scaleY={1 / sy} 
          listening={!isTransforming}
        >
          {[...childrenElements].sort((a, b) => a.zIndex - b.zIndex).map(child => (
            <KonvaElementRenderer
              key={child.id} element={child} isSelected={selectedIds.includes(child.id)}
              allElements={allElements} selectedIds={selectedIds}
              childrenElements={allElements.filter(c => c.parentId === child.id)}
              onSelect={onSelect} onDragMove={onDragMove} onDragEnd={onDragEnd}
              onTransform={onTransform} onTransformEnd={onTransformEnd}
            />
          ))}
        </Group>
      </Group>
    );
  }

  // Rectangle, Image, Text
  switch (element.type) {
    case 'rectangle':
      return (
        <Group {...commonProps} ref={nodeRef}>
          <Rect width={element.width} height={element.height}
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
            <KonvaImage image={image} width={element.width} height={element.height} cornerRadius={element.style?.borderRadius || 0} />
          ) : (
            <Rect width={element.width} height={element.height} fill="#eee" cornerRadius={element.style?.borderRadius || 0} />
          )}
          {isSelected && (
            <Rect width={element.width} height={element.height} stroke="#1890ff" strokeWidth={2} cornerRadius={element.style?.borderRadius || 0} listening={false} />
          )}
        </Group>
      );
    case 'text':
      return (
        <Group {...commonProps} ref={nodeRef}>
          <Text width={element.width} height={element.height} text={element.content || ''}
            fontSize={element.style?.fontSize || 14} fontFamily={element.style?.fontFamily || 'Arial'}
            fill={element.style?.fill || '#000'} align={element.style?.textAlign || 'left'} verticalAlign="middle"
          />
        </Group>
      );
    default:
      return null;
  }
};

export const SizeLabel: React.FC<{ 
  width: number; height: number; isSelected: boolean; offsetY?: number;
}> = ({ width, height, isSelected, offsetY = -35 }) => {
  if (!isSelected) return null;
  const text = `${Math.round(width)} × ${Math.round(height)}`;
  const labelW = text.length * 7 + 12;
  return (
    <Group x={width - labelW} y={offsetY} listening={false}>
      <Rect width={labelW} height={20} fill="rgba(0,0,0,0.8)" cornerRadius={4} />
      <Text text={text} fill="white" fontSize={12} width={labelW} height={20} align="center" verticalAlign="middle" />
    </Group>
  );
};

export const TypeLabel: React.FC<{ text: string }> = ({ text }) => (
  <Group y={-24} listening={false}>
    <Text text={text} fill="#666" fontSize={12} fontStyle="bold" height={20} verticalAlign="middle" />
  </Group>
);
