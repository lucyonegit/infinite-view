import React from 'react';
import '../FloatingToolbar.css';

const COLORS = [
  '#333333', '#ffffff', '#ff4d4f', '#52c41a', '#1890ff', '#fadb14', '#722ed1', '#eb2f96'
];

interface ColorPickerProps {
  onSelect: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ onSelect }) => {
  return (
    <div className="color-picker-bubble">
      {COLORS.map(color => (
        <button
          key={color}
          className="color-swatch"
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
        />
      ))}
      <button 
        className="color-swatch transparent" 
        title="Transparent"
        onClick={() => onSelect('transparent')}
      />
    </div>
  );
};
