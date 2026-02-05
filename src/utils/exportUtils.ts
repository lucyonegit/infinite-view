/**
 * 导出工具 - 将 Frame 或整个视口导出为图片
 */

import type { Element } from '../core/types';

/**
 * 导出单个 Frame 为图片
 * @param frameElement Frame 元素
 * @param allElements 所有元素（用于获取子元素）
 * @param scale 导出缩放比例
 * @returns Promise<Blob>
 */
export async function exportFrameAsCanvas(
  frameElement: Element,
  allElements: Element[],
  scale: number = 2
): Promise<HTMLCanvasElement> {
  // 获取 Frame 的子元素
  const children = allElements.filter(el => el.parentId === frameElement.id);
  console.log(`[Export] Frame dimensions: ${frameElement.width}x${frameElement.height}, children count: ${children.length}`);

  // 创建 canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = frameElement.width * scale;
  canvas.height = frameElement.height * scale;
  console.log(`[Export] Canvas size: ${canvas.width}x${canvas.height} (scale: ${scale})`);

  ctx.scale(scale, scale);

  // 填充背景
  ctx.fillStyle = frameElement.style?.fill || '#ffffff';
  ctx.fillRect(0, 0, frameElement.width, frameElement.height);

  // 渲染子元素
  for (const child of children.sort((a, b) => a.zIndex - b.zIndex)) {
    await renderElementToCanvas(ctx, child, allElements, 0, 0);
  }

  return canvas;
}

/**
 * 渲染单个元素到 canvas
 */
async function renderElementToCanvas(
  ctx: CanvasRenderingContext2D,
  element: Element,
  allElements: Element[],
  offsetX: number,
  offsetY: number
): Promise<void> {
  // 注意：store 中子元素的 x, y 是相对于父节点的
  // offsetX, offsetY 是父节点在 Canvas 中的绝对位置
  const x = element.x + offsetX;
  const y = element.y + offsetY;
  const { width, height } = element;

  ctx.save();

  // 应用旋转 (围绕元素中心)
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

  // 根据类型渲染
  switch (element.type) {
    case 'frame': {
      // 1. 渲染 Frame 背景
      ctx.fillStyle = element.style?.fill || '#ffffff';
      if (element.style?.borderRadius) {
        roundRect(ctx, x, y, width, height, element.style.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }

      // 2. 裁切子元素到 Frame 范围内
      ctx.save();
      if (element.style?.borderRadius) {
        roundRect(ctx, x, y, width, height, element.style.borderRadius);
      } else {
        ctx.beginPath();
        ctx.rect(x, y, width, height);
      }
      ctx.clip();

      // 3. 递归渲染子元素
      const children = allElements.filter(el => el.parentId === element.id);
      for (const child of children.sort((a, b) => a.zIndex - b.zIndex)) {
        await renderElementToCanvas(ctx, child, allElements, x, y);
      }
      ctx.restore();

      // 4. 渲染边框 (在子元素之上)
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
    }

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

    case 'text': {
      const fontSize = element.style?.fontSize || 24;
      const fontFamily = element.style?.fontFamily || 'sans-serif';
      const lineHeight = fontSize * 1.2;

      ctx.fillStyle = element.style?.fill || '#333333';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      const content = element.content || 'Double click to edit';
      const lines: string[] = [];

      // 分行逻辑保持不变...
      if (!element.fixedWidth) {
        lines.push(...content.split('\n'));
      } else {
        const paragraphs = content.split('\n');
        for (const paragraph of paragraphs) {
          if (paragraph === '') {
            lines.push('');
            continue;
          }
          const chars = paragraph.split('');
          let currentLine = '';
          for (let n = 0; n < chars.length; n++) {
            const testLine = currentLine + chars[n];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > width && n > 0) {
              lines.push(currentLine);
              currentLine = chars[n];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
        }
      }

      // 渲染背景 (如果有)
      if (element.style?.backgroundColor && element.style.backgroundColor !== 'transparent') {
        ctx.fillStyle = element.style.backgroundColor;
        ctx.fillRect(x, y, width, height || (lines.length * lineHeight));
      }

      // 渲染逻辑：根据 textAlign 手动计算每行的 X
      const alignment = element.style?.textAlign || 'left';
      ctx.textAlign = alignment as CanvasTextAlign;

      lines.forEach((line, index) => {
        let lineX = x;
        if (alignment === 'center') {
          lineX = x + width / 2;
        } else if (alignment === 'right') {
          lineX = x + width;
        }
        ctx.fillText(line, lineX, y + index * lineHeight);
      });
      break;
    }

    case 'image': {
      if (element.imageUrl) {
        try {
          const img = await loadImage(element.imageUrl);
          ctx.drawImage(img, x, y, width, height);
        } catch {
          // 如果图片加载失败，画一个占位符
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(x, y, width, height);
          ctx.fillStyle = '#999';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📷', x + width / 2, y + height / 2);
        }
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * 绘制圆角矩形路径
 * 实现 CSS 标准的圆角：半径不能超过宽/高的一半
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  // 1. 确保半径不为负数
  let r = Math.max(0, radius);

  // 2. 限制半径：半径不能超过宽或高的一半 (CSS 标准)
  // 如果半径过大，绘制出的路径会发生重叠导致诡异边缘
  const maxRadius = Math.min(width, height) / 2;
  if (r > maxRadius) {
    r = maxRadius;
  }

  // 3. 优先尝试使用原生方法 (现代浏览器支持)
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }

  // 4. 手动实现 (兼容旧环境)
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 加载图片（通过 fetch 获取 blob，避免跨域污染 canvas）
 * 对于跨域图片，先 fetch 为 blob，再创建 object URL
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  // 检查是否是 data URL 或 blob URL（这些不需要特殊处理）
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return loadImageDirectly(src);
  }

  // 检查是否是同源
  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin) {
      // 同源图片直接加载
      return loadImageDirectly(src);
    }
  } catch {
    // URL 解析失败，尝试直接加载
    return loadImageDirectly(src);
  }

  // 跨域图片：通过 fetch 获取 blob
  try {
    const response = await fetch(src, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
      const img = await loadImageDirectly(blobUrl);
      // 注意：这里不立即 revoke，因为 canvas 可能还需要使用
      // 在 exportFrameAsCanvas 完成后会释放
      return img;
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      throw err;
    }
  } catch {
    // fetch 失败，回退到直接加载（可能仍会污染 canvas）
    console.warn(`[Export] Failed to fetch image via blob, falling back to direct load: ${src}`);
    return loadImageDirectly(src);
  }
}

/**
 * 直接加载图片（不做跨域处理）
 */
function loadImageDirectly(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * 清理文件名，移除非法字符
 * 非法字符包括: / \ ? % * : | " < > 以及控制字符
 */
function sanitizeFilename(filename: string): string {
  // 移除非法字符
  let sanitized = filename.replace(/[/\\?%*:|"<>]/g, '_');

  // 移除控制字符 (0x00-0x1F) - 使用 Unicode 转义
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u001F]/g, '');

  // 移除首尾空格和点
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

  // 如果文件名为空，使用默认名
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'export';
  }

  // 限制文件名长度（不包括扩展名），大多数文件系统限制为255字节
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  return sanitized;
}

/**
 * 将 Data URL 转换为 Blob
 */
function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 下载 DataURL 为 PNG 文件
 * 使用 Blob + Object URL 方式，强制浏览器使用指定的文件名
 * @param dataUrl 图片的 DataURL
 * @param filename 文件名（可以包含或不包含 .png 扩展名）
 */
export function downloadDataURL(dataUrl: string, filename: string): void {
  // 分离文件名和扩展名，去掉原有扩展名
  const lastDotIndex = filename.lastIndexOf('.');
  let baseName: string;

  if (lastDotIndex > 0) {
    baseName = filename.substring(0, lastDotIndex);
  } else {
    baseName = filename;
  }

  // 清理文件名
  baseName = sanitizeFilename(baseName);

  // 确保扩展名为 png
  const safeFilename = `${baseName}.png`;

  console.log(`[Export] Triggering download: ${safeFilename}`);

  // 将 Data URL 转换为 Blob
  const blob = dataURLtoBlob(dataUrl);

  // 创建 Object URL（这是本地 URL，不会有跨域问题）
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = safeFilename;

  // 某些浏览器（如 Safari）对隐藏元素的点击不感冒，用更稳健的样式
  a.style.position = 'fixed';
  a.style.left = '-10000px';
  a.style.top = '-10000px';
  a.style.opacity = '0';

  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
  }, 1000);
}

/**
 * 导出单个元素为 Canvas（支持 text 类型）
 */
export async function exportElementAsCanvas(
  element: Element,
  allElements: Element[],
  scale: number = 2
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  canvas.width = element.width * scale;
  canvas.height = element.height * scale;
  ctx.scale(scale, scale);

  if (element.type === 'text') {
    // 文本元素：透明背景
    // 不需要 fillRect，保持透明
    await renderElementToCanvas(ctx, { ...element, x: 0, y: 0 }, allElements, 0, 0);
  } else if (element.type === 'frame') {
    // Frame 元素：渲染背景和子元素
    ctx.fillStyle = element.style?.fill || '#ffffff';
    ctx.fillRect(0, 0, element.width, element.height);

    const children = allElements.filter(el => el.parentId === element.id);
    for (const child of children.sort((a, b) => a.zIndex - b.zIndex)) {
      await renderElementToCanvas(ctx, child, allElements, 0, 0);
    }
  } else {
    // 其他元素
    await renderElementToCanvas(ctx, { ...element, x: 0, y: 0 }, allElements, 0, 0);
  }

  return canvas;
}

/**
 * 导出选中的元素为图片并下载（支持 Frame 和 Text）
 */
export async function exportSelectedElementAsImage(
  selectedId: string,
  elements: Element[],
  scale: number = 2
): Promise<void> {
  const element = elements.find(el => el.id === selectedId);
  if (!element) {
    alert('请先选中一个元素');
    return;
  }

  // 目前只支持 frame 和 text 类型
  if (element.type !== 'frame' && element.type !== 'text') {
    alert('目前仅支持导出 Frame 和 Text 元素');
    return;
  }

  try {
    console.log(`[Export] Exporting ${element.type}:`, selectedId);
    const canvas = await exportElementAsCanvas(element, elements, scale);

    // 清理文件名中的非法字符
    const sanitizedName = sanitizeFilename(element.name || element.type);
    const filename = `${sanitizedName}_${Date.now()}.png`;

    console.log('[Export] Canvas ready, converting to blob...');

    const dataUrl = canvas.toDataURL('image/png');
    const blob = dataURLtoBlob(dataUrl);

    console.log(`[Export] Blob created, size: ${blob.size}, downloading as: ${filename}`);

    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);

    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    }, 5000);

    console.log('[Export] Download triggered successfully');

  } catch (error) {
    console.error('[Export] Failed:', error);
    alert('导出失败，请检查控制台日志');
  }
}

/**
 * 导出选中的 Frame 为图片并下载（向后兼容）
 * @deprecated 使用 exportSelectedElementAsImage 替代
 */
export async function exportSelectedFrameAsImage(
  selectedId: string,
  elements: Element[],
  scale: number = 2
): Promise<void> {
  return exportSelectedElementAsImage(selectedId, elements, scale);
}

