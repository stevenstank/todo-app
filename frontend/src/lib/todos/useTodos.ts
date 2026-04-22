'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTodoRequest,
  generateSubtasksWithAiRequest,
  fetchTodosRequest,
  deleteTodoRequest,
  toggleTodoRequest,
  TodoActionError,
  TodoUnauthorizedError,
} from '@/actions/todos';
import type { TodoIdentifier, TodoItem, TodoUiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';
import { debounce, type DebouncedFunction } from '@/lib/utils/debounce';

const mapIncomingTodos = (items: TodoItem[]): TodoUiItem[] =>
  items.map((item) => ({
    ...item,
    children: mapIncomingTodos(item.children ?? []),
  }));

const mapLatestTodos = (items: TodoItem[]): TodoUiItem[] => mapIncomingTodos(items);

const updateTodoInTree = (
  items: TodoUiItem[],
  targetId: TodoIdentifier,
  mutate: (todo: TodoUiItem) => TodoUiItem
): TodoUiItem[] =>
  items.map((item) => {
    if (item.id === targetId) {
      return mutate(item);
    }

    return {
      ...item,
      children: updateTodoInTree(item.children ?? [], targetId, mutate),
    };
  });

const removeTodoFromTree = (items: TodoUiItem[], targetId: TodoIdentifier): TodoUiItem[] =>
  items
    .filter((item) => item.id !== targetId)
    .map((item) => ({
      ...item,
      children: removeTodoFromTree(item.children ?? [], targetId),
    }));

const insertSubtaskOptimistically = (
  items: TodoUiItem[],
  parentId: TodoIdentifier,
  todo: TodoUiItem
): TodoUiItem[] =>
  items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [todo, ...(item.children ?? [])],
      };
    }

    return {
      ...item,
      children: insertSubtaskOptimistically(item.children ?? [], parentId, todo),
    };
  });

export const useTodos = (initialTodos: TodoItem[]) => {
  const router = useRouter();
  const nextTempIdRef = useRef(1);
  const createRequestSeqRef = useRef(0);
  const deleteRequestSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const debouncedSearchRef = useRef<DebouncedFunction<[string]> | null>(null);

  const [newTodo, setNewTodo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [todos, setTodos] = useState<TodoUiItem[]>(mapIncomingTodos(initialTodos));
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTodoId, setUpdatingTodoId] = useState<TodoIdentifier | null>(null);
  const [deletingTodoIds, setDeletingTodoIds] = useState<TodoIdentifier[]>([]);
  const [generatingSubtasksTodoId, setGeneratingSubtasksTodoId] = useState<TodoIdentifier | null>(null);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setTodos(mapIncomingTodos(initialTodos));
  }, [initialTodos]);

  const getNextTempId = () => {
    const next = nextTempIdRef.current;
    nextTempIdRef.current += 1;
    return `temp-${next}`;
  };

  const refreshTodos = async (
    source: 'after-create' | 'after-delete' | 'after-toggle' | 'search'
  ) => {
    const latest = await fetchTodosRequest(source, {
      searchTerm,
    });
    const latestMapped = (latest.data ?? []).map(mapTodoApiItem);
    setTodos(mapLatestTodos(latestMapped));
    return latestMapped;
  };

  useEffect(() => {
    const runSearch = async (term: string) => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const latest = await fetchTodosRequest(
          'search',
          { searchTerm: term },
          { signal: controller.signal }
        );
        const latestMapped = (latest.data ?? []).map(mapTodoApiItem);
        setTodos(mapLatestTodos(latestMapped));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (error instanceof TodoUnauthorizedError) {
          router.replace('/signin');
          router.refresh();
          return;
        }

        setActionError(error instanceof TodoActionError ? error.message : 'Could not load todos');
      }
    };

    debouncedSearchRef.current = debounce((term: string) => {
      void runSearch(term);
    }, 300);

    return () => {
      debouncedSearchRef.current?.cancel();
      searchAbortRef.current?.abort();
    };
  }, [router]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearchRef.current?.(value);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreating) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[todos][create][skipped-duplicate-submit]');
      }
      return;
    }

    const title = newTodo.trim();

    if (title.length < 3) {
      setCreateError('Todo title must be at least 3 characters.');
      return;
    }

    const tempId = getNextTempId();
    const optimisticTodo: TodoUiItem = {
      id: tempId,
      title,
      completed: false,
      parentId: null,
      children: [],
      isOptimistic: true,
    };

    setCreateError('');
    setActionError('');
    setIsCreating(true);
    setTodos((prev) => [optimisticTodo, ...prev]);
    setNewTodo('');

    try {
      const requestId = ++createRequestSeqRef.current;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][create][start]', {
          requestId,
          title,
          beforeIds: todos.map((item) => item.id),
        });
      }

      await createTodoRequest(title);
      const latestMapped = await refreshTodos('after-create');

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][create][end]', {
          requestId,
          afterIds: latestMapped.map((item) => item.id),
        });
      }
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setTodos((prev) => prev.filter((item) => item.id !== tempId));
      setCreateError(error instanceof TodoActionError ? error.message : 'Could not add todo');
      setNewTodo(title);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateSubtask = async (parentId: TodoIdentifier, rawTitle: string) => {
    const title = rawTitle.trim();

    if (title.length < 3) {
      setActionError('Subtask title must be at least 3 characters.');
      return;
    }

    const tempId = getNextTempId();
    const optimisticTodo: TodoUiItem = {
      id: tempId,
      title,
      completed: false,
      parentId,
      children: [],
      isOptimistic: true,
    };

    setActionError('');
    setTodos((prev) => insertSubtaskOptimistically(prev, parentId, optimisticTodo));

    try {
      const createdSubtask = await createTodoRequest(title, parentId);
      console.log('Created subtask:', createdSubtask);
      await refreshTodos('after-create');
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setTodos((prev) => removeTodoFromTree(prev, tempId));
      setActionError(error instanceof TodoActionError ? error.message : 'Could not add subtask');
    }
  };

  const handleToggle = async (todo: TodoUiItem) => {
    setUpdatingTodoId(todo.id);
    setActionError('');

    const nextCompleted = !todo.completed;

    try {
      await toggleTodoRequest(todo.id, nextCompleted);

      setTodos((prev) =>
        updateTodoInTree(prev, todo.id, (item) => ({
          ...item,
          completed: nextCompleted,
        }))
      );

      await refreshTodos('after-toggle');
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setActionError(error instanceof TodoActionError ? error.message : 'Could not update todo');
    } finally {
      setUpdatingTodoId(null);
    }
  };

  const handleGenerateSubtasks = async (todo: TodoUiItem) => {
    if (generatingSubtasksTodoId) {
      return;
    }

    setGeneratingSubtasksTodoId(todo.id);
    setActionError('');

    try {
      const subtasks = await generateSubtasksWithAiRequest(todo.title);

      for (const subtaskTitle of subtasks) {
        await createTodoRequest(subtaskTitle, todo.id);
      }

      await refreshTodos('after-create');
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setActionError(error instanceof TodoActionError ? error.message : 'AI generation failed. Please try again.');
    } finally {
      setGeneratingSubtasksTodoId(null);
    }
  };

  const handleDelete = async (todoId: TodoIdentifier) => {
    if (deletingTodoIds.includes(todoId)) {
      return;
    }

    setActionError('');

    setDeletingTodoIds((prev) => [...prev, todoId]);

    try {
      const requestId = ++deleteRequestSeqRef.current;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][delete][start]', {
          requestId,
          todoId,
          beforeIds: todos.map((item) => item.id),
        });
      }

      await deleteTodoRequest(todoId);
      const latestMapped = await refreshTodos('after-delete');

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][delete][end]', {
          requestId,
          todoId,
          afterIds: latestMapped.map((item) => item.id),
        });
      }
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setActionError(error instanceof TodoActionError ? error.message : 'Could not delete todo');
    } finally {
      setDeletingTodoIds((prev) => prev.filter((id) => id !== todoId));
    }
  };

  return {
    todos,
    newTodo,
    searchTerm,
    isCreating,
    updatingTodoId,
    deletingTodoIds,
    generatingSubtasksTodoId,
    createError,
    actionError,
    setNewTodo,
    setSearchTerm: handleSearchChange,
    clearCreateError: () => setCreateError(''),
    handleCreate,
    handleCreateSubtask,
    handleGenerateSubtasks,
    handleToggle,
    handleDelete,
  };
};
