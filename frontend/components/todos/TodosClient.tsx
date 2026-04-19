'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ErrorNotice from '@root/components/ui/ErrorNotice';
import Loader from '@root/components/ui/Loader';
import type { TodoItem } from '@/types/todo';
import TodoForm from '@root/components/todos/TodoForm';
import TodoList from '@root/components/todos/TodoList';
import { useTodos } from '@/lib/todos/useTodos';

export default function TodosClient({
  initialTodos,
  noticeMessage,
}: {
  initialTodos: TodoItem[];
  noticeMessage?: string;
}) {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const {
    todos,
    newTodo,
    isCreating,
    updatingTodoId,
    deletingTodoIds,
    createError,
    actionError,
    setNewTodo,
    clearCreateError,
    handleCreate,
    handleToggle,
    handleDelete,
  } = useTodos(initialTodos);

  const handleLogout = () => {
    startLogoutTransition(async () => {
      await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
      });

      router.replace('/login');
      router.refresh();
    });
  };

  return (
    <main className="mx-auto w-full max-w-3xl py-8">
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
          {noticeMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {noticeMessage}
            </p>
          ) : null}

          <h2 className="text-2xl font-semibold text-slate-900">Your Todos</h2>

          <TodoForm
            value={newTodo}
            isSubmitting={isCreating}
            onSubmit={handleCreate}
            onChange={(value) => {
              setNewTodo(value);
              if (createError) {
                clearCreateError();
              }
            }}
          />

          {createError ? <ErrorNotice message={createError} /> : null}
          {actionError ? <ErrorNotice message={actionError} /> : null}

          <TodoList
            todos={todos}
            updatingTodoId={updatingTodoId}
            deletingTodoIds={deletingTodoIds}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        </div>
      </section>
    </main>
  );
}
