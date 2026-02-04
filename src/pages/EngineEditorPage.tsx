import React from 'react';
import { EditorProvider } from '../core/react/EditorProvider';
import { EngineInfiniteEditor } from '../components/engine/EngineInfiniteEditor';

/**
 * EngineEditorPage - 基于 EditorEngine 的完整编辑器页面
 */
export const EngineEditorPage: React.FC = () => {
  return (
    <EditorProvider>
      <div className="engine-editor-page" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <EngineInfiniteEditor />
      </div>
    </EditorProvider>
  );
};

export default EngineEditorPage;
