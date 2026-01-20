/**
 * 导出工具 - 将 Frame 或整个视口导出为图片
 */

import type { Element } from '../types/editor';

/**
 * 导出单个 Frame 为图片
 * @param frameElement Frame 元素
 * @param allElements 所有元素（用于获取子元素）
 * @param scale 导出缩放比例
 * @returns Promise<Blob>
 */
export async function exportFrameAsImage(
  frameElement: Element,
  allElements: Element[],
  scale: number = 2
): Promise<Blob> {
  // 获取 Frame 的子元素
  const children = allElements.filter(el => el.parentId === frameElement.id);

  // 创建 canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = frameElement.width * scale;
  canvas.height = frameElement.height * scale;

  ctx.scale(scale, scale);

  // 填充背景
  ctx.fillStyle = frameElement.style?.fill || '#ffffff';
  ctx.fillRect(0, 0, frameElement.width, frameElement.height);

  // 渲染子元素
  for (const child of children.sort((a, b) => a.zIndex - b.zIndex)) {
    await renderElementToCanvas(ctx, child, frameElement.x, frameElement.y);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
}

/**
 * 渲染单个元素到 canvas
 */
async function renderElementToCanvas(
  ctx: CanvasRenderingContext2D,
  element: Element,
  offsetX: number,
  offsetY: number
): Promise<void> {
  const x = element.x - offsetX;
  const y = element.y - offsetY;
  const { width, height } = element;

  ctx.save();

  // 应用旋转
  if (element.rotation) {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((element.rotation * Math.PI) / 180);
    ctx.translate(-(x + width / 2), -(y + height / 2));
  }

  // 设置圆角裁切
  if (element.style?.borderRadius) {
    roundRect(ctx, x, y, width, height, element.style.borderRadius);
    ctx.clip();
  }

  switch (element.type) {
    case 'rectangle':
      ctx.fillStyle = element.style?.fill || '#ffffff';
      if (element.style?.borderRadius) {
        roundRect(ctx, x, y, width, height, element.style.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }

      if (element.style?.stroke) {
        ctx.strokeStyle = element.style.stroke;
        ctx.lineWidth = element.style.strokeWidth || 1;
        if (element.style?.borderRadius) {
          roundRect(ctx, x, y, width, height, element.style.borderRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, width, height);
        }
      }
      break;

    case 'text':
      ctx.fillStyle = '#333333';
      ctx.font = `${element.style?.fontSize || 16}px ${element.style?.fontFamily || 'sans-serif'}`;
      ctx.textAlign = element.style?.textAlign || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element.content || '', x + width / 2, y + height / 2, width);
      break;

    case 'image':
      if (element.imageUrl) {
        try {
          const img = await loadImage(element.imageUrl);
          ctx.drawImage(img, x, y, width, height);
        } catch {
          // 如果图片加载失败，画一个占位符
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x, y, width, height);
          ctx.fillStyle = '#999';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📷', x + width / 2, y + height / 2);
        }
      }
      break;
  }

  ctx.restore();
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 加载图片
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 下载 Blob 为文件
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出选中的 Frame 为图片并下载
 */
export async function exportSelectedFrameAsImage(
  selectedId: string,
  elements: Element[],
  scale: number = 2
): Promise<void> {
  const frame = elements.find(el => el.id === selectedId && el.type === 'frame');
  if (!frame) {
    alert('请先选中一个 Frame');
    return;
  }

  try {
    const blob = await exportFrameAsImage(frame, elements, scale);
    const filename = `${frame.name || 'frame'}_${Date.now()}.png`;
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Export failed:', error);
    alert('导出失败');
  }
}
