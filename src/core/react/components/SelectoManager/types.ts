/**
 * 选择事件
 */
export interface SelectEvent {
  /** 选中的元素 ID 列表 */
  selectedIds: string[];
  /** 原始事件 */
  inputEvent: MouseEvent;
  /** 是否是 Shift 多选 */
  isAdditive: boolean;
}

/**
 * 选择结束事件
 */
export interface SelectEndEvent {
  /** 最终选中的元素 ID 列表 */
  selectedIds: string[];
  /** 是否发生了拖拽 */
  isDragStart: boolean;
}

/**
 * Selecto 配置选项
 */
export interface SelectoOptions {
  /** 选择容器，默认 document.body */
  dragContainer?: HTMLElement | string;
  /** 可选择目标选择器，默认 ['.element'] */
  selectableTargets?: string[];
  /** 是否支持点击选择，默认 true */
  selectByClick?: boolean;
  /** 是否从内部开始选择，默认 false */
  selectFromInside?: boolean;
}

/**
 * SelectoManager 组件 Props
 */
export interface SelectoManagerProps {
  /** 可选配置 */
  options?: SelectoOptions;
  /** 选择回调 */
  onSelect?: (e: SelectEvent) => void;
  /** 选择结束回调 */
  onSelectEnd?: (e: SelectEndEvent) => void;
}

/**
 * SelectoManager 暴露的 API
 */
export interface SelectoManagerRef {
  /** 同步选中状态到 Selecto 内部 */
  setSelectedTargets: (ids: string[]) => void;
}
