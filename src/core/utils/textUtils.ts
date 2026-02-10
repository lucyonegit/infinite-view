import React from 'react';
import type { Element } from '../engine/types';

/**
 * 获取文本元素的通用样式 (用于渲染和镜像计算)
 */
export function getTextCommonStyle(element: Element): React.CSSProperties {
  const fontSize = element.style?.fontSize || 24;
  return {
    fontSize: fontSize,
    fontFamily: element.style?.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    textAlign: element.style?.textAlign || 'left',
    color: element.style?.fill || '#333',
    fontWeight: element.style?.fontWeight || 'normal',
    fontStyle: element.style?.fontStyle || 'normal',
    fontSynthesis: 'weight style', // 强制浏览器在字体缺少对应变体时进行合成
    textDecoration: element.style?.textDecoration || 'none',
    backgroundColor: element.style?.backgroundColor || 'transparent',
    padding: 0,
    margin: 0,
    lineHeight: '1.2',
    whiteSpace: !element.fixedWidth ? 'pre' : 'pre-wrap',
    wordBreak: !element.fixedWidth ? 'normal' : 'break-word',
  };
}

/**
 * 计算等比缩放后的新字号
 */
export function calculateNewFontSize(element: Element, newWidth: number): number {
  const widthScale = newWidth / element.width;
  const currentFontSize = element.style?.fontSize || 24;
  return Math.max(8, Math.round(currentFontSize * widthScale));
}
