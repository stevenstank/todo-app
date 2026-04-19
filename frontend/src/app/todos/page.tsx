"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BASE_URL, parseJsonSafely } from '@/lib/api';
import {
  getOfflineMessage,
  getResponseErrorMessage,
  isOffline as detectOffline,
  normalizeApiErrorMessage,
} from '@/lib/error-handler';
import useDelayedLoading from '@/hooks/useDelayedLoading';
import ErrorNotice from '@root/components/ui/ErrorNotice';
import Loader from '@root/components/ui/Loader';
import SkeletonTodo from '@root/components/ui/SkeletonTodo';
import TopLoadingBar from '@root/components/ui/TopLoadingBar';
import { useAuth } from '@root/context/AuthContext';
import { useRequireAuth } from '@root/context/useRequireAuth';

type TodoItem = {
  id: number;
  title: string;
  completed: boolean;
  isSyncing?: boolean;
  isOptimistic?: boolean;
};

type TodoApiItem = {
  id: number;
  title?: string;
  isCompleted?: boolean;
  completed?: boolean;
  attributes?: {
    title?: string;
    isCompleted?: boolean;
    completed?: boolean;
  };
};

type TodosResponse = {
  data?: TodoApiItem[];
  error?: {
    message?: string;
  };
};

type CreateTodoResponse = {
  data?: TodoApiItem;
  error?: {
    message?: string;
  };
};

type UpdateTodoResponse = CreateTodoResponse;

type TodoActionErrors = Record<number, string>;

export default function TodosPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { isCheckingAuth } = useRequireAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [createError, setCreateError] = useState('');
  const [todoActionErrors, setTodoActionErrors] = useState<TodoActionErrors>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [updatingTodoIds, setUpdatingTodoIds] = useState<number[]>([]);
  const [deletingTodoIds, setDeletingTodoIds] = useState<number[]>([]);
  const nextTempTodoIdRef = useRef(-1);
  const operationVersionRef = useRef<Record<number, number>>({});

  const getNextTempTodoId = () => {
    const current = nextTempTodoIdRef.current;
    nextTempTodoIdRef.current -= 1;
    return current;
  };

  const nextOperationVersion = (id: number) => {
    const next = (operationVersionRef.current[id] ?? 0) + 1;
    operationVersionRef.current[id] = next;
    return next;
  };

  const isCurrentOperationVersion = (id: number, version: number): boolean =>
    operationVersionRef.current[id] === version;

  const fetchTodos = useCallback(async () => {
    if (detectOffline()) {
      setIsOffline(true);
      setFetchError(getOfflineMessage());
      setLoading(false);
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setFetchError('');

    try {
      const res = await fetch(`${BASE_URL}/api/todos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await parseJsonSafely<TodosResponse>(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Failed to load todos'));
      }

      const nextTodos = (payload?.data ?? []).map((todo) => ({
        id: todo.id,
        title: todo.attributes?.title ?? todo.title ?? 'Untitled',
        completed: Boolean(
          todo.attributes?.isCompleted ??
            todo.attributes?.completed ??
            todo.isCompleted ??
            todo.completed
        ),
        isSyncing: false,
        isOptimistic: false,
      }));

      setTodos(nextTodos);
      setFetchError('');
    } catch (error) {
      setFetchError(normalizeApiErrorMessage(error, 'Failed to load todos'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncNetworkState = () => {
      const nextOffline = !window.navigator.onLine;
      setIsOffline(nextOffline);

      if (nextOffline) {
        setFetchError((prev) => prev || getOfflineMessage());
        return;
      }

      setFetchError((prev) => (prev === getOfflineMessage() ? '' : prev));
    };

    syncNetworkState();
    window.addEventListener('online', syncNetworkState);
    window.addEventListener('offline', syncNetworkState);

    return () => {
      window.removeEventListener('online', syncNetworkState);
      window.removeEventListener('offline', syncNetworkState);
    };
  }, []);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void fetchTodos();
  }, [isCheckingAuth, fetchTodos]);

  const isInitialLoading = loading || isCheckingAuth;
  const showTopLoadingBar = useDelayedLoading(isInitialLoading, {
    delayMs: 120,
    minVisibleMs: 280,
  });
  const showSkeleton = useDelayedLoading(isInitialLoading, {
    delayMs: 120,
    minVisibleMs: 220,
  });

  const isTodoBusy = useMemo(
    () => (id: number) => updatingTodoIds.includes(id) || deletingTodoIds.includes(id),
    [deletingTodoIds, updatingTodoIds]
  );

  const clearTodoActionError = (id: number) => {
    setTodoActionErrors((prev) => {
      if (!prev[id]) {
        return prev;
      }

      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setTodoActionError = (id: number, message: string) => {
    setTodoActionErrors((prev) => ({
      ...prev,
      [id]: message,
    }));
  };

  if (isCheckingAuth) {
    return (
      <main className="py-10 text-sm text-slate-600">
        <TopLoadingBar active={showTopLoadingBar} />
        <div className="flex items-center gap-2 text-slate-600">
          <Loader size="sm" className="text-slate-500" />
          <span>Checking your session...</span>
        </div>
      </main>
    );
  }

  const hasTodos = todos.length > 0;
  const isListReady = !loading && !showSkeleton;

  const handleAddTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('todo') ?? '').trim();
    if (!title) {
      setCreateError('Todo title cannot be empty.');
      return;
    }

    if (isOffline) {
      setCreateError(getOfflineMessage());
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    setIsAdding(true);
    setCreateError('');

    const optimisticId = getNextTempTodoId();
    const optimisticTodo: TodoItem = {
      id: optimisticId,
      title,
      completed: false,
      isSyncing: true,
      isOptimistic: true,
    };

    setTodos((prev) => [...prev, optimisticTodo]);
    setNewTodo('');

    try {
      const res = await fetch(`${BASE_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title,
            completed: false,
          },
        }),
      });

      const payload = await parseJsonSafely<CreateTodoResponse>(res);

      if (!res.ok || !payload?.data) {
        throw new Error(getResponseErrorMessage(payload, 'Could not add todo'));
      }

      const created = payload.data;
      const createdTodo: TodoItem = {
        id: created.id,
        title: created.attributes?.title ?? created.title ?? title,
        completed: Boolean(
          created.attributes?.isCompleted ??
            created.attributes?.completed ??
            created.isCompleted ??
            created.completed
        ),
        isSyncing: false,
        isOptimistic: false,
      };

      setTodos((prev) => {
        if (!prev.some((todo) => todo.id === optimisticId)) {
          return prev;
        }

        return prev.map((todo) => (todo.id === optimisticId ? createdTodo : todo));
      });
    } catch (error) {
      setTodos((prev) => prev.filter((todo) => todo.id !== optimisticId));
      setCreateError(normalizeApiErrorMessage(error, 'Could not add todo'));
      setNewTodo(title);
    } finally {
      setIsAdding(false);
    }
  };

  const handleLogout = () => {
    startLogoutTransition(() => {
      logout();
    });
  };

  const handleToggleTodo = async (id: number) => {
    if (isTodoBusy(id)) {
      return;
    }

    if (isOffline) {
      setTodoActionError(id, getOfflineMessage());
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    const targetTodo = todos.find((todo) => todo.id === id);
    if (!targetTodo) {
      return;
    }

    const operationVersion = nextOperationVersion(id);
    const nextCompleted = !targetTodo.completed;

    setUpdatingTodoIds((prev) => [...prev, id]);
    clearTodoActionError(id);

    // Optimistic UI update for instant feedback.
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: nextCompleted, isSyncing: true, isOptimistic: true } : todo
      )
    );

    try {
      const res = await fetch(`${BASE_URL}/api/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            completed: nextCompleted,
          },
        }),
      });

      const payload = await parseJsonSafely<UpdateTodoResponse>(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Could not update todo'));
      }
    } catch (error) {
      if (!isCurrentOperationVersion(id, operationVersion)) {
        return;
      }

      // Roll back optimistic state if backend update fails.
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                completed: targetTodo.completed,
                isSyncing: false,
                isOptimistic: false,
              }
            : todo
        )
      );
      setTodoActionError(id, normalizeApiErrorMessage(error, 'Could not update todo'));
    } finally {
      if (isCurrentOperationVersion(id, operationVersion)) {
        setTodos((prev) =>
          prev.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  isSyncing: false,
                  isOptimistic: false,
                }
              : todo
          )
        );
      }

      setUpdatingTodoIds((prev) => prev.filter((todoId) => todoId !== id));
    }
  };

  const handleDeleteTodo = async (id: number) => {
    if (isTodoBusy(id)) {
      return;
    }

    if (isOffline) {
      setTodoActionError(id, getOfflineMessage());
      return;
    }

    const shouldDelete = window.confirm('Are you sure you want to delete this todo?');
    if (!shouldDelete) {
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    const deleteIndex = todos.findIndex((todo) => todo.id === id);
    const existingTodo = deleteIndex >= 0 ? todos[deleteIndex] : undefined;

    if (!existingTodo || deleteIndex < 0) {
      return;
    }

    setDeletingTodoIds((prev) => [...prev, id]);
    clearTodoActionError(id);

    // Optimistic remove for instant UX.
    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    try {
      const res = await fetch(`${BASE_URL}/api/todos/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await parseJsonSafely<{ error?: { message?: string } }>(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(payload, 'Could not delete todo'));
      }
    } catch (error) {
      // Rollback optimistic change if API delete fails.
      setTodos((prev) => {
        if (prev.some((todo) => todo.id === existingTodo.id)) {
          return prev;
        }

        const rollbackTodo: TodoItem = {
          ...existingTodo,
          isSyncing: false,
          isOptimistic: false,
        };
        const next = [...prev];
        const safeIndex = Math.min(deleteIndex, next.length);
        next.splice(safeIndex, 0, rollbackTodo);
        return next;
      });
      setTodoActionError(id, normalizeApiErrorMessage(error, 'Could not delete todo'));
    } finally {
      setDeletingTodoIds((prev) => prev.filter((todoId) => todoId !== id));
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl py-8">
      <TopLoadingBar active={showTopLoadingBar} />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Todo App</h1>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoggingOut ? (
              <>
                <Loader size="sm" className="text-white" />
                <span>Processing...</span>
              </>
            ) : (
              'Logout'
            )}
          </button>
        </header>

        <div className="space-y-5 px-5 py-6">
          <h2 className="text-2xl font-semibold text-slate-900">Your Todos</h2>

          {isOffline ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              You&apos;re offline. Actions are temporarily disabled.
            </p>
          ) : null}

          <form onSubmit={handleAddTodo} className="flex flex-col gap-3 sm:flex-row">
            <input
              name="todo"
              type="text"
              value={newTodo}
              onChange={(event) => {
                setNewTodo(event.target.value);

                if (createError) {
                  setCreateError('');
                }
              }}
              placeholder="Add a new todo"
              disabled={isAdding || isOffline}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              disabled={isAdding || isOffline}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAdding ? (
                <>
                  <Loader size="sm" className="text-white" />
                  <span>Processing...</span>
                </>
              ) : (
                'Add Todo'
              )}
            </button>
          </form>

          {createError ? <ErrorNotice message={createError} className="mt-1" /> : null}

          <div className="space-y-2">
            {showSkeleton ? <SkeletonTodo count={4} /> : null}

            {isListReady && fetchError ? (
              <ErrorNotice
                title="Something went wrong"
                message={fetchError}
                onRetry={() => {
                  void fetchTodos();
                }}
                retryLabel="Retry"
                disabled={loading || isOffline}
              />
            ) : null}

            {isListReady && hasTodos ? (
              todos.map((todo) => (
                <article
                  key={todo.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition-all duration-200 ease-out"
                >
                  <div className="space-y-1">
                    <p
                      className={`font-medium ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}
                    >
                      {todo.title}
                    </p>
                    <p className={`text-xs ${todo.completed ? 'text-green-600' : 'text-amber-600'}`}>
                      {todo.completed ? 'Completed' : 'Pending'}
                    </p>
                    {todo.isSyncing ? (
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Loader size="sm" className="text-slate-400" />
                        <span>Syncing...</span>
                      </p>
                    ) : null}

                    {todoActionErrors[todo.id] ? <ErrorNotice message={todoActionErrors[todo.id]} className="mt-2" /> : null}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTodo(todo.id)}
                      disabled={
                        isOffline ||
                        todo.isSyncing ||
                        updatingTodoIds.includes(todo.id) ||
                        deletingTodoIds.includes(todo.id)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingTodoIds.includes(todo.id) ? (
                        <>
                          <Loader size="sm" className="text-slate-500" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>{todo.completed ? 'Mark Pending' : 'Mark Done'}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      disabled={
                        isOffline ||
                        todo.isSyncing ||
                        updatingTodoIds.includes(todo.id) ||
                        deletingTodoIds.includes(todo.id)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingTodoIds.includes(todo.id) ? (
                        <>
                          <Loader size="sm" className="text-white" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </article>
              ))
            ) : null}

            {isListReady && !fetchError && !hasTodos ? (
              <p className="text-sm text-slate-500">No todos yet.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
