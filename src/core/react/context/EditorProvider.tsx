import React, { useState, type ReactNode } from 'react';
import { EditorEngine, type EditorState } from '../../engine/EditorEngine';
import { EditorContext } from './EditorContext';

interface EditorProviderProps {
  children: ReactNode;
  initialState?: Partial<EditorState>;
}

/**
 * EditorProvider - 为组件树提供 EditorEngine 实例
 */
export const EditorProvider: React.FC<EditorProviderProps> = ({ children, initialState }) => {
  // 核心引擎实例在组件挂载期间只创建一次
  const [engine] = useState(() => new EditorEngine(initialState));

  return (
    <EditorContext.Provider value={engine}>
      {children}
    </EditorContext.Provider>
  );
};
