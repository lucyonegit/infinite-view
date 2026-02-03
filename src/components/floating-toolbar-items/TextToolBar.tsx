import React from 'react';
import { 
  ColorPicker, 
  Select, 
  Button, 
  Divider, 
  Space, 
  Tooltip,
  Dropdown,
  type MenuProps
} from 'antd';
import { 
  BoldOutlined, 
  ItalicOutlined, 
  AlignLeftOutlined, 
  AlignCenterOutlined, 
  AlignRightOutlined,
  MoreOutlined,
  DownloadOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import { useEditorStore } from '../../store/editorStore';
import type { Element } from '../../types/editor';

interface TextToolBarProps {
  element: Element;
  onExport: () => void;
}

const FONT_FAMILIES = [
  { label: '黑体', value: 'SimHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Roboto', value: 'Roboto' },
];

const FONT_SIZES = [
  '12px', '14px', '15px', '16px', '18px', '20px', '24px', '32px', '48px', '64px'
];

export const TextToolBar: React.FC<TextToolBarProps> = ({ element, onExport }) => {
  const { updateElement } = useEditorStore();

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  const moreItems: MenuProps['items'] = [
    {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '导出图片',
      onClick: onExport,
    },
  ];

  return (
    <Space size={4} className="toolbar-group" style={{ padding: '0 4px' }}>
      {/* 字体颜色与背景颜色 */}
      <Space size={0}>
        <Tooltip title="文字颜色">
          <ColorPicker
            size="small"
            value={element.style?.fill || '#000000'}
            onChange={(color) => handleUpdateStyle({ fill: color.toHexString() })}
            showText
          />
        </Tooltip>
        <Tooltip title="背景颜色">
          <ColorPicker
            size="small"
            value={element.style?.backgroundColor || 'transparent'}
            onChange={(color) => handleUpdateStyle({ backgroundColor: color.toHexString() })}
          >
             <Button type="text" size="small" icon={<BgColorsOutlined />} />
          </ColorPicker>
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      {/* 字体族 */}
      <Select
        size="small"
        placeholder="字体"
        value={element.style?.fontFamily || 'SimHei'}
        onChange={(val) => handleUpdateStyle({ fontFamily: val })}
        options={FONT_FAMILIES}
        variant="borderless"
        style={{ width: 80 }}
      />

      {/* 字体大小 */}
      <Select
        size="small"
        placeholder="大小"
        value={element.style?.fontSize ? `${element.style.fontSize}px` : '15px'}
        onChange={(val) => handleUpdateStyle({ fontSize: parseInt(val) })}
        options={FONT_SIZES.map(s => ({ label: s, value: s }))}
        variant="borderless"
        style={{ width: 70 }}
      />

      <Divider type="vertical" />

      {/* 加粗 & 斜体 */}
      <Space size={2}>
        <Button
          size="small"
          type={element.style?.fontWeight === 'bold' ? 'primary' : 'text'}
          icon={<BoldOutlined />}
          onClick={() => handleUpdateStyle({ fontWeight: element.style?.fontWeight === 'bold' ? 'normal' : 'bold' })}
        />
        <Button
          size="small"
          type={element.style?.fontStyle === 'italic' ? 'primary' : 'text'}
          icon={<ItalicOutlined />}
          onClick={() => handleUpdateStyle({ fontStyle: element.style?.fontStyle === 'italic' ? 'normal' : 'italic' })}
        />
      </Space>

      {/* 对齐方式 */}
      <Select
        size="small"
        value={element.style?.textAlign || 'left'}
        onChange={(val) => handleUpdateStyle({ textAlign: val })}
        variant="borderless"
        suffixIcon={null}
        style={{ width: 32 }}
        options={[
          { label: <AlignLeftOutlined />, value: 'left' },
          { label: <AlignCenterOutlined />, value: 'center' },
          { label: <AlignRightOutlined />, value: 'right' },
        ]}
      />

      <Divider type="vertical" />

      {/* 更多 */}
      <Dropdown menu={{ items: moreItems }} placement="bottomRight">
        <Button size="small" type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </Space>
  );
};
