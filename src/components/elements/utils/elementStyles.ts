import type { Element } from '../../../types/editor';

/**
 * 获取元素的 CSS 样式
 */
export function getElementStyles(element: Element): React.CSSProperties {
  const { style } = element;
  if (!style) return {};

  return {
    background: style.fill,
    border: style.stroke ? `${style.strokeWidth || 1}px solid ${style.stroke}` : undefined,
    borderRadius: style.borderRadius,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    textAlign: style.textAlign,
  };
}
