import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type MouseEvent,
  type WheelEvent,
} from "react";
import "./SimpleInfiniteCanvas.css";

interface SimpleInfiniteCanvasProps {
  children: ReactNode;
  /** 画布宽度 */
  canvasWidth?: number;
  /** 画布高度 */
  canvasHeight?: number;
  /** 初始缩放 */
  initialZoom?: number;
  /** 最小缩放 */
  minZoom?: number;
  /** 最大缩放 */
  maxZoom?: number;
  /** 缩放变化回调 */
  onZoomChange?: (zoom: number) => void;
  /** 位置变化回调 */
  onPositionChange?: (x: number, y: number) => void;
}

/**
 * 简单的无限画布组件
 *
 * 核心原理说明：
 * ===============
 *
 * 1. **坐标系统**
 *    - 视口坐标 (Viewport): 用户看到的屏幕坐标
 *    - 画布坐标 (Canvas): 画布内容的实际坐标
 *    - 转换公式: canvasPos = (viewportPos - offset) / zoom
 *
 * 2. **平移 (Pan)**
 *    - 通过 CSS transform: translate(x, y) 移动整个画布
 *    - 记录鼠标拖拽的起始位置和当前偏移量
 *    - 拖拽时更新偏移量: newOffset = startOffset + (currentMouse - startMouse)
 *
 * 3. **缩放 (Zoom)**
 *    - 通过 CSS transform: scale(zoom) 缩放画布
 *    - 关键点: 缩放需要以鼠标位置为中心
 *    - 公式: newOffset = mousePos - (mousePos - oldOffset) * (newZoom / oldZoom)
 *
 * 4. **性能优化**
 *    - 使用 transform 而非 top/left，触发 GPU 加速
 *    - 使用 will-change: transform 提示浏览器优化
 */
export function SimpleInfiniteCanvas({
  children,
  canvasWidth = 4000,
  canvasHeight = 4000,
  initialZoom = 1,
  minZoom = 0.1,
  maxZoom = 5,
  onZoomChange,
  onPositionChange,
}: SimpleInfiniteCanvasProps) {
  // ============ State ============

  /** 当前缩放级别 */
  const [zoom, setZoom] = useState(initialZoom);

  /** 画布偏移量 (相对于视口左上角) */
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  /** 是否正在拖拽 */
  const [isDragging, setIsDragging] = useState(false);

  /** 拖拽起始点 (鼠标位置) */
  const dragStartRef = useRef({ x: 0, y: 0 });

  /** 拖拽起始时的偏移量 */
  const offsetStartRef = useRef({ x: 0, y: 0 });

  /** 容器 DOM 引用 */
  const containerRef = useRef<HTMLDivElement>(null);

  /** 存储回调的 refs */
  const callbacksRef = useRef({ onZoomChange, onPositionChange });

  // 保持 callbacks ref 最新
  useEffect(() => {
    callbacksRef.current = { onZoomChange, onPositionChange };
  });

  // ============ 回调通知 ============

  useEffect(() => {
    callbacksRef.current.onZoomChange?.(zoom);
  }, [zoom]);

  useEffect(() => {
    callbacksRef.current.onPositionChange?.(offset.x, offset.y);
  }, [offset]);

  // ============ 平移逻辑 ============

  /**
   * 开始拖拽
   * 记录鼠标起始位置和当前偏移量
   */
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;

      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      offsetStartRef.current = { ...offset };

      // 防止选中文本
      e.preventDefault();
    },
    [offset]
  );

  /**
   * 拖拽中
   * 计算新的偏移量 = 起始偏移 + 鼠标移动距离
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setOffset({
        x: offsetStartRef.current.x + deltaX,
        y: offsetStartRef.current.y + deltaY,
      });
    },
    [isDragging]
  );

  /**
   * 结束拖拽
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * 鼠标离开容器时也结束拖拽
   */
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ============ 缩放逻辑 ============

  /**
   * 滚轮缩放
   *
   * 核心算法: 以鼠标位置为中心进行缩放
   *
   * 设:
   *   - mousePos: 鼠标在视口中的位置
   *   - oldOffset: 缩放前的偏移量
   *   - oldZoom: 缩放前的缩放级别
   *   - newZoom: 缩放后的缩放级别
   *
   * 缩放后，鼠标下的画布点应该保持不动，因此:
   *   (mousePos - oldOffset) / oldZoom = (mousePos - newOffset) / newZoom
   *
   * 解得:
   *   newOffset = mousePos - (mousePos - oldOffset) * (newZoom / oldZoom)
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      // 获取鼠标在容器中的位置
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 计算新的缩放级别
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1; // 向下滚动缩小，向上放大
      const newZoom = Math.min(Math.max(zoom * zoomDelta, minZoom), maxZoom);

      // 以鼠标位置为中心计算新的偏移量
      const zoomRatio = newZoom / zoom;
      const newOffsetX = mouseX - (mouseX - offset.x) * zoomRatio;
      const newOffsetY = mouseY - (mouseY - offset.y) * zoomRatio;

      setZoom(newZoom);
      setOffset({ x: newOffsetX, y: newOffsetY });
    },
    [zoom, offset, minZoom, maxZoom]
  );

  // ============ 渲染 ============

  return (
    <div
      ref={containerRef}
      className={`simple-canvas-container ${isDragging ? "dragging" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      {/* 画布层 - 应用 transform 变换 */}
      <div
        className="simple-canvas-viewport"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0", // 变换原点设为左上角，便于计算
        }}
      >
        {children}
      </div>

      {/* 调试信息 */}
      <div className="simple-canvas-debug">
        <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
        <div>
          Offset: ({offset.x.toFixed(0)}, {offset.y.toFixed(0)})
        </div>
        <div className="debug-hint">拖拽平移 | 滚轮缩放</div>
      </div>
    </div>
  );
}

export default SimpleInfiniteCanvas;
