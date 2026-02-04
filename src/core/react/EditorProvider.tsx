import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EditorEngine } from '../EditorEngine';

const EditorContext = createContext<EditorEngine | null>(null);

interface EditorProviderProps {
  children: ReactNode;
  initialState?: any; // 可以根据需要定义更精确的类型
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

/**
 * useEngineInstance - 获取全局唯一的引擎实例
 * 用于手动调用引擎方法（命令式）
 */
export const useEngineInstance = (): EditorEngine => {
  const engine = useContext(EditorContext);
  if (!engine) {
    throw new Error('useEngineInstance must be used within an EditorProvider');
  }
  return engine;
};
