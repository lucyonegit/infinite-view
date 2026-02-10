import React from 'react';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  DeleteOutlined, 
  PictureOutlined,
  FontSizeOutlined,
  BorderOutlined,
  BlockOutlined,
  DragOutlined,
  SelectOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useEngineInstance } from '../../../react/context/useEngineInstance';
import { useEditorEngine } from '../../../react/hooks/useEditorEngine';
import type { ToolType } from '../../../engine/types';
import type { EditorState } from '../../../engine/EditorEngine';
import './InternalToolbar.css';

interface ToolConfig {
  type: ToolType;
  icon: React.ReactNode;
  label: string;
}

const TOOLS: ToolConfig[] = [
  { type: 'select', icon: <SelectOutlined />, label: 'Selection (V)' },
  { type: 'hand', icon: <DragOutlined />, label: 'Hand tool (H)' },
  { type: 'rectangle', icon: <BorderOutlined />, label: 'Rectangle (R)' },
  { type: 'text', icon: <FontSizeOutlined />, label: 'Text (T)' },
  { type: 'frame', icon: <BlockOutlined />, label: 'Frame (F)' },
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
    <div className="editor-sidebar">
      <div className="sidebar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            className={`sidebar-btn ${activeTool === tool.type ? 'active' : ''}`}
            onClick={() => engine.setActiveTool(tool.type)}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
        
        <button
          className="sidebar-btn"
          onClick={() => engine.addImage()}
          title="Add Image"
        >
          <PictureOutlined />
        </button>
      </div>

      {(selectedIds.length > 0) && (
        <div className="sidebar-group">
          <button
            className="sidebar-btn"
            onClick={() => handleReorder('front')}
            title="Bring to Front"
          >
            <ArrowUpOutlined />
          </button>
          <button
            className="sidebar-btn"
            onClick={() => handleReorder('back')}
            title="Send to Back"
          >
            <ArrowDownOutlined />
          </button>
          <button
            className="sidebar-btn delete"
            onClick={handleDelete}
            title="Delete"
          >
            <DeleteOutlined />
          </button>
        </div>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-group bottom">
        <button className="sidebar-btn disabled" title="Settings">
          <SettingOutlined />
        </button>
        {extra}
      </div>
    </div>
  );
}
