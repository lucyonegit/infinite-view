import type { Element, EditorDataExport } from '../../engine/types';
import { EditorEngine } from '../../engine/EditorEngine';

/**
 * EditorAPI - 业务层操作编辑器的命令式接口
 */
export interface EditorAPI {
  // --- 元素管理 ---
  /** 添加一个元素，返回其 ID */
  addElement: (element: Omit<Element, 'id' | 'zIndex'>) => string;
  /** 更新指定元素 */
  updateElement: (id: string, updates: Partial<Element>) => void;
  /** 删除当前选中的元素 */
  deleteSelected: () => void;
  /** 获取所有元素列表 */
  getElements: () => Element[];
  /** 获取当前选中的元素列表 */
  getSelectedElements: () => Element[];

  // --- 视口控制 ---
  /** 设置缩放比例 (0.1 - 5) */
  setZoom: (zoom: number) => void;
  /** 将某个元素居中显示 */
  centerElement: (id: string) => void;
  /** 重置视口（缩放 100%，滚动到中心） */
  resetView: () => void;

  // --- 业务功能 ---
  /** 导出当前选中的元素（如果是 Frame/Text）为图片 DataURL */
  exportSelectionAsImage: () => Promise<string | null>;
  /** 导入编辑器数据 */
  importData: (data: EditorDataExport) => void;

  // --- 底层访问 ---
  /** 获取底层引擎实例（非必要不建议直接使用） */
  getEngine: () => EditorEngine;
}
