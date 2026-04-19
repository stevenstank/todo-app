"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BASE_URL, parseJsonSafely } from '@/lib/api';
import { useAuth } from '@root/context/AuthContext';
import { useRequireAuth } from '@root/context/useRequireAuth';

type TodoItem = {
  id: number;
  title: string;
  completed: boolean;
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

export default function TodosPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const { isCheckingAuth } = useRequireAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchTodos = useCallback(async () => {
    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${BASE_URL}/api/todos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await parseJsonSafely<TodosResponse>(res);

      if (!res.ok) {
        throw new Error(payload?.error?.message ?? 'Something went wrong');
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
      }));

      setTodos(nextTodos);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isCheckingAuth) {
      return;
    }

    void fetchTodos();
  }, [isCheckingAuth, fetchTodos]);

  if (isCheckingAuth) {
    return <main className="py-10 text-sm text-slate-600">Loading...</main>;
  }

  const hasTodos = todos.length > 0;

  const handleAddTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('todo') ?? '').trim();
    if (!title) {
      setErrorMessage('Todo title cannot be empty.');
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    setIsAdding(true);
    setErrorMessage('');

    const optimisticId = Date.now();
    const optimisticTodo: TodoItem = {
      id: optimisticId,
      title,
      completed: false,
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
        throw new Error(payload?.error?.message ?? 'Could not create todo');
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
      };

      setTodos((prev) => prev.map((todo) => (todo.id === optimisticId ? createdTodo : todo)));
    } catch (error) {
      setTodos((prev) => prev.filter((todo) => todo.id !== optimisticId));
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
      setNewTodo(title);
    } finally {
      setIsAdding(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleToggleTodo = async (id: number) => {
    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    const targetTodo = todos.find((todo) => todo.id === id);
    if (!targetTodo) {
      return;
    }

    const nextCompleted = !targetTodo.completed;

    // Optimistic UI update for instant feedback.
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed: nextCompleted } : todo))
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
        throw new Error(payload?.error?.message ?? 'Could not update todo');
      }
    } catch (error) {
      // Roll back optimistic state if backend update fails.
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, completed: targetTodo.completed } : todo))
      );
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  const handleDeleteTodo = async (id: number) => {
    const shouldDelete = window.confirm('Are you sure you want to delete this todo?');
    if (!shouldDelete) {
      return;
    }

    const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

    if (!token) {
      router.replace('/login');
      return;
    }

    const existingTodo = todos.find((todo) => todo.id === id);
    if (!existingTodo) {
      return;
    }

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
        throw new Error(payload?.error?.message ?? 'Could not delete todo');
      }
    } catch (error) {
      // Rollback optimistic change if API delete fails.
      setTodos((prev) => [...prev, existingTodo].sort((a, b) => a.id - b.id));
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl py-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Todo App</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Logout
          </button>
        </header>

        <div className="space-y-5 px-5 py-6">
          <h2 className="text-2xl font-semibold text-slate-900">Your Todos</h2>

          <form onSubmit={handleAddTodo} className="flex flex-col gap-3 sm:flex-row">
            <input
              name="todo"
              type="text"
              value={newTodo}
              onChange={(event) => {
                setNewTodo(event.target.value);

                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Add a new todo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
            />
            <button
              type="submit"
              disabled={isAdding}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isAdding ? 'Adding...' : 'Add Todo'}
            </button>
          </form>

          <div className="space-y-2">
            {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}

            {!loading && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            {!loading && hasTodos ? (
              todos.map((todo) => (
                <article
                  key={todo.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
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
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTodo(todo.id)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      {todo.completed ? 'Mark Pending' : 'Mark Done'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : null}

            {!loading && !hasTodos ? (
              <p className="text-sm text-slate-500">No todos yet.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
