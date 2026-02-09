import type { Element } from '../../../../engine/types';

/**
 * 拖拽事件
 */
export interface DragEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
  /** 位移 [dx, dy] */
  delta: [number, number];
  /** 原始事件 */
  inputEvent: MouseEvent | TouchEvent;
}

/**
 * 拖拽开始事件
 */
export interface DragStartEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
  /** 原始事件 */
  inputEvent: MouseEvent | TouchEvent;
}

/**
 * 拖拽结束事件
 */
export interface DragEndEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
}

/**
 * 缩放事件
 */
export interface ResizeEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
  /** 新宽度 */
  width: number;
  /** 新高度 */
  height: number;
  /** 缩放方向 */
  direction: [number, number];
  /** 是否是角点缩放 */
  isCorner: boolean;
}

/**
 * 缩放开始事件
 */
export interface ResizeStartEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
  /** 缩放方向 */
  direction: [number, number];
}

/**
 * 缩放结束事件
 */
export interface ResizeEndEvent {
  /** 元素 ID */
  elementId: string;
  /** 元素 */
  element: Element;
}

/**
 * Moveable 配置选项
 */
export interface MoveableOptions {
  /** 是否启用拖拽，默认 true */
  draggable?: boolean;
  /** 是否启用缩放，默认 true */
  resizable?: boolean;
  /** 是否启用吸附，默认 true */
  snappable?: boolean;
  /** 吸附阈值，默认 5 */
  snapThreshold?: number;
  /** 缩放手柄方向 */
  renderDirections?: string[];
}

/**
 * MoveableManager 组件 Props
 */
export interface MoveableManagerProps {
  /** 当前缩放级别 */
  zoom: number;
  /** 可选配置 */
  options?: MoveableOptions;
  /** 拖拽开始回调，返回 false 阻止拖拽 */
  onDragStart?: (e: DragStartEvent) => void | false;
  /** 拖拽中回调 */
  onDrag?: (e: DragEvent) => void;
  /** 拖拽结束回调 */
  onDragEnd?: (e: DragEndEvent) => void;
  /** 缩放开始回调 */
  onResizeStart?: (e: ResizeStartEvent) => void;
  /** 缩放中回调 */
  onResize?: (e: ResizeEvent) => void;
  /** 缩放结束回调 */
  onResizeEnd?: (e: ResizeEndEvent) => void;
}

/**
 * MoveableManager 暴露的 API
 */
export interface MoveableManagerRef {
  /** 手动触发拖拽 */
  dragStart: (event: MouseEvent | TouchEvent) => void;
  /** 更新目标元素 */
  updateTargets: () => void;
  /** 更新矩形 */
  updateRect: () => void;
}
