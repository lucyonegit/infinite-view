import { useSyncExternalStore, useCallback, useRef, useLayoutEffect } from 'react';
import { EditorEngine, type EditorState } from '../../engine/EditorEngine';

/**
 * 浅比较两个值是否相等
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as any)[key], (b as any)[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * useEditorEngine - React 适配器 Hook
 * 将 EditorEngine 的状态同步到 React 组件中
 * 
 * @param engine 引擎实例
 * @param selector 选择器，用于性能优化，只监听感兴趣的部分状态
 * @param equalityFn 自定义相等性判断函数，默认为 Object.is (严格相等)
 * @returns 选中的状态
 */
export function useEditorEngine<T>(
  engine: EditorEngine,
  selector: (state: EditorState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is
): T {
  // 用于缓存上一次的状态和计算结果，避免 unstable selectors 导致 getSnapshot 每次返回新对象
  const lastStateRef = useRef<EditorState | null>(null);
  const lastResultRef = useRef<T | null>(null);

  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);

  useLayoutEffect(() => {
    selectorRef.current = selector;
    equalityFnRef.current = equalityFn;
  });

  const subscribe = useCallback((onStoreChange: () => void) => {
    return engine.subscribe(onStoreChange);
  }, [engine]);

  const getSnapshot = useCallback(() => {
    const nextState = engine.getState();
    const nextResult = selectorRef.current(nextState);

    // If the overall state hasn't changed, and we have a cached result, return it.
    // This handles cases where the engine's state object reference itself is stable.
    if (lastResultRef.current !== null && lastStateRef.current === nextState) {
      return lastResultRef.current;
    }

    // If the new result is equal to the last cached result according to equalityFn,
    // return the last cached result to maintain reference stability.
    if (lastResultRef.current !== null && equalityFnRef.current(lastResultRef.current, nextResult)) {
      // Update lastStateRef even if result is the same, as the underlying state might have changed
      // but the selected part is still equal.
      lastStateRef.current = nextState;
      return lastResultRef.current;
    }

    // Otherwise, update cache with the new state and result.
    lastStateRef.current = nextState;
    lastResultRef.current = nextResult;
    return nextResult;
  }, [engine]); // selector and equalityFn removed from dependencies

  // 使用 useSyncExternalStore 确保与 React 的并发模式兼容
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * 预置：使用浅比较的选择器 Hook
 */
export function useEditorEngineShallow<T>(
  engine: EditorEngine,
  selector: (state: EditorState) => T
): T {
  return useEditorEngine(engine, selector, shallowEqual);
}
