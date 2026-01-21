/**
 * 编辑器全局配置常量
 * 集中管理硬编码值，便于维护和调整
 */

export const EDITOR_CONFIG = {
  /** 缩放相关配置 */
  ZOOM: {
    MIN: 0.1,
    MAX: 5,
    STEP: 0.1,
  },

  /** 拖拽/吸附相关配置 */
  DRAG: {
    SNAP_THRESHOLD: 5,
  },

  /** 图片自动排版配置 */
  LAYOUT: {
    DEFAULT_GAP: 20,
    MAX_ROW_WIDTH: 3000,
  },

  /** 元素尺寸限制 */
  ELEMENT: {
    MIN_WIDTH: 10,
    MIN_HEIGHT: 10,
  },

  /** 图片随机尺寸范围 */
  IMAGE: {
    WIDTH: { MIN: 200, MAX: 800 },
    HEIGHT: { MIN: 150, MAX: 450 },
  },
} as const;

export type EditorConfig = typeof EDITOR_CONFIG;
