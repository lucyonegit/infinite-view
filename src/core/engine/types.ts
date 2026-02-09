/**
 * 编辑器类型定义
 */

// ============ 基础类型 ============

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============ 视口状态 ============

export interface Viewport {
  /** 视口偏移 X (屏幕像素) */
  x: number;
  /** 视口偏移 Y (屏幕像素) */
  y: number;
  /** 缩放级别 */
  zoom: number;
}

// ============ 工具类型 ============

export type ToolType = 'select' | 'hand' | 'rectangle' | 'text' | 'frame';

// ============ 元素类型 ============

export type ElementType = 'rectangle' | 'text' | 'image' | 'frame';

export interface ElementStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface Element {
  id: string;
  type: ElementType;
  /** 元素名称 */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  style?: ElementStyle;
  content?: string;      // 文本内容
  imageUrl?: string;     // 图片URL
  /** 父元素 ID (用于 Frame 包含关系) */
  parentId?: string;
  /** Frame 的子元素 ID 列表 */
  children?: string[];
  zIndex: number;
  locked?: boolean;      // 是否锁定
  visible?: boolean;     // 是否可见
  fixedWidth?: boolean;  // 是否固定宽度 (针对文本元素)
  /** 业务层自定义状态 */
  customState?: Record<string, unknown>;
}

// ============ 交互状态 ============

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface InteractionState {
  /** 是否正在拖拽元素 */
  isDragging: boolean;
  /** 是否正在平移视口 */
  isPanning: boolean;
  /** 是否正在缩放元素 */
  isResizing: boolean;
  /** 是否正在框选 */
  isMarqueeSelecting: boolean;
  /** 是否正在创建元素 */
  isCreating: boolean;
  /** 拖拽/操作起始点 (屏幕坐标) */
  startPoint?: Point;
  /** 当前缩放手柄 */
  resizeHandle?: ResizeHandle;
  /** 框选区域 (世界坐标) */
  marqueeRect?: Bounds;
  /** 正在创建的元素类型 */
  creatingType?: ElementType;
  /** 正在编辑中的元素 ID */
  editingId?: string | null;
  /** 是否正在进行全局交互（拖拽、缩放等），用于优化渲染性能 */
  isInteracting: boolean;
}

// ============ 编辑器状态 ============

export interface EditorState {
  viewport: Viewport;
  activeTool: ToolType;
  elements: Element[];
  selectedIds: string[];
  interaction: InteractionState;
  /** 拖动时悬停的 Frame ID */
  hoverFrameId: string | null;
  /** 最近一次选择操作的事件 (用于 Moveable 立即接管拖拽) */
  lastSelectionEvent: MouseEvent | TouchEvent | null;
}

// ============ 数据导出接口 (用于持久化预留) ============

export interface EditorDataExport {
  version: string;
  viewport: Viewport;
  elements: Element[];
}
