/**
 * 编辑器历史记录Hook（撤销/重做）
 */
import { useState, useCallback } from 'react';
import type { Annotation } from '../types';

interface HistoryState {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
}

export function useEditorHistory(initialState: Annotation[] = []) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialState,
    future: [],
  });

  // 设置状态（会记录历史）
  const set = useCallback((newPresent: Annotation[]) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present],
      present: newPresent,
      future: [],
    }));
  }, []);

  // 撤销
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  // 重做
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  // 重置历史
  const reset = useCallback((newPresent: Annotation[] = []) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  // 清空所有
  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: [],
      future: [],
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    reset,
    clear,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
