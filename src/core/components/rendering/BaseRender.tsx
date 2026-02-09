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
 * @param editorState - 编辑器状态（已订阅，状态变更时会触发重渲染）
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
 * 基础用法：自动根据元素类型渲染对应组件
 * 高级用法：通过 customRender 配置自定义渲染逻辑
 * 
 * customRender 函数会自动订阅 EditorState 变更，状态变化时触发重渲染
 */
export const BaseRender = memo(function BaseRender({
  element,
  customRender,
  className,
  style,
}: BaseRenderProps) {
  const engine = useEngineInstance();
  
  // 订阅整个 EditorState，确保 customRender 可以响应任何状态变化
  const editorState = useEditorEngine(engine, (state) => state);

  // 获取对应元素类型的自定义渲染函数
  const customRenderer = customRender?.[element.type];
  
  // 如果有自定义渲染函数，使用自定义渲染
  if (customRenderer) {
    return <>{customRenderer(element, editorState)}</>;
  }
  
  // 默认渲染：根据元素类型选择对应组件
  switch (element.type) {
    case 'rectangle':
      return (
        <RectElement
          element={element}
          editorState={editorState}
          className={className}
          style={style}
        />
      );
    case 'text':
      return (
        <TextElement
          element={element}
          editorState={editorState}
          isEditing={editorState.interaction.editingId === element.id}
          onUpdate={(id, updates) => engine.updateElement(id, updates)}
          onStartEditing={(id) => engine.setEditingId(id)}
          onEndEditing={() => engine.setEditingId(null)}
          className={className}
          style={style}
        />
      );
    case 'image':
      return (
        <ImageElement
          element={element}
          editorState={editorState}
          className={className}
          style={style}
        />
      );
    case 'frame':
      return (
        <FrameElement
          element={element}
          editorState={editorState}
          className={className}
          style={style}
          customRender={customRender}
        />
      );
    default:
      return null;
  }
});

export default BaseRender;
