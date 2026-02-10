import React, { useRef } from 'react';
import { EditorProvider, CoreEditor, type EditorAPI, type Element, type EditorDataExport } from '../core';

/**
 * EngineEditorPage - 演示如何集成核心编辑器并使用其 API
 */
export const EngineEditorPage: React.FC = () => {
  const apiRef = useRef<EditorAPI | null>(null);

  const handleAddBusinessImage = () => {
    apiRef.current?.addElement({
      type: 'image',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      imageUrl: `https://picsum.photos/seed/${Date.now()}/300/200`,
      style: { borderRadius: 12 },
      name: 'Business Asset'
    });
  };

  const handleExport = async () => {
    const dataUrl = await apiRef.current?.exportSelectionAsImage();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = 'export.png';
      link.href = dataUrl;
      link.click();
    } else {
      alert('请先选中一个 Frame 或 Text 元素进行导出');
    }
  };

  return (
    <EditorProvider>
      <div className="engine-editor-page" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 业务层 Header */}
        <header style={{ 
          height: '48px', 
          background: '#252525', 
          borderBottom: '1px solid #3a3a3a', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 16px',
          color: '#fff',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🎨</span>
            <span style={{ fontWeight: 600 }}>Business Editor Integration</span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleAddBusinessImage}
              style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #4a4a4a', background: '#333', color: '#fff', cursor: 'pointer' }}
            >
              + 业务素材
            </button>
            <button 
              onClick={handleExport}
              style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: '#1890ff', color: '#fff', cursor: 'pointer' }}
            >
              💾 业务导出
            </button>
            <button 
              onClick={() => window.location.href = "/"}
              style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: '#444', color: '#fff', cursor: 'pointer' }}
            >
              Back
            </button>
          </div>
        </header>

        {/* 核心编辑器容器 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <CoreEditor 
            apiRef={apiRef}
            slots={{
              toolbarExtra: (
                <button 
                  className="toolbar-btn" 
                  title="业务扩展工具"
                  onClick={() => alert('这是通过插槽注入的业务工具')}
                >
                  🛠️
                </button>
              )
            }}
            onDataChange={(data: EditorDataExport) => {
              console.log('Editor data changed:', data);
            }}
          />
        </div>

        {/* 业务层 Footer */}
        <footer style={{ height: '24px', background: '#252525', borderTop: '1px solid #3a3a3a', padding: '0 16px', fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center' }}>
          API-Powered Core Editor Ready.
        </footer>
      </div>
    </EditorProvider>
  );
};

export default EngineEditorPage;
