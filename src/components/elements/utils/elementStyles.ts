import type { Element } from '../../../core/types';

/**
 * 获取元素的 CSS 样式
 */
export function getElementStyles(element: Element): React.CSSProperties {
  const { style } = element;
  if (!style) return {};

  const background = element.type === 'text'
    ? (style.backgroundColor || 'transparent')
    : (style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : style.fill);

  return {
    background,
    color: element.type === 'text' ? style.fill : undefined,
    border: style.stroke ? `${style.strokeWidth || 1}px solid ${style.stroke}` : undefined,
    borderRadius: style.borderRadius,
    opacity: style.opacity,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textAlign: style.textAlign,
  };
}
