'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTodoRequest,
  deleteTodoRequest,
  toggleTodoRequest,
  TodoActionError,
  TodoUnauthorizedError,
} from '@/actions/todos';
import type { TodoItem, TodoUiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';

export const useTodos = (initialTodos: TodoItem[]) => {
  const router = useRouter();
  const nextTempIdRef = useRef(-1);

  const [newTodo, setNewTodo] = useState('');
  const [todos, setTodos] = useState<TodoUiItem[]>(initialTodos);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingTodoId, setUpdatingTodoId] = useState<number | null>(null);
  const [deletingTodoIds, setDeletingTodoIds] = useState<number[]>([]);
  const [createError, setCreateError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setTodos(initialTodos);
  }, [initialTodos]);

  const getNextTempId = () => {
    const next = nextTempIdRef.current;
    nextTempIdRef.current -= 1;
    return next;
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      const payload = await createTodoRequest(title);
      const createdTodo = mapTodoApiItem(payload.data!);

      setTodos((prev) => {
        const tempIndex = prev.findIndex((item) => item.id === tempId);

        if (tempIndex === -1) {
          if (prev.some((item) => item.id === createdTodo.id)) {
            return prev;
          }

          return [createdTodo, ...prev];
        }

        if (prev.some((item) => item.id === createdTodo.id && item.id !== tempId)) {
          return prev.filter((item) => item.id !== tempId);
        }

        const next = [...prev];
        next[tempIndex] = createdTodo;
        return next;
      });

      router.refresh();
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/login');
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
        router.replace('/login');
        router.refresh();
        return;
      }

      setActionError(error instanceof TodoActionError ? error.message : 'Could not update todo');
    } finally {
      setUpdatingTodoId(null);
    }
  };

  const handleDelete = async (todoId: number) => {
    if (deletingTodoIds.includes(todoId)) {
      return;
    }

    setActionError('');

    let removedTodo: TodoUiItem | null = null;
    let removedIndex = -1;

    setDeletingTodoIds((prev) => [...prev, todoId]);
    setTodos((prev) => {
      removedIndex = prev.findIndex((item) => item.id === todoId);
      removedTodo = removedIndex >= 0 ? prev[removedIndex] : null;
      return prev.filter((item) => item.id !== todoId);
    });

    if (!removedTodo) {
      setDeletingTodoIds((prev) => prev.filter((id) => id !== todoId));
      return;
    }

    try {
      await deleteTodoRequest(todoId);
      router.refresh();
    } catch (error) {
      if (error instanceof TodoUnauthorizedError) {
        router.replace('/login');
        router.refresh();
        return;
      }

      setActionError(error instanceof TodoActionError ? error.message : 'Could not delete todo');

      setTodos((prev) => {
        if (!removedTodo || prev.some((item) => item.id === removedTodo?.id)) {
          return prev;
        }

        const next = [...prev];
        const insertIndex = Math.min(Math.max(removedIndex, 0), next.length);
        next.splice(insertIndex, 0, removedTodo);
        return next;
      });
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
