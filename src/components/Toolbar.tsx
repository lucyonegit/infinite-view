import { useCanvasStore } from '../store/canvasStore';
import type { ToolType } from '../types/canvas';
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
  const { activeTool, setActiveTool } = useCanvasStore();

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
    </div>
  );
}

export default Toolbar;
