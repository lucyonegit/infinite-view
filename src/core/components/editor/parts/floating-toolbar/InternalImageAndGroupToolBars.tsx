import { Button, Space, Divider, Tooltip, ColorPicker, Slider, Popover } from 'antd';
import { DownloadOutlined, BgColorsOutlined, BorderInnerOutlined, ScissorOutlined, ExpandOutlined, RobotOutlined, ExperimentOutlined, AreaChartOutlined } from '@ant-design/icons';
import { useEngineInstance } from '../../../../react/context/useEngineInstance';
import type { Element } from '../../../../engine/types';

interface ImageToolBarProps {
  element: Element;
  onExport: () => void;
}

export const InternalImageToolBar: React.FC<ImageToolBarProps> = ({ element, onExport }) => {
  const engine = useEngineInstance();

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    engine.updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  return (
    <Space size={4} className="toolbar-group">
      <Space size={0}>
        <Tooltip title="填充/背景颜色">
          <ColorPicker 
            size="small" 
            value={element.style?.fill || 'transparent'} 
            onChange={(color) => handleUpdateStyle({ fill: color.toHexString() })} 
            showText 
          />
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
        <Tooltip title="边框颜色">
          <ColorPicker size="small" value={element.style?.stroke || 'transparent'} onChange={(color) => handleUpdateStyle({ stroke: color.toHexString() })}>
            <Button type="text" size="small" icon={<BgColorsOutlined />} />
          </ColorPicker>
        </Tooltip>
      </Space>
      <Divider type="vertical" />
      <Space size={0}>
        <Button size="small" type="text" icon={<ScissorOutlined />} onClick={() => console.log('AI Action: remove-bg')}>智能抠图</Button>
        <Button size="small" type="text" icon={<ExpandOutlined />} onClick={() => console.log('AI Action: upscale')}>高清修复</Button>
        <Button size="small" type="text" icon={<RobotOutlined />} onClick={() => console.log('AI Action: prompt')}>提取提示词</Button>
        <Button size="small" type="text" icon={<ExperimentOutlined />} onClick={() => console.log('AI Action: style')}>风格转换</Button>
        <Button size="small" type="text" icon={<AreaChartOutlined />} onClick={() => console.log('AI Action: analyze')}>图层分析</Button>
      </Space>
      <Divider type="vertical" />
      <Button size="small" type="text" icon={<DownloadOutlined />} onClick={onExport}>
        导出
      </Button>
    </Space>
  );
};

// --- Group Toolbar ---
export const InternalGroupToolBar: React.FC = () => {
  return (
    <Space size={4} className="toolbar-group">
      <span style={{ fontSize: '12px', color: '#8c8c8c', padding: '0 8px' }}>Multiple Selected</span>
    </Space>
  );
};
