/**
 * 标注管理Hook
 */
import { useCallback } from 'react';
import { useEditorHistory } from './useEditorHistory';
import type { Annotation, AnnotationType } from '../types';

let annotationIdCounter = 0;

function generateId(): string {
  return `annotation_${Date.now()}_${++annotationIdCounter}`;
}

export function useAnnotations() {
  const {
    state: annotations,
    set,
    undo,
    redo,
    reset,
    clear,
    canUndo,
    canRedo,
  } = useEditorHistory([]);

  // 添加标注
  const addAnnotation = useCallback((
    type: AnnotationType,
    x: number,
    y: number,
    page: number,
    pageWidth: number,
    pageHeight: number,
    options?: Partial<Annotation>
  ) => {
    const newAnnotation: Annotation = {
      id: generateId(),
      type,
      x,
      y,
      page,
      width: type === 'text' ? 150 : (type === 'draw' || type === 'signature') ? 0 : 24,
      height: type === 'text' ? 30 : (type === 'draw' || type === 'signature') ? 0 : 24,
      content: type === 'text' ? '' : type === 'check' ? '✓' : type === 'cross' ? '×' : undefined,
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#000000',
      pageWidth,
      pageHeight,
      ...options,
    };

    set([...annotations, newAnnotation]);
    return newAnnotation;
  }, [annotations, set]);

  // 更新标注
  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    const newAnnotations = annotations.map(ann =>
      ann.id === id ? { ...ann, ...updates } : ann
    );
    set(newAnnotations);
  }, [annotations, set]);

  // 批量更新多个标注
  const updateAnnotations = useCallback((updates: Array<{ id: string; changes: Partial<Annotation> }>) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.changes]));
    const newAnnotations = annotations.map(ann => {
      const changes = updatesMap.get(ann.id);
      return changes ? { ...ann, ...changes } : ann;
    });
    set(newAnnotations);
  }, [annotations, set]);

  // 删除标注
  const removeAnnotation = useCallback((id: string) => {
    const newAnnotations = annotations.filter(ann => ann.id !== id);
    set(newAnnotations);
  }, [annotations, set]);

  // 获取指定页面的标注
  const getPageAnnotations = useCallback((page: number) => {
    return annotations.filter(ann => ann.page === page);
  }, [annotations]);

  // 通过ID获取标注
  const getAnnotationById = useCallback((id: string) => {
    return annotations.find(ann => ann.id === id);
  }, [annotations]);

  return {
    annotations,
    addAnnotation,
    updateAnnotation,
    updateAnnotations,
    removeAnnotation,
    getPageAnnotations,
    getAnnotationById,
    undo,
    redo,
    reset,
    clear,
    canUndo,
    canRedo,
  };
}
