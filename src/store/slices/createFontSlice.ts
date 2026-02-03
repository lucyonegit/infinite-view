import type { StateCreator } from 'zustand';

export interface FontData {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
}

export interface FontSlice {
  localFonts: { label: string; value: string }[];
  isFontLoading: boolean;
  loadLocalFonts: () => Promise<void>;
}

// 默认基础字体
const DEFAULT_FONTS = [
  { label: '黑体', value: 'SimHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Roboto', value: 'Roboto' },
];

export const createFontSlice: StateCreator<FontSlice> = (set, get) => ({
  localFonts: DEFAULT_FONTS,
  isFontLoading: false,

  loadLocalFonts: async () => {
    // 如果已经加载过或正在加载，直接返回
    if (get().localFonts.length > DEFAULT_FONTS.length || get().isFontLoading) {
      return;
    }

    if (!('queryLocalFonts' in window)) {
      console.warn('Local Font Access API is not supported in this browser.');
      return;
    }

    set({ isFontLoading: true });

    try {
      // @ts-expect-error - queryLocalFonts is a new API
      const availableFonts = await window.queryLocalFonts();

      // 按 Family 分组并去重
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

      // 合并默认字体和系统字体（去重）
      const defaultValues = new Set(DEFAULT_FONTS.map(f => f.value));
      const filteredLocalFonts = fontOptions.filter(f => !defaultValues.has(f.value));

      set({
        localFonts: [...DEFAULT_FONTS, ...filteredLocalFonts],
        isFontLoading: false
      });
    } catch (err) {
      console.error('Failed to load local fonts:', err);
      set({ isFontLoading: false });
    }
  },
});
