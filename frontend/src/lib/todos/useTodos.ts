'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTodoRequest,
  fetchTodosRequest,
  deleteTodoRequest,
  toggleTodoRequest,
  TodoActionError,
  TodoUnauthorizedError,
} from '@/actions/todos';
import type { TodoIdentifier, TodoItem, TodoUiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';

export const useTodos = (initialTodos: TodoItem[]) => {
  const router = useRouter();
  const nextTempIdRef = useRef(1);
  const createRequestSeqRef = useRef(0);
  const deleteRequestSeqRef = useRef(0);

  const [newTodo, setNewTodo] = useState('');
  const [todos, setTodos] = useState<TodoUiItem[]>(initialTodos);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTodoId, setUpdatingTodoId] = useState<TodoIdentifier | null>(null);
  const [deletingTodoIds, setDeletingTodoIds] = useState<TodoIdentifier[]>([]);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const getNextTempId = () => {
    const next = nextTempIdRef.current;
    nextTempIdRef.current += 1;
    return `temp-${next}`;
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

    if (!title) {
      setCreateError('Todo title cannot be empty.');
      return;
    }

    const tempId = getNextTempId();
    const optimisticTodo: TodoUiItem = {
      id: tempId,
      title,
      completed: false,
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
      const latest = await fetchTodosRequest('after-create');
      const latestMapped = (latest.data ?? []).map(mapTodoApiItem);
      setTodos(latestMapped);

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

  const handleToggle = async (todo: TodoUiItem) => {
    setUpdatingTodoId(todo.id);
    setActionError('');

    const nextCompleted = !todo.completed;

    try {
      await toggleTodoRequest(todo.id, nextCompleted);

      setTodos((prev) =>
        prev.map((item) => (item.id === todo.id ? { ...item, completed: nextCompleted } : item))
      );
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
      const latest = await fetchTodosRequest('after-delete');
      const latestMapped = (latest.data ?? []).map(mapTodoApiItem);
      setTodos(latestMapped);

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
    isCreating,
    updatingTodoId,
    deletingTodoIds,
    createError,
    actionError,
    setNewTodo,
    clearCreateError: () => setCreateError(''),
    handleCreate,
    handleToggle,
    handleDelete,
  };
};
