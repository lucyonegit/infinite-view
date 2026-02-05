import React from 'react';
import { Button, Space, Divider, Tooltip, ColorPicker } from 'antd';
import { DownloadOutlined, BgColorsOutlined } from '@ant-design/icons';
import { useEngineInstance } from '../../../core/react/EditorProvider';
import type { Element } from '../../../core/types';

interface ImageToolBarProps {
  element: Element;
  onExport: () => void;
}

export const EngineImageToolBar: React.FC<ImageToolBarProps> = ({ element, onExport }) => {
  const engine = useEngineInstance();

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    engine.updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  return (
    <Space size={4} className="toolbar-group">
      <Space size={0}>
        <Tooltip title="圆角">
           <Button type="text" size="small">
             Radius: {element.style?.borderRadius || 0}
           </Button>
        </Tooltip>
        <Tooltip title="边框颜色">
          <ColorPicker size="small" value={element.style?.stroke || 'transparent'} onChange={(color) => handleUpdateStyle({ stroke: color.toHexString() })}>
            <Button type="text" size="small" icon={<BgColorsOutlined />} />
          </ColorPicker>
        </Tooltip>
      </Space>
      <Divider type="vertical" />
      <Button size="small" type="text" icon={<DownloadOutlined />} onClick={onExport}>
        导出
      </Button>
    </Space>
  );
};

// --- Group Toolbar ---
export const EngineGroupToolBar: React.FC = () => {
  return (
    <Space size={4} className="toolbar-group">
      <span style={{ fontSize: '12px', color: '#8c8c8c', padding: '0 8px' }}>Multiple Selected</span>
    </Space>
  );
};
