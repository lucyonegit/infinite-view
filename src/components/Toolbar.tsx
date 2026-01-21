import { useEditorStore } from '../store/editorStore';
import type { ToolType } from '../types/editor';
import './Toolbar.css';

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

export function Toolbar() {
  const {
    activeTool,
    setActiveTool,
    selectedIds,
    reorderElements,
    deleteElements,
    addImage
  } = useEditorStore();

  const handleReorder = (action: 'front' | 'back' | 'forward' | 'backward') => {
    reorderElements(selectedIds, action);
  };

  const handleDelete = () => {
    deleteElements(selectedIds);
  };

  return (
    <div className="editor-toolbar">
      {TOOLS.map((tool, index) => (
        <div key={tool.type}>
          {index === 2 && <div className="toolbar-divider" />}
          <button
            className={`toolbar-btn ${activeTool === tool.type ? 'active' : ''}`}
            onClick={() => setActiveTool(tool.type)}
            data-tooltip={tool.label}
          >
            {tool.icon}
          </button>
        </div>
      ))}

      <div className="toolbar-divider" />
      <button
        className="toolbar-btn"
        onClick={() => addImage()}
        data-tooltip="Add Image"
      >
        🖼️
      </button>

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

export default Toolbar;
