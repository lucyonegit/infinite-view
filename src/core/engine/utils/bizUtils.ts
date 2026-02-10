import type { Element } from '../types';

export function createRandomImageElement(url: string, viewportWidth: number, viewportHeight: number): Omit<Element, 'id' | 'zIndex'> {
  const imgWidth = Math.floor(Math.random() * (400 - 150 + 1)) + 150;
  const imgHeight = Math.floor(Math.random() * (400 - 150 + 1)) + 150;

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
