import { useContext } from 'react';
import { EditorContext } from './EditorContext';
import { EditorEngine } from '../../engine/EditorEngine';

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
