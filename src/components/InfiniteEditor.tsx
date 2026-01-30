import Konva from 'konva';
import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect, Transformer, Group } from 'react-konva';
import { useEditorStore } from '../store/editorStore';
import { Toolbar } from './Toolbar';
import { KonvaElementRenderer, SizeLabel, TypeLabel } from './elements/KonvaElementRenderer';
import { FloatingToolbar } from './FloatingToolbar';
import type { Point, Bounds, Element, ElementType } from '../types/editor';
import './InfiniteEditor.css';

/**
 * 无限视口编辑器主组件 - Canvas (Konva) 版本
 */
export function InfiniteEditor({ onBack }: { onBack?: () => void }) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [marqueeRect, setMarqueeRect] = useState<Bounds | null>(null);

  const {
    activeTool,
    elements,
    selectedIds,
    interaction,
    updateElement,
    moveElements,
    setSelectedIds,
    deselectAll,
    startCreating,
    finishCreating,
    reorderElements,
    syncFrameNesting,
    getElementWorldPos,
  } = useEditorStore();

  // ============ 坐标转换 ============

  const worldToScreen = useCallback((worldX: number, worldY: number): Point => {
    const stage = stageRef.current;
    if (!stage) return { x: worldX, y: worldY };

    const transform = stage.getAbsoluteTransform();
    const pos = transform.point({ x: worldX, y: worldY });
    return pos;
  }, []);

  // ============ 缩放 & 平移 ============

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (e.evt.ctrlKey || e.evt.metaKey) {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;
      const clampedScale = Math.min(Math.max(newScale, 0.1), 10);

      setZoom(clampedScale);
      setStagePos({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
    } else {
      // Normal scroll translates
      setStagePos(prev => ({
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY,
      }));
    }
  };

  // ============ Transformer 逻辑 ============

  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      const stage = stageRef.current;
      const transformer = transformerRef.current;
      
      const selectedNodes = selectedIds
        .map(id => stage.findOne('#' + id))
        .filter((node): node is Konva.Node => !!node);
        
      transformer.nodes(selectedNodes);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedIds, elements]);

  // ============ 交互逻辑 ============

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      const pos = e.target.getStage()?.getRelativePointerPosition();
      if (!pos) return;

      if (['select', 'rectangle', 'text', 'frame'].includes(activeTool)) {
        setMarqueeRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
      
      if (['rectangle', 'text', 'frame'].includes(activeTool)) {
        startCreating(activeTool as ElementType, pos);
      }
      deselectAll();
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (marqueeRect) {
      const pos = e.target.getStage()?.getRelativePointerPosition();
      if (pos) {
        const nextRect = {
          ...marqueeRect,
          width: pos.x - marqueeRect.x,
          height: pos.y - marqueeRect.y,
        };
        setMarqueeRect(nextRect);

        if (activeTool === 'select') {
          // Real-time selection
          const box = {
            x1: Math.min(nextRect.x, nextRect.x + nextRect.width),
            y1: Math.min(nextRect.y, nextRect.y + nextRect.height),
            x2: Math.max(nextRect.x, nextRect.x + nextRect.width),
            y2: Math.max(nextRect.y, nextRect.y + nextRect.height),
          };

          const selected = elements.filter(el => {
            return (
              el.x < box.x2 &&
              el.x + el.width > box.x1 &&
              el.y < box.y2 &&
              el.y + el.height > box.y1
            );
          }).map(el => el.id);

          setSelectedIds(selected);
          if (selected.length > 0) {
            reorderElements(selected, 'front');
          }
        }
      }
    }
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getRelativePointerPosition();
    
    if (interaction.isCreating && pos) {
      finishCreating(pos);
    }
    
    setMarqueeRect(null);
  };

  // ============ 渲染 ============

  const sortedElements = useMemo(() => 
    [...elements].sort((a, b) => a.zIndex - b.zIndex),
  [elements]);

  const selectionBoundingBox = useMemo(() => {
    if (selectedIds.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const worldPos = getElementWorldPos(id);
        minX = Math.min(minX, worldPos.x);
        minY = Math.min(minY, worldPos.y);
        maxX = Math.max(maxX, worldPos.x + el.width);
        maxY = Math.max(maxY, worldPos.y + el.height);
      }
    });
    return minX === Infinity ? null : { 
      x: minX, y: minY, width: maxX - minX, height: maxY - minY, 
      centerX: minX + (maxX - minX) / 2 
    };
  }, [selectedIds, elements, getElementWorldPos]);

  return (
    <div className="infinite-editor">
      <header className="editor-header">
        <div className="editor-header-left">
          <span className="editor-logo">🎨</span>
          <span className="editor-title">Canvas Editor (Konva)</span>
        </div>
        <div className="editor-header-center">
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom(z => z / 1.1)}>−</button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => z * 1.1)}>+</button>
            <button className="zoom-btn" onClick={() => { setZoom(1); setStagePos({ x: 0, y: 0 }); }} title="Reset">⟲</button>
          </div>
        </div>
        <div className="editor-header-right">
          {onBack && <button className="back-btn" onClick={onBack}>← Back</button>}
        </div>
      </header>
      <Toolbar />
      
      <div className="editor-viewer-container">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight}
          ref={stageRef}
          draggable={activeTool === 'hand'}
          onWheel={handleWheel}
          scaleX={zoom}
          scaleY={zoom}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            <Rect 
              x={-5000} y={-5000} width={10000} height={10000} 
              fill="#f9f9f9" 
              listening={false} 
            />
            {sortedElements.filter(el => !el.parentId).map(el => (
              <KonvaElementRenderer
                key={el.id}
                element={el}
                isSelected={selectedIds.includes(el.id)}
                selectedIds={selectedIds}
                allElements={elements}
                childrenElements={sortedElements.filter(child => child.parentId === el.id)}
                onSelect={(id, shift) => {
                  if (activeTool !== 'select') return;
                  if (shift) {
                    const nextIds = selectedIds.includes(id) 
                      ? selectedIds.filter(sid => sid !== id) 
                      : [...selectedIds, id];
                    setSelectedIds(nextIds);
                    if (!selectedIds.includes(id)) {
                      reorderElements([id], 'front');
                    }
                  } else {
                    setSelectedIds([id]);
                    reorderElements([id], 'front');
                  }
                }}
                onDragMove={(id, deltaX, deltaY) => {
                  // 关键：先更新元素位置到新位置
                  if (selectedIds.includes(id)) {
                    moveElements(selectedIds, deltaX, deltaY);
                  } else {
                    moveElements([id], deltaX, deltaY);
                  }

                  // 然后检查 Frame 嵌套（使用已更新的位置）
                  // addToFrame/removeFromFrame 会基于新的世界坐标计算相对坐标
                  const stage = stageRef.current;
                  if (stage) {
                    const pointerPos = stage.getRelativePointerPosition();
                    if (pointerPos) {
                      syncFrameNesting(id, pointerPos);
                    }
                  }
                }}
                onDragEnd={() => {
                  // 不在这里更新坐标！
                  // 原因：onDragMove 已经通过 moveElements 更新了正确的坐标
                  // 如果在这里用 Konva 节点的 x/y，当元素父级变化后节点被重建，
                  // 返回的可能是错误的坐标，会覆盖 addToFrame 计算的正确相对坐标
                }}
                onTransform={(id, attrs) => updateElement(id, attrs)}
                onTransformEnd={(id, attrs) => updateElement(id, attrs)}
              />
            ))}
            {selectedIds.length > 1 && selectionBoundingBox && (
              <Rect
                x={selectionBoundingBox.x}
                y={selectionBoundingBox.y}
                width={selectionBoundingBox.width}
                height={selectionBoundingBox.height}
                fill="rgba(0,0,0,0)"
                draggable
                onDragStart={(e) => {
                  e.target.attrs.lastPos = { x: e.target.x(), y: e.target.y() };
                }}
                onDragMove={(e) => {
                  const lastPos = e.target.attrs.lastPos;
                  const deltaX = e.target.x() - lastPos.x;
                  const deltaY = e.target.y() - lastPos.y;
                  e.target.attrs.lastPos = { x: e.target.x(), y: e.target.y() };
                  moveElements(selectedIds, deltaX, deltaY);
                }}
                onDragEnd={(e) => {
                  delete e.target.attrs.lastPos;
                }}
              />
            )}
            <Transformer 
              ref={transformerRef}
              enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-right', 'bottom-right', 'bottom-center', 'bottom-left', 'middle-left']}
              anchorSize={8}
              anchorCornerRadius={2}
              anchorFill="#fff"
              anchorStroke="#1890ff"
              anchorStrokeWidth={1}
              borderStroke="#1890ff"
              borderStrokeWidth={1}
              rotateEnabled={true}
              keepRatio={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                return newBox;
              }}
            />
            {marqueeRect && (
              <Rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill="rgba(24, 144, 255, 0.1)"
                stroke="#1890ff"
                strokeWidth={1}
              />
            )}
            {marqueeRect && interaction.isCreating && (
              <Group x={marqueeRect.x} y={marqueeRect.y}>
                <SizeLabel 
                  width={marqueeRect.width} 
                  height={marqueeRect.height} 
                  isSelected={true} 
                  offsetY={-25} // Slightly less offset for creation preview
                />
                {(activeTool === 'frame' || (activeTool as string) === 'image') && (
                  <TypeLabel text={`#${activeTool}`} />
                )}
              </Group>
            )}
            {elements.map(el => {
              if (el.type !== 'frame' && el.type !== 'image') return null;
              const worldPos = getElementWorldPos(el.id);
              return (
                <Group key={`type-label-${el.id}`} x={worldPos.x} y={worldPos.y}>
                  <TypeLabel text={`#${el.type}`} />
                </Group>
              );
            })}
            {elements.map(el => {
              const worldPos = getElementWorldPos(el.id);
              return (
                <Group 
                  key={`label-${el.id}`}
                  x={worldPos.x} 
                  y={worldPos.y} 
                  rotation={el.rotation}
                >
                  <SizeLabel 
                    width={el.width} 
                    height={el.height} 
                    isSelected={true} 
                    offsetY={-35} 
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {selectionBoundingBox && (
        <FloatingToolbarWrapper 
          bbox={selectionBoundingBox}
          selectedIds={selectedIds}
          elements={elements}
          worldToScreen={worldToScreen}
        />
      )}

      <div className="editor-statusbar">
        <span className="status-item"><span className="status-label">Zoom:</span>{Math.round(zoom * 100)}%</span>
        <span className="status-item"><span className="status-label">Elements:</span>{elements.length}</span>
        {selectedIds.length > 0 && <span className="status-item"><span className="status-label">Selected:</span>{selectedIds.length}</span>}
      </div>
    </div>
  );
}

interface FloatingToolbarWrapperProps {
  bbox: { x: number; y: number; width: number; height: number; centerX: number };
  selectedIds: string[];
  elements: Element[];
  worldToScreen: (x: number, y: number) => Point;
}

function FloatingToolbarWrapper({ bbox, selectedIds, elements, worldToScreen }: FloatingToolbarWrapperProps) {
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const pos = worldToScreen(bbox.centerX, bbox.y);
    // Use functional update or check to minimize renders, though ESLint might still complain
    setScreenPos(prev => (Math.abs(prev.x - pos.x) < 0.1 && Math.abs(prev.y - pos.y) < 0.1) ? prev : pos);
  }, [bbox, worldToScreen]);

  const selectedElement = selectedIds.length === 1 ? elements.find(el => el.id === selectedIds[0]) : undefined;
  
  if (screenPos.x === 0 && screenPos.y === 0) return null;

  return (
    <FloatingToolbar 
      x={screenPos.x} 
      y={screenPos.y}
      element={selectedElement}
      onExport={() => alert('Exporting via Konva stage.toDataURL()...')}
    />
  );
}

export default InfiniteEditor;
