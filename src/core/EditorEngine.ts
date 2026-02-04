import type {
  Viewport,
  Element,
  InteractionState,
  ToolType,
  Point,
  ElementType,
  Bounds
} from '../types/editor';
import { EDITOR_CONFIG } from '../constants/editor';

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
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // ========== 视口操作 (Viewport) ==========

  public setViewport(viewport: Partial<Viewport>) {
    this.setState({
      viewport: { ...this.state.viewport, ...viewport },
    });
  }

  public pan(deltaX: number, deltaY: number) {
    this.setState({
      viewport: {
        ...this.state.viewport,
        x: this.state.viewport.x + deltaX,
        y: this.state.viewport.y + deltaY,
      },
    });
  }

  public zoomTo(zoom: number, centerX?: number, centerY?: number) {
    const clampedZoom = Math.min(
      Math.max(zoom, EDITOR_CONFIG.ZOOM.MIN),
      EDITOR_CONFIG.ZOOM.MAX
    );

    const { viewport } = this.state;

    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = clampedZoom / viewport.zoom;
      this.setState({
        viewport: {
          x: centerX - (centerX - viewport.x) * zoomRatio,
          y: centerY - (centerY - viewport.y) * zoomRatio,
          zoom: clampedZoom,
        },
      });
      return;
    }

    this.setState({
      viewport: { ...viewport, zoom: clampedZoom },
    });
  }

  public resetViewport() {
    this.setState({ viewport: initialViewport });
  }

  // ========== 元素操作 (Elements) ==========

  private generateId(): string {
    return `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public addElement(element: Omit<Element, 'id' | 'zIndex'>): string {
    const id = this.generateId();
    const { elements } = this.state;

    let zIndex;
    if (element.type === 'frame') {
      const minZIndex = elements.reduce((min, el) => Math.min(min, el.zIndex), 0);
      zIndex = minZIndex - 1;
    } else if (element.type === 'text') {
      zIndex = 5000;
    } else {
      const maxZIndex = elements.filter(el => el.type !== 'text').reduce((max, el) => Math.max(max, el.zIndex), 0);
      zIndex = maxZIndex + 1;
    }

    this.setState({
      elements: [...elements, { ...element, id, zIndex } as Element],
    });

    return id;
  }

  public updateElement(id: string, updates: Partial<Element>) {
    this.setState({
      elements: this.state.elements.map(el => el.id === id ? { ...el, ...updates } : el),
    });
  }

  public deleteElements(ids: string[]) {
    this.setState({
      elements: this.state.elements.filter(el => !ids.includes(el.id)),
      selectedIds: this.state.selectedIds.filter(id => !ids.includes(id)),
    });
  }

  public moveElements(ids: string[], deltaX: number, deltaY: number) {
    this.setState({
      elements: this.state.elements.map(el =>
        ids.includes(el.id) ? { ...el, x: el.x + deltaX, y: el.y + deltaY } : el
      ),
    });
  }

  public resizeElement(id: string, bounds: Bounds) {
    this.setState({
      elements: this.state.elements.map(el => el.id === id ? { ...el, ...bounds } : el),
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
    const { elements } = this.state;
    const firstElement = elements.find(el => el.id === ids[0]);
    if (!firstElement) return;
    const parentId = firstElement.parentId;

    const sameLevelElements = elements
      .filter(el => el.parentId === parentId)
      .sort((a, b) => a.zIndex - b.zIndex);

    const newElements = [...elements];

    switch (action) {
      case 'front': {
        const maxZ = Math.max(...sameLevelElements.map(el => el.zIndex), 0);
        let count = 1;
        ids.forEach(id => {
          const idx = newElements.findIndex(el => el.id === id);
          if (idx !== -1) newElements[idx] = { ...newElements[idx], zIndex: maxZ + count++ };
        });
        break;
      }
      case 'back': {
        const minZ = Math.min(...sameLevelElements.map(el => el.zIndex), 0);
        let count = 1;
        [...ids].reverse().forEach(id => {
          const idx = newElements.findIndex(el => el.id === id);
          if (idx !== -1) newElements[idx] = { ...newElements[idx], zIndex: minZ - count++ };
        });
        break;
      }
      case 'forward':
      case 'backward': {
        if (ids.length !== 1) break;
        const targetId = ids[0];
        const currentIdx = sameLevelElements.findIndex(el => el.id === targetId);
        const swapIdx = action === 'forward' ? currentIdx + 1 : currentIdx - 1;

        if (swapIdx >= 0 && swapIdx < sameLevelElements.length) {
          const swapElement = sameLevelElements[swapIdx];
          const targetElement = sameLevelElements[currentIdx];

          const idx1 = newElements.findIndex(el => el.id === targetElement.id);
          const idx2 = newElements.findIndex(el => el.id === swapElement.id);

          const tempZ = newElements[idx1].zIndex;
          newElements[idx1] = { ...newElements[idx1], zIndex: newElements[idx2].zIndex };
          newElements[idx2] = { ...newElements[idx2], zIndex: tempZ };
        }
        break;
      }
    }

    this.setState({ elements: newElements });
  }

  // ========== Frame 父子关系 (Frames) ==========

  public getElementWorldPos(id: string): Point {
    const { elements } = this.state;
    const element = elements.find(el => el.id === id);
    if (!element) return { x: 0, y: 0 };

    if (!element.parentId) {
      return { x: element.x, y: element.y };
    }

    const parentPos = this.getElementWorldPos(element.parentId);
    return {
      x: parentPos.x + element.x,
      y: parentPos.y + element.y,
    };
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
    const { elements } = this.state;
    // 找出所有非排除列表中的 Frame，按 zIndex 降序排列（最高层优先）
    const frames = elements
      .filter((el) => el.type === 'frame' && !excludeIds.includes(el.id))
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const frame of frames) {
      const worldPos = this.getElementWorldPos(frame.id);
      if (
        x >= worldPos.x &&
        x <= worldPos.x + frame.width &&
        y >= worldPos.y &&
        y <= worldPos.y + frame.height
      ) {
        return frame;
      }
    }

    return null;
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
        startPoint,
      },
    });
  }

  public stopDragging() {
    this.setState({
      interaction: { ...this.state.interaction, isDragging: false, startPoint: undefined },
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
          return (
            el.x < marqueeRect.x + marqueeRect.width &&
            el.x + el.width > marqueeRect.x &&
            el.y < marqueeRect.y + marqueeRect.height &&
            el.y + el.height > marqueeRect.y
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
      interaction: initialInteraction,
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

  public addImage(): string {
    const { elements } = this.state;
    const images = elements.filter(el => el.type === 'image');

    const gap = EDITOR_CONFIG.LAYOUT.DEFAULT_GAP;
    const maxWidth = EDITOR_CONFIG.LAYOUT.MAX_ROW_WIDTH;
    const imgWidth = Math.floor(
      Math.random() * (EDITOR_CONFIG.IMAGE.WIDTH.MAX - EDITOR_CONFIG.IMAGE.WIDTH.MIN + 1)
    ) + EDITOR_CONFIG.IMAGE.WIDTH.MIN;
    const imgHeight = Math.floor(
      Math.random() * (EDITOR_CONFIG.IMAGE.HEIGHT.MAX - EDITOR_CONFIG.IMAGE.HEIGHT.MIN + 1)
    ) + EDITOR_CONFIG.IMAGE.HEIGHT.MIN;

    let nextX = 0;
    let nextY = 0;

    if (images.length > 0) {
      const sortedImages = [...images].sort((a, b) => {
        if (Math.abs(a.y - b.y) < 1) return b.x - a.x;
        return b.y - a.y;
      });

      const lastImg = sortedImages[0];
      nextX = lastImg.x + lastImg.width + gap;
      nextY = lastImg.y;

      if (nextX + imgWidth > maxWidth) {
        nextX = 0;
        nextY = lastImg.y + lastImg.height + gap;
      }
    }

    return this.addElement({
      type: 'image',
      x: nextX,
      y: nextY,
      width: imgWidth,
      height: imgHeight,
      imageUrl: `https://picsum.photos/seed/${Date.now()}/${imgWidth}/${imgHeight}`,
      style: {
        borderRadius: 4,
        fill: '#f0f0f0',
      },
      name: `Image ${images.length + 1}`,
    });
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
