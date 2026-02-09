import { useEngineInstance } from '../../../react/context/useEngineInstance';
import { useEditorEngine } from '../../../react/hooks/useEditorEngine';
import type { ToolType } from '../../../engine/types';
import type { EditorState } from '../../../engine/EditorEngine';
import './InternalToolbar.css';

interface ToolConfig {
  type: ToolType;
  icon: string;
  label: string;
}

const TOOLS: ToolConfig[] = [
  { type: 'select', icon: '↖', label: 'Select' },
  { type: 'hand', icon: '✋', label: 'Hand tool' },
  { type: 'rectangle', icon: '⬜', label: 'Rectangle' },
  { type: 'text', icon: 'T', label: 'Text' },
  { type: 'frame', icon: '⊡', label: 'Frame' },
];

interface InternalToolbarProps {
  extra?: React.ReactNode;
}

export function InternalToolbar({ extra }: InternalToolbarProps) {
  const engine = useEngineInstance();
  
  // 订阅状态
  const activeTool = useEditorEngine(engine, (s: EditorState) => s.activeTool);
  const selectedIds = useEditorEngine(engine, (s: EditorState) => s.selectedIds);

  const handleReorder = (action: 'front' | 'back' | 'forward' | 'backward') => {
    engine.reorderElements(selectedIds, action);
  };

  const handleDelete = () => {
    engine.deleteElements(selectedIds);
  };

  return (
    <div className="editor-toolbar">
      {TOOLS.map((tool, index) => (
        <div key={tool.type}>
          {index === 2 && <div className="toolbar-divider" />}
          <button
            className={`toolbar-btn ${activeTool === tool.type ? 'active' : ''}`}
            onClick={() => engine.setActiveTool(tool.type)}
            data-tooltip={tool.label}
          >
            {tool.icon}
          </button>
        </div>
      ))}

      <div className="toolbar-divider" />
      <button
        className="toolbar-btn"
        onClick={() => engine.addImage()}
        data-tooltip="Add Image"
      >
        🖼️
      </button>

      {/* 注入业务插槽 */}
      {extra && (
        <>
          <div className="toolbar-divider" />
          {extra}
        </>
      )}

      {selectedIds.length > 0 && (
        <>
          <div className="toolbar-divider" />
          <button
            className="toolbar-btn reorder-btn"
            onClick={() => handleReorder('front')}
            data-tooltip="Bring to Front (Alt + ])"
          >
            ⤒
          </button>
          <button
            className="toolbar-btn reorder-btn"
            onClick={() => handleReorder('back')}
            data-tooltip="Send to Back (Alt + [)"
          >
            ⤓
          </button>
          <button
            className="toolbar-btn delete-btn"
            onClick={handleDelete}
            data-tooltip="Delete (Backspace)"
          >
            🗑️
          </button>
        </>
      )}
    </div>
  );
}
