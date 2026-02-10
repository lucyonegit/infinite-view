import React from 'react';
import { ColorPicker, Button, Divider, Space, Tooltip, Dropdown, Slider, Popover } from 'antd';
import { DownloadOutlined, MoreOutlined, BgColorsOutlined, BorderInnerOutlined } from '@ant-design/icons';
import { useEngineInstance } from '../../../../react/context/useEngineInstance';
import type { Element } from '../../../../engine/types';

interface ShapeToolBarProps {
  element: Element;
  onExport: () => void;
}

export const InternalShapeToolBar: React.FC<ShapeToolBarProps> = ({ element, onExport }) => {
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
        <Popover
          trigger="click"
          content={
            <div style={{ width: 140, padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: '12px', color: '#8c8c8c' }}>圆角大小</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{element.style?.borderRadius || 0}px</span>
              </div>
              <Slider
                min={0}
                max={200}
                value={element.style?.borderRadius || 0}
                onChange={(val: number) => handleUpdateStyle({ borderRadius: val })}
                style={{ margin: '6px 4px' }}
              />
            </div>
          }
        >
          <Button size="small" type="text" icon={<BorderInnerOutlined />} />
        </Popover>
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
