'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTodoRequest,
  generateSubtasksWithAiRequest,
  deleteTodoRequest,
  toggleTodoRequest,
  TodoActionError,
  TodoUnauthorizedError,
} from '@/actions/todos';
import type { TodoIdentifier, TodoItem, TodoUiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';

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

const replaceTodoInTree = (
  items: TodoUiItem[],
  targetId: TodoIdentifier,
  replacement: TodoUiItem
): TodoUiItem[] =>
  items.map((item) => {
    if (item.id === targetId) {
      return replacement;
    }

    return {
      ...item,
      children: replaceTodoInTree(item.children ?? [], targetId, replacement),
    };
  });

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

const reconcileCompletion = (items: TodoUiItem[]): TodoUiItem[] =>
  items.map((item) => {
    const children = reconcileCompletion(item.children ?? []);
    const totalChildren = children.length;
    const completedChildren = children.filter((child) => child.completed).length;

    if (totalChildren === 0) {
      return {
        ...item,
        children,
      };
    }

    return {
      ...item,
      children,
      completed: completedChildren === totalChildren,
      completedChildren,
      totalChildren,
    };
  });

export const useTodos = (initialTodos: TodoItem[]) => {
  const router = useRouter();
  const nextTempIdRef = useRef(1);
  const createRequestSeqRef = useRef(0);
  const deleteRequestSeqRef = useRef(0);

  const [newTodo, setNewTodo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [todos, setTodos] = useState<TodoUiItem[]>(mapIncomingTodos(initialTodos));
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTodoIds, setUpdatingTodoIds] = useState<TodoIdentifier[]>([]);
  const [deletingTodoIds, setDeletingTodoIds] = useState<TodoIdentifier[]>([]);
  const [generatingSubtasksTodoId, setGeneratingSubtasksTodoId] = useState<TodoIdentifier | null>(null);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setTodos(mapIncomingTodos(initialTodos));
  }, [initialTodos]);

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setSearchTerm(searchInput);
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [searchInput]);

  const getNextTempId = () => {
    const next = nextTempIdRef.current;
    nextTempIdRef.current += 1;
    return `temp-${next}`;
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
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

      const created = await createTodoRequest(title);
      const createdItem = created.data ? mapTodoApiItem(created.data) : null;

      if (createdItem) {
        setTodos((prev) =>
          reconcileCompletion(
            replaceTodoInTree(prev, tempId, {
              ...createdItem,
              isOptimistic: false,
            })
          )
        );
      } else {
        setTodos((prev) => prev.filter((item) => item.id !== tempId));
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][create][end]', {
          requestId,
          createdId: createdItem?.id ?? null,
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
      const created = await createTodoRequest(title, parentId);
      const createdItem = created.data ? mapTodoApiItem(created.data) : null;

      if (createdItem) {
        setTodos((prev) =>
          reconcileCompletion(
            replaceTodoInTree(prev, tempId, {
              ...createdItem,
              isOptimistic: false,
            })
          )
        );
      } else {
        setTodos((prev) => removeTodoFromTree(prev, tempId));
      }
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
    if (updatingTodoIds.includes(todo.id)) {
      return;
    }

    setUpdatingTodoIds((prev) => [...prev, todo.id]);
    setActionError('');

    const nextCompleted = !todo.completed;
    const previousTodos = todos;

    setTodos((prev) =>
      reconcileCompletion(
        updateTodoInTree(prev, todo.id, (item) => ({
          ...item,
          completed: nextCompleted,
        }))
      )
    );

    try {
      await toggleTodoRequest(todo.id, nextCompleted);
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setTodos(previousTodos);
      setActionError(error instanceof TodoActionError ? error.message : 'Could not update todo');
    } finally {
      setUpdatingTodoIds((prev) => prev.filter((id) => id !== todo.id));
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
      const createdPayloads = await Promise.all(
        subtasks.map((subtaskTitle) => createTodoRequest(subtaskTitle, todo.id))
      );
      const createdSubtasks = createdPayloads
        .map((payload) => payload.data)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map(mapTodoApiItem)
        .map((item) => ({
          ...item,
          isOptimistic: false,
        }));

      if (createdSubtasks.length > 0) {
        setTodos((prev) =>
          reconcileCompletion(
            updateTodoInTree(prev, todo.id, (item) => ({
              ...item,
              completed: false,
              children: [...createdSubtasks, ...(item.children ?? [])],
            }))
          )
        );
      }
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

  const handleDelete = async (todoId: TodoIdentifier, options: { forceDelete?: boolean } = {}) => {
    if (deletingTodoIds.includes(todoId)) {
      return;
    }

    setActionError('');

    setDeletingTodoIds((prev) => [...prev, todoId]);
    const previousTodos = todos;
    setTodos((prev) => removeTodoFromTree(prev, todoId));

    try {
      const requestId = ++deleteRequestSeqRef.current;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][delete][start]', {
          requestId,
          todoId,
          forceDelete: Boolean(options.forceDelete),
          beforeIds: todos.map((item) => item.id),
        });
      }

      await deleteTodoRequest(todoId, options);

      if (process.env.NODE_ENV !== 'production') {
        console.info('[todos][delete][end]', {
          requestId,
          todoId,
          afterIds: todos.map((item) => item.id),
        });
      }
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/signin');
        router.refresh();
        return;
      }

      setTodos(previousTodos);
      setActionError(error instanceof TodoActionError ? error.message : 'Could not delete todo');
    } finally {
      setDeletingTodoIds((prev) => prev.filter((id) => id !== todoId));
    }
  };

  return {
    todos,
    newTodo,
    searchInput,
    searchTerm,
    isCreating,
    updatingTodoIds,
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
