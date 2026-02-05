/**
 * Core React Components
 * 
 * 提供统一的元素渲染组件，支持基础渲染和自定义渲染模式
 */

// 统一渲染入口
export { BaseRender } from './BaseRender';
export type { BaseRenderProps, CustomRenderConfig, CustomRenderFn } from './BaseRender';

// 基础元素组件
export { RectElement } from './RectElement';
export { TextElement } from './TextElement';
export { ImageElement } from './ImageElement';
export { FrameElement } from './FrameElement';
