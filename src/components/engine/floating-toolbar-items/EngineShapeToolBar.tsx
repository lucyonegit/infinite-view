import React from 'react';
import { ColorPicker, Button, Divider, Space, Tooltip, Dropdown } from 'antd';
import { DownloadOutlined, MoreOutlined, BgColorsOutlined } from '@ant-design/icons';
import { useEngineInstance } from '../../../core/react/EditorProvider';
import type { Element } from '../../../types/editor';

interface ShapeToolBarProps {
  element: Element;
  onExport: () => void;
}

export const EngineShapeToolBar: React.FC<ShapeToolBarProps> = ({ element, onExport }) => {
  const engine = useEngineInstance();

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    engine.updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  return (
    <Space size={4} className="toolbar-group">
      <Space size={0}>
        <Tooltip title="填充颜色">
          <ColorPicker 
            size="small" 
            value={element.style?.fill || '#ffffff'} 
            onChange={(color) => handleUpdateStyle({ fill: color.toHexString() })} 
            showText 
          />
        </Tooltip>
        <Tooltip title="边框颜色">
          <ColorPicker 
            size="small" 
            value={element.style?.stroke || 'transparent'} 
            onChange={(color) => handleUpdateStyle({ stroke: color.toHexString() })}
          >
            <Button type="text" size="small" icon={<BgColorsOutlined />} />
          </ColorPicker>
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      <Dropdown 
        menu={{ 
          items: [{ key: 'export', icon: <DownloadOutlined />, label: '导出图片', onClick: onExport }] 
        }} 
        placement="bottomRight"
      >
        <Button size="small" type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </Space>
  );
};
