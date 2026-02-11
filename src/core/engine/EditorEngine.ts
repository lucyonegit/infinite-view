import type {
  Viewport,
  Element,
  InteractionState,
  ToolType,
  Point,
  ElementType,
  Bounds
} from './types';
import { calculateNewFontSize } from '../utils/textUtils';
import { ViewportManager } from './modules/ViewportManager';
import { ElementManager } from './modules/ElementManager';
import { InteractionManager } from './modules/InteractionManager';
import { getElementWorldPos, findFrameAtPoint } from './utils';

export interface EditorState {
  viewport: Viewport;
  elements: Element[];
  selectedIds: string[];
  interaction: InteractionState;
  activeTool: ToolType;
  hoverFrameId: string | null;
  lastSelectionEvent: MouseEvent | TouchEvent | null;
  /** 字体相关 */
  localFonts: { label: string; value: string }[];
  isFontLoading: boolean;
}

export interface EditorDataExport {
  version: string;
  viewport: Viewport;
  elements: Element[];
}

const initialViewport: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

const initialInteraction: InteractionState = {
  isDragging: false,
  isPanning: false,
  isResizing: false,
  isInteracting: false,
  isMarqueeSelecting: false,
  isCreating: false,
  editingId: null,
};

const DEFAULT_FONTS = [
  { label: '黑体', value: 'SimHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Roboto', value: 'Roboto' },
];

export type Listener = (state: EditorState) => void;

/**
 * EditorEngine - 核心编辑器引擎
 * 负责所有的状态维护和业务逻辑，完全脱离 React 和 Zustand。
 */
export class EditorEngine {
  private state: EditorState;
  private listeners: Set<Listener> = new Set();
  private batchDepth = 0;
  private needsNotify = false;

  constructor(initialState?: Partial<EditorState>) {
    this.state = {
      viewport: initialViewport,
      elements: [],
      selectedIds: [],
      interaction: initialInteraction,
      activeTool: 'select',
      hoverFrameId: null,
      lastSelectionEvent: null,
      localFonts: DEFAULT_FONTS,
      isFontLoading: false,
      ...initialState,
    };
  }

  // ========== 基础状态接口 ==========

  public getState(): EditorState {
    return this.state;
  }

  private setState(updates: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) {
    const newState = typeof updates === 'function' ? updates(this.state) : updates;
    this.state = { ...this.state, ...newState };

    if (this.batchDepth > 0) {
      this.needsNotify = true;
    } else {
      this.notify();
    }
  }

  /**
   * 批量执行多次状态更新，最后只进行一次通知
   */
  public transaction(fn: () => void) {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.needsNotify) {
        this.needsNotify = false;
        this.notify();
      }
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // ========== 视口操作 (Viewport) ==========

  public setViewport(updates: Partial<Viewport>) {
    this.setState(state => ({
      viewport: ViewportManager.setViewport(state.viewport, updates)
    }));
  }

  public pan(deltaX: number, deltaY: number) {
    this.setState(state => ({
      viewport: ViewportManager.pan(state.viewport, deltaX, deltaY)
    }));
  }

  public zoomTo(zoom: number, centerX?: number, centerY?: number) {
    this.setState(state => ({
      viewport: ViewportManager.zoomTo(state.viewport, zoom, centerX, centerY)
    }));
  }

  public resetViewport() {
    this.setState({ viewport: initialViewport });
  }

  // ========== 元素操作 (Elements) ==========

  public addElement(element: Omit<Element, 'id' | 'zIndex'>): string {
    let newId = '';
    this.setState(state => {
      const { id, elements } = ElementManager.addElement(state.elements, element);
      newId = id;
      return { elements };
    });
    return newId;
  }

  public updateElement(id: string, updates: Partial<Element>) {
    this.setState(state => ({
      elements: ElementManager.updateElement(state.elements, id, updates)
    }));
  }

  public deleteElements(ids: string[]) {
    this.setState(state => ({
      elements: ElementManager.deleteElements(state.elements, ids),
      selectedIds: state.selectedIds.filter(id => !ids.includes(id))
    }));
  }

  public moveElements(ids: string[], deltaX: number, deltaY: number) {
    this.setState(state => ({
      elements: ElementManager.moveElements(state.elements, ids, deltaX, deltaY)
    }));
  }

  public resizeElement(id: string, bounds: Bounds) {
    this.setState(state => ({
      elements: ElementManager.resizeElement(state.elements, id, bounds)
    }));
  }

  // --- 高级交互方法 (Encapsulated Interaction Logic) ---

  /**
   * 处理拖拽交互
   * @param ids 正在拖拽的元素 ID 列表
   * @param delta 偏移量 [dx, dy]
   * @param mouseWorld 鼠标当前的世界坐标 (用于检测 Frame 进入)
   */
  public handleDrag(ids: string[], delta: [number, number], mouseWorld?: Point) {
    if (ids.length === 0) return;

    this.setState((state) => InteractionManager.handleDrag(state.elements, state.hoverFrameId, ids, delta, mouseWorld));
  }

  /**
   * 处理缩放交互
   * @param id 元素 ID
   * @param bounds 新的几何属性
   * @param isCorner 是否是角点缩放 (决定 Text 元素是否缩放字体)
   * @param originalElement 缩放开始时的原始元素状态 (用于 textUtils 计算)
   */
  public handleResize(id: string, bounds: Partial<Bounds>, isCorner: boolean, originalElement?: Element) {
    this.setState(state => {
      const idx = state.elements.findIndex(el => el.id === id);
      if (idx === -1) return {};

      const el = state.elements[idx];
      const updates: Partial<Element> = {};

      // 文字特殊处理
      if (el.type === 'text') {
        if (isCorner && originalElement && bounds.width) {
          // 角点缩放：等比缩放字体，更新位置和宽度
          const newFontSize = calculateNewFontSize(originalElement, bounds.width);
          if (bounds.x !== undefined) updates.x = bounds.x;
          if (bounds.y !== undefined) updates.y = bounds.y;
          updates.width = bounds.width;
          updates.style = { ...el.style, fontSize: newFontSize };
        } else {
          // 侧边缩放：仅更新宽度，设置固定宽度模式（高度会由 ResizeObserver 自动调整）
          if (bounds.x !== undefined) updates.x = bounds.x;
          if (bounds.y !== undefined) updates.y = bounds.y;
          if (bounds.width !== undefined) updates.width = bounds.width;
          updates.fixedWidth = true;
        }
      } else {
        // 普通元素：同步更新所有属性
        Object.assign(updates, bounds);
      }

      const nextElements = [...state.elements];
      nextElements[idx] = { ...el, ...updates };

      return { elements: nextElements };
    });
  }

  // ========== 交互与选择 (Interaction & Selection) ==========

  public setActiveTool(tool: ToolType) {
    this.setState({
      activeTool: tool,
      selectedIds: tool === 'select' ? this.state.selectedIds : [],
    });
  }

  public selectElements(ids: string[], additive = false, event?: MouseEvent | TouchEvent) {
    this.setState({
      selectedIds: additive
        ? [...new Set([...this.state.selectedIds, ...ids])]
        : ids,
      lastSelectionEvent: event || null,
    });
  }

  public deselectAll() {
    this.setState({ selectedIds: [], lastSelectionEvent: null });
  }

  public reorderElements(ids: string[], action: 'front' | 'back' | 'forward' | 'backward') {
    this.setState(state => ({
      elements: ElementManager.reorderElements(state.elements, ids, action)
    }));
  }

  // ========== Frame 父子关系 (Frames) ==========

  public getElementWorldPos(id: string): Point {
    return getElementWorldPos(this.state.elements, id);
  }

  public addToFrame(elementId: string, frameId: string) {
    const { elements } = this.state;
    const element = elements.find(el => el.id === elementId);
    const frame = elements.find(el => el.id === frameId);

    if (!element || !frame || frame.type !== 'frame') return;
    if (element.parentId === frameId) return;

    const worldPos = this.getElementWorldPos(elementId);
    const frameWorldPos = this.getElementWorldPos(frameId);

    this.setState({
      elements: elements.map((el) => {
        if (el.id === elementId) {
          const relativeX = worldPos.x - frameWorldPos.x;
          const relativeY = worldPos.y - frameWorldPos.y;
          return { ...el, parentId: frameId, x: relativeX, y: relativeY };
        }
        if (el.id === frameId) {
          const children = el.children || [];
          if (!children.includes(elementId)) {
            return { ...el, children: [...children, elementId] };
          }
        }
        if (el.type === 'frame' && el.children?.includes(elementId) && el.id !== frameId) {
          return { ...el, children: el.children.filter(id => id !== elementId) };
        }
        return el;
      }),
    });
  }

  public removeFromFrame(elementId: string) {
    const { elements } = this.state;
    const element = elements.find(el => el.id === elementId);
    if (!element || !element.parentId) return;

    const oldParentId = element.parentId;
    const worldPos = this.getElementWorldPos(elementId);

    this.setState({
      elements: elements.map((el) => {
        if (el.id === elementId) {
          return { ...el, parentId: undefined, x: worldPos.x, y: worldPos.y };
        }
        if (el.id === oldParentId) {
          return { ...el, children: (el.children || []).filter(id => id !== elementId) };
        }
        return el;
      }),
    });
  }

  public setHoverFrame(frameId: string | null) {
    this.setState({ hoverFrameId: frameId });
  }

  public findFrameAtPoint(x: number, y: number, excludeIds: string[] = []): Element | null {
    return findFrameAtPoint(this.state.elements, x, y, excludeIds);
  }

  // ========== 高级交互 (Interaction Logic) ==========

  public startPanning(startPoint: Point) {
    this.setState({
      interaction: {
        ...initialInteraction,
        isPanning: true,
        startPoint,
      },
    });
  }

  public stopPanning() {
    this.setState({
      interaction: { ...this.state.interaction, isPanning: false, startPoint: undefined },
    });
  }

  public startDragging(startPoint: Point) {
    this.setState({
      interaction: {
        ...this.state.interaction,
        isDragging: true,
        isInteracting: true,
        startPoint,
      },
    });
  }

  public stopDragging() {
    this.setState({
      interaction: { ...this.state.interaction, isDragging: false, isInteracting: false, startPoint: undefined },
    });
  }

  public startMarqueeSelect(startPoint: Point) {
    this.setState({
      interaction: {
        ...initialInteraction,
        isMarqueeSelecting: true,
        startPoint,
        marqueeRect: { x: startPoint.x, y: startPoint.y, width: 0, height: 0 },
      },
    });
  }

  public updateMarqueeSelect(currentPoint: Point) {
    const { interaction } = this.state;
    if (!interaction.startPoint) return;

    const x = Math.min(interaction.startPoint.x, currentPoint.x);
    const y = Math.min(interaction.startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - interaction.startPoint.x);
    const height = Math.abs(currentPoint.y - interaction.startPoint.y);

    this.setState({
      interaction: {
        ...interaction,
        marqueeRect: { x, y, width, height },
      },
    });
  }

  public finishMarqueeSelect() {
    const { interaction, elements } = this.state;
    const { marqueeRect } = interaction;

    if (marqueeRect && marqueeRect.width > 5 && marqueeRect.height > 5) {
      const selectedIds = elements
        .filter((el) => {
          const worldPos = this.getElementWorldPos(el.id);
          return (
            worldPos.x < marqueeRect.x + marqueeRect.width &&
            worldPos.x + el.width > marqueeRect.x &&
            worldPos.y < marqueeRect.y + marqueeRect.height &&
            worldPos.y + el.height > marqueeRect.y
          );
        })
        .map((el) => el.id);

      this.setState({ selectedIds });
    }

    this.setState({
      interaction: { ...initialInteraction },
    });
  }

  public startCreating(type: ElementType, startPoint: Point) {
    this.setState({
      interaction: {
        ...initialInteraction,
        isCreating: true,
        creatingType: type,
        startPoint,
      },
    });
  }

  public finishCreating(endPoint: Point): Element | null {
    const { interaction } = this.state;
    if (!interaction.startPoint || !interaction.creatingType) {
      this.setState({ interaction: initialInteraction });
      return null;
    }

    const x = Math.min(interaction.startPoint.x, endPoint.x);
    const y = Math.min(interaction.startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - interaction.startPoint.x);
    const height = Math.abs(endPoint.y - interaction.startPoint.y);

    const isClick = width < 5 && height < 5;
    if (interaction.creatingType !== 'text' && isClick) {
      this.setState({ interaction: initialInteraction });
      return null;
    }

    const newElement: Omit<Element, 'id' | 'zIndex'> = {
      type: interaction.creatingType,
      x: isClick ? interaction.startPoint.x : x,
      y: isClick ? interaction.startPoint.y : y,
      width: isClick ? (interaction.creatingType === 'text' ? 10 : width) : width,
      height: isClick ? (interaction.creatingType === 'text' ? 30 : height) : height,
      style: {
        fill: interaction.creatingType === 'frame' ? 'rgba(255, 255, 255, 1)' : '#c9c9c9ff',
        stroke: interaction.creatingType === 'frame' ? '#e0e0e0' : undefined,
        strokeWidth: 1,
        borderRadius: 2,
        fontSize: interaction.creatingType === 'text' ? 24 : undefined,
      },
      fixedWidth: interaction.creatingType === 'text' ? false : undefined,
    };

    const id = this.addElement(newElement);
    const element = this.state.elements.find((el) => el.id === id);

    this.setState({
      interaction: {
        ...initialInteraction,
        editingId: interaction.creatingType === 'text' ? id : null,
      },
      selectedIds: [id],
      activeTool: 'select',
      lastSelectionEvent: null,
    });

    return element || null;
  }

  public consumeSelectionEvent(): MouseEvent | TouchEvent | null {
    const { lastSelectionEvent } = this.state;
    if (lastSelectionEvent) {
      this.setState({ lastSelectionEvent: null });
    }
    return lastSelectionEvent;
  }

  public setEditingId(id: string | null) {
    this.setState({
      interaction: { ...this.state.interaction, editingId: id },
    });
  }

  public setInteraction(updates: Partial<InteractionState>) {
    this.setState({
      interaction: { ...this.state.interaction, ...updates },
    });
  }

  public async addImage(url?: string) {
    const { viewport } = this.state;
    // 使用导入的 MOCK_IMAGES
    const { MOCK_IMAGES, createImageElement: createImg } = await import('./utils/bizUtils');
    const targetUrl = url || MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)];

    try {
      // 加载图片以获取真实尺寸
      const img = new Image();
      img.src = targetUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      const width = img.naturalWidth || 400;
      const height = img.naturalHeight || 300;

      // 计算视口中心位置 (世界坐标)
      // viewport center in screen is (800, 450) if 1600x900
      const centerX = (viewport.x + (800 / viewport.zoom)) - (width / 2);
      const centerY = (viewport.y + (450 / viewport.zoom)) - (height / 2);

      const element = createImg({
        imageUrl: targetUrl,
        width,
        height,
        x: Math.round(centerX),
        y: Math.round(centerY),
      });

      this.addElement(element);
    } catch (err) {
      console.error('Add image failed:', err);
      // 回退方案：使用随机位置添加
      const { createRandomImageElement } = await import('./utils/bizUtils');
      const fallback = createRandomImageElement(1600 / viewport.zoom, 900 / viewport.zoom);
      this.addElement(fallback);
    }
  }

  // ========== 数据导入导出 (Persistence) ==========

  public exportData(): EditorDataExport {
    const { viewport, elements } = this.state;
    return {
      version: '1.0.0',
      viewport,
      elements,
    };
  }

  public importData(data: EditorDataExport) {
    if (data.version) {
      this.setState({
        viewport: data.viewport || initialViewport,
        elements: data.elements || [],
        selectedIds: [],
        interaction: initialInteraction,
        hoverFrameId: null,
        lastSelectionEvent: null,
      });
    }
  }

  // ========== 字体管理 (Fonts) ==========

  public async loadLocalFonts() {
    if (this.state.localFonts.length > DEFAULT_FONTS.length || this.state.isFontLoading) {
      return;
    }

    if (!('queryLocalFonts' in window)) {
      console.warn('Local Font Access API is not supported in this browser.');
      return;
    }

    this.setState({ isFontLoading: true });

    try {
      // @ts-expect-error - queryLocalFonts is a new API
      const availableFonts = await window.queryLocalFonts();

      const families = new Set<string>();
      availableFonts.forEach((font: { family: string }) => {
        families.add(font.family);
      });

      const fontOptions = Array.from(families)
        .sort()
        .map(family => ({
          label: family,
          value: family
        }));

      const defaultValues = new Set(DEFAULT_FONTS.map(f => f.value));
      const filteredLocalFonts = fontOptions.filter(f => !defaultValues.has(f.value));

      this.setState({
        localFonts: [...DEFAULT_FONTS, ...filteredLocalFonts],
        isFontLoading: false
      });
    } catch (err) {
      console.error('Failed to load local fonts:', err);
      this.setState({ isFontLoading: false });
    }
  }
}
