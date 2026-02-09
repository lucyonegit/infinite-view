import React, { memo } from 'react';
import type { Element } from '../../engine/types';
import type { EditorState } from '../../engine/EditorEngine';
import { useEditorEngine } from '../../react/hooks/useEditorEngine';
import { useEngineInstance } from '../../react/context/useEngineInstance';
import { RectElement } from './elements/RectElement';
import { TextElement } from './elements/TextElement';
import { ImageElement } from './elements/ImageElement';
import { FrameElement } from './elements/FrameElement';

/**
 * 自定义渲染函数类型
 * @param element - 当前元素数据
 * @param editorState - 编辑器状态
 */
export type CustomRenderFn = (element: Element, editorState: EditorState) => React.ReactNode;

/**
 * 自定义渲染配置
 */
export interface CustomRenderConfig {
  /** 矩形/形状元素自定义渲染 */
  rectangle?: CustomRenderFn;
  /** 文字元素自定义渲染 */
  text?: CustomRenderFn;
  /** 图片元素自定义渲染 */
  image?: CustomRenderFn;
  /** Frame元素自定义渲染 */
  frame?: CustomRenderFn;
}

export interface BaseRenderProps {
  /** 元素数据 */
  element: Element;
  /** 自定义渲染配置（可选）*/
  customRender?: CustomRenderConfig;
  /** 额外的 className */
  className?: string;
  /** 额外的 style */
  style?: React.CSSProperties;
}

/**
 * BaseRender - 统一元素渲染入口
 * 
 * 优化策略：
 * 1. 使用 memo 避免父组件重渲染导致的无谓更新。
 * 2. 移除对整个 editorState 的订阅，改用粒度更细的订阅。
 * 3. 仅在选中状态或编辑状态变化时触发强制更新。
 */
export const BaseRender = memo(function BaseRender({
  element,
  customRender,
  className,
  style,
}: BaseRenderProps) {
  const engine = useEngineInstance();
  
  // 仅在必要时订阅局部状态（例如选中状态、编辑状态）
  // 这样当其他元素移动时，这个组件不会因为全局 state 变化而重渲染
  const isSelected = useEditorEngine(engine, (state) => state.selectedIds.includes(element.id));
  const isEditing = useEditorEngine(engine, (state) => state.interaction.editingId === element.id);
  
  // 如果有自定义渲染，我们才去获取全量状态（或者根据需要进一步优化）
  // 注意：这里我们拿到的 editorState 是一个快照，不会触发重渲染
  // 如果 customRender 需要实时状态，它应该自己内部使用 useEditorEngine
  const customRenderer = customRender?.[element.type];
  const customChildren = customRenderer ? customRenderer(element, engine.getState()) : null;
  
  // 默认渲染：根据元素类型选择对应组件
  switch (element.type) {
    case 'rectangle':
      return (
        <RectElement
          element={element}
          isSelected={isSelected}
          className={className}
          style={style}
        >
          {customChildren}
        </RectElement>
      );
    case 'text':
      return (
        <TextElement
          element={element}
          isSelected={isSelected}
          isEditing={isEditing}
          onUpdate={(id, updates) => engine.updateElement(id, updates)}
          onStartEditing={(id) => engine.setEditingId(id)}
          onEndEditing={() => engine.setEditingId(null)}
          className={className}
          style={style}
        >
          {customChildren}
        </TextElement>
      );
    case 'image':
      return (
        <ImageElement
          element={element}
          isSelected={isSelected}
          className={className}
          style={style}
        >
          {customChildren}
        </ImageElement>
      );
    case 'frame':
      return (
        <FrameElement
          element={element}
          isSelected={isSelected}
          className={className}
          style={style}
          customRender={customRender}
        >
          {customChildren}
        </FrameElement>
      );
    default:
      return null;
  }
});

export default BaseRender;
