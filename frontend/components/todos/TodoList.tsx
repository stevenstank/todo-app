import type { TodoIdentifier, TodoUiItem } from '@/types/todo';

type TodoListProps = {
  todos: TodoUiItem[];
  updatingTodoId: TodoIdentifier | null;
  deletingTodoIds: TodoIdentifier[];
  onToggle: (todo: TodoUiItem) => void;
  onDelete: (todoId: TodoIdentifier) => void;
};

export default function TodoList({
  todos,
  updatingTodoId,
  deletingTodoIds,
  onToggle,
  onDelete,
}: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">No todos yet</p>
        <p className="mt-1 text-xs text-slate-500">Add your first todo above to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => {
        const isUpdating = updatingTodoId === todo.id;
        const isDeleting = deletingTodoIds.includes(todo.id);
        const isBusy = isUpdating || isDeleting;

        return (
          <article
            key={todo.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <div>
              <p className={`font-medium ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                {todo.title}
                {todo.isOptimistic ? <span className="ml-2 text-xs text-slate-400">Saving...</span> : null}
              </p>
              <p className={`text-xs ${todo.completed ? 'text-green-600' : 'text-amber-600'}`}>
                {todo.completed ? 'Completed' : 'Pending'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onToggle(todo)}
                disabled={isBusy}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUpdating ? 'Processing...' : todo.completed ? 'Mark Pending' : 'Mark Done'}
              </button>
              <button
                type="button"
                onClick={() => onDelete(todo.id)}
                disabled={isBusy}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
