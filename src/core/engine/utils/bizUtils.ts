import type { Element } from '../types';

export const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80',
  'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80',
  'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=800&q=80',
  'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&q=80',
];

export function createRandomImageElement(viewportWidth: number, viewportHeight: number): Omit<Element, 'id' | 'zIndex'> {
  const url = MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)];
  const imgWidth = 300;
  const imgHeight = 200;

  return {
    type: 'image',
    name: '图片',
    x: Math.random() * (viewportWidth - imgWidth),
    y: Math.random() * (viewportHeight - imgHeight),
    width: imgWidth,
    height: imgHeight,
    imageUrl: url,
    rotation: 0,
    locked: false,
    visible: true,
  };
}

/**
 * 创建指定属性的图片元素
 */
export function createImageElement(params: Partial<Element>): Omit<Element, 'id' | 'zIndex'> {
  return {
    type: 'image',
    name: '图片',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    imageUrl: '',
    rotation: 0,
    locked: false,
    visible: true,
    ...params,
  };
}
