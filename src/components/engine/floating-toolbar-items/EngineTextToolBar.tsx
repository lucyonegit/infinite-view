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
import { useEngineInstance } from '../../../core/react/EditorProvider';
import { useEditorEngine } from '../../../core/react/useEditorEngine';
import type { Element } from '../../../core/types';

interface TextToolBarProps {
  element: Element;
  onExport: () => void;
}

const FONT_SIZES = [
  '12px', '14px', '15px', '16px', '18px', '20px', '24px', '32px', '48px', '64px'
];

const CustomArrow = () => (
  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.6, display: 'block' }}>
    <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const EngineTextToolBar: React.FC<TextToolBarProps> = ({ element, onExport }) => {
  const engine = useEngineInstance();
  
  // 订阅状态
  const localFonts = useEditorEngine(engine, s => s.localFonts);
  const isFontLoading = useEditorEngine(engine, s => s.isFontLoading);

  React.useEffect(() => {
    engine.loadLocalFonts();
  }, [engine]);

  const [fontWidth, setFontWidth] = React.useState(100);
  const [sizeWidth, setSizeWidth] = React.useState(60);
  const fontMeasureRef = React.useRef<HTMLSpanElement>(null);
  const sizeMeasureRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    if (fontMeasureRef.current) {
      setFontWidth(Math.max(60, fontMeasureRef.current.offsetWidth + 28));
    }
  }, [element.style?.fontFamily, isFontLoading]);

  React.useLayoutEffect(() => {
    if (sizeMeasureRef.current) {
      setSizeWidth(Math.max(45, sizeMeasureRef.current.offsetWidth + 28));
    }
  }, [element.style?.fontSize]);

  const handleUpdateStyle = (updates: Partial<NonNullable<Element['style']>>) => {
    engine.updateElement(element.id, {
      style: { ...element.style, ...updates }
    });
  };

  const moreItems: MenuProps['items'] = [
    { key: 'export', icon: <DownloadOutlined />, label: '导出图片', onClick: onExport },
  ];

  return (
    <Space size={4} className="toolbar-group" style={{ padding: '0 4px' }}>
      <span ref={fontMeasureRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 500, pointerEvents: 'none' }}>
        {element.style?.fontFamily || 'Arial'}
      </span>
      <span ref={sizeMeasureRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontSize: '12px', pointerEvents: 'none' }}>
        {element.style?.fontSize ? `${element.style.fontSize}px` : '15px'}
      </span>

      <Space size={0}>
        <Tooltip title="文字颜色">
          <ColorPicker size="small" value={element.style?.fill || '#000000'} onChange={(color) => handleUpdateStyle({ fill: color.toHexString() })} showText />
        </Tooltip>
        <Tooltip title="背景颜色">
          <ColorPicker size="small" value={element.style?.backgroundColor || 'transparent'} onChange={(color) => handleUpdateStyle({ backgroundColor: color.toHexString() })}>
             <Button type="text" size="small" icon={<BgColorsOutlined />} />
          </ColorPicker>
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      <Select
        size="small"
        placeholder="字体"
        loading={isFontLoading}
        showSearch
        suffixIcon={<CustomArrow />}
        filterOption={(input, option) => (option?.searchValue as string ?? '').toLowerCase().includes(input.toLowerCase())}
        value={element.style?.fontFamily || 'Arial'}
        onChange={(val) => handleUpdateStyle({ fontFamily: val })}
        options={localFonts.map(f => ({
          ...f,
          searchValue: f.label,
          label: <span style={{ fontFamily: f.value }}>{f.label}</span>
        }))}
        variant="borderless"
        style={{ width: fontWidth, fontWeight: 500, transition: 'width 0.2s' }}
      />

      <Select
        size="small"
        placeholder="大小"
        suffixIcon={<CustomArrow />}
        value={element.style?.fontSize ? `${element.style.fontSize}px` : '15px'}
        onChange={(val) => handleUpdateStyle({ fontSize: parseInt(val) })}
        options={FONT_SIZES.map(s => ({ label: s, value: s }))}
        variant="borderless"
        style={{ width: sizeWidth, transition: 'width 0.2s' }}
      />
 
      <Divider type="vertical" />
 
      <Space size={2} onMouseDown={(e) => e.preventDefault()}>
        <Button size="small" type={element.style?.fontWeight === 'bold' ? 'primary' : 'text'} icon={<BoldOutlined />} onClick={() => handleUpdateStyle({ fontWeight: element.style?.fontWeight === 'bold' ? 'normal' : 'bold' })} />
        <Button size="small" type={element.style?.fontStyle === 'italic' ? 'primary' : 'text'} icon={<ItalicOutlined />} onClick={() => handleUpdateStyle({ fontStyle: element.style?.fontStyle === 'italic' ? 'normal' : 'italic' })} />
      </Space>
 
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'left', icon: <AlignLeftOutlined />, label: '左对齐' },
            { key: 'center', icon: <AlignCenterOutlined />, label: '居中对齐' },
            { key: 'right', icon: <AlignRightOutlined />, label: '右对齐' },
          ],
          selectable: true,
          selectedKeys: [element.style?.textAlign || 'left'],
          onSelect: ({ key }) => handleUpdateStyle({ textAlign: key as 'left' | 'center' | 'right' }),
        }}
      >
        <Button size="small" type="text" onMouseDown={(e) => e.preventDefault()} icon={
            element.style?.textAlign === 'center' ? <AlignCenterOutlined /> :
            element.style?.textAlign === 'right' ? <AlignRightOutlined /> :
            <AlignLeftOutlined />
        }/>
      </Dropdown>
 
      <Divider type="vertical" />
 
      <Dropdown menu={{ items: moreItems }} placement="bottomRight">
        <Button size="small" type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </Space>
  );
};
