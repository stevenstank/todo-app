'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTodoRequest,
  deleteTodoRequest,
  fetchTodos,
  TodoItem,
  toggleTodoRequest,
} from '@/lib/todos';
import { ApiError } from '@/lib/api';

const TOKEN_KEY = 'token';

const getTodoTitle = (todo: TodoItem): string =>
  todo.attributes?.title ?? todo.title ?? 'Untitled';

const getTodoDescription = (todo: TodoItem): string =>
  todo.attributes?.description ?? todo.description ?? '';

const isTodoCompleted = (todo: TodoItem): boolean =>
  Boolean(todo.attributes?.completed ?? todo.attributes?.isCompleted ?? todo.completed ?? todo.isCompleted);

export default function DashboardPage() {
  const router = useRouter();
  const [titleInput, setTitleInput] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ready, setReady] = useState(false);

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        router.replace('/login');
        return;
      }

      if (error.status === 403) {
        setErrorMessage('You are not allowed to access this resource');
        return;
      }
    }

    setErrorMessage('Something went wrong. Please try again.');
  }, [router]);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data = await fetchTodos();
      setTodos(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);

    if (!token) {
      router.replace('/login');
      return;
    }

    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void loadTodos();
  }, [ready, loadTodos]);

  const createTodo = async () => {
    const cleanTitle = titleInput.trim();
    if (!cleanTitle) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await createTodoRequest(cleanTitle);
      setTitleInput('');
      await loadTodos();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTodo = async (todo: TodoItem) => {
    const completed = isTodoCompleted(todo);

    setErrorMessage('');

    try {
      await toggleTodoRequest(todo.id, !completed);
      await loadTodos();
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteTodo = async (id: number) => {
    setErrorMessage('');

    try {
      await deleteTodoRequest(id);
      await loadTodos();
    } catch (error) {
      handleApiError(error);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    router.replace('/login');
  };

  if (!ready) {
    return (
      <main className="bg-gray-50 min-h-screen flex justify-center items-start pt-10 px-4">
        <section className="max-w-xl w-full bg-white shadow-md rounded-xl p-6">
          <p>Checking authentication...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex justify-center items-start pt-10 px-4">
      <section className="max-w-xl w-full bg-white shadow-md rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Todo App</h1>
          <button
            type="button"
            onClick={logout}
            className="bg-black text-white rounded-lg px-3 py-1"
          >
            Logout
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              placeholder="Add a todo"
              value={titleInput}
              onChange={(event) => setTitleInput(event.target.value)}
              className="border rounded-lg px-3 py-2 w-full"
            />
            <button
              type="button"
              onClick={createTodo}
              disabled={isSaving}
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              Add
            </button>
          </div>

          <button
            type="button"
            onClick={loadTodos}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            Refresh Todos
          </button>

          {loading ? <p>Loading...</p> : null}

          {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}

          {!loading && !errorMessage && todos.length === 0 ? (
            <p className="text-center text-gray-500">No todos yet</p>
          ) : null}

          <div className="space-y-4">
            {todos.map((todo) => {
              const completed = isTodoCompleted(todo);
              const title = getTodoTitle(todo);
              const description = getTodoDescription(todo);

              return (
                <article
                  key={todo.id}
                  className="flex justify-between items-center bg-gray-50 p-4 rounded-lg"
                >
                  <div>
                    <p className={`font-medium ${completed ? 'line-through opacity-60' : ''}`}>
                      {title}
                    </p>
                    <p className="text-sm text-gray-500">{description || 'No description'}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTodo(todo)}
                      className="bg-black text-white rounded-lg px-3 py-1"
                    >
                      {completed ? 'Undo' : 'Complete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="bg-red-500 text-white rounded-lg px-3 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
