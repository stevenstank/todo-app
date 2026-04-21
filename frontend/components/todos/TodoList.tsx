import { useState } from 'react';
import type { TodoIdentifier, TodoUiItem } from '@/types/todo';

type TodoListProps = {
  todos: TodoUiItem[];
  updatingTodoId: TodoIdentifier | null;
  deletingTodoIds: TodoIdentifier[];
  generatingSubtasksTodoId: TodoIdentifier | null;
  onToggle: (todo: TodoUiItem) => void;
  onDelete: (todoId: TodoIdentifier) => void;
  onCreateSubtask: (parentId: TodoIdentifier, title: string) => Promise<void>;
  onGenerateSubtasks: (todo: TodoUiItem) => Promise<void>;
};

export default function TodoList({
  todos,
  updatingTodoId,
  deletingTodoIds,
  generatingSubtasksTodoId,
  onToggle,
  onDelete,
  onCreateSubtask,
  onGenerateSubtasks,
}: TodoListProps) {
  const [activeParentId, setActiveParentId] = useState<TodoIdentifier | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [submittingParentId, setSubmittingParentId] = useState<TodoIdentifier | null>(null);

  if (todos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">No todos yet</p>
        <p className="mt-1 text-xs text-slate-500">Add your first todo above to get started.</p>
      </div>
    );
  }

  const handleSubtaskSubmit = async (parentId: TodoIdentifier) => {
    const title = subtaskTitle.trim();

    if (!title || submittingParentId) {
      return;
    }

    setSubmittingParentId(parentId);

    try {
      await onCreateSubtask(parentId, title);
      setSubtaskTitle('');
      setActiveParentId(null);
    } finally {
      setSubmittingParentId(null);
    }
  };

  const renderTodo = (todo: TodoUiItem, level = 0): JSX.Element => {
    const isUpdating = updatingTodoId === todo.id;
    const isDeleting = deletingTodoIds.includes(todo.id);
    const isCreatingSubtask = submittingParentId === todo.id;
    const isGenerating = generatingSubtasksTodoId === todo.id;
    const isBusy = isUpdating || isDeleting || isCreatingSubtask || isGenerating;
    const hasChildren = (todo.children?.length ?? 0) > 0;
    const isChild = level > 0;
    const completedChildren = (todo.children ?? []).filter((child) => child.completed).length;
    const totalChildren = todo.children?.length ?? 0;

    return (
      <div key={todo.id} className="space-y-2" style={{ paddingLeft: `${level * 18}px` }}>
        <article
          className={`rounded-lg border px-3 py-3 ${
            isChild ? 'border-slate-200 bg-white' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggle(todo)}
                disabled={isBusy}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed"
                aria-label={`Mark ${todo.title} as ${todo.completed ? 'pending' : 'completed'}`}
              />
              <div>
              <p className={`font-medium ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                {todo.title}
                {todo.isOptimistic ? <span className="ml-2 text-xs text-slate-400">Saving...</span> : null}
              </p>
              <p className={`text-xs ${todo.completed ? 'text-green-600' : 'text-amber-600'}`}>
                {todo.completed ? 'Completed' : 'Pending'}
                {isChild ? ' • Subtask' : ' • Parent task'}
              </p>
              {hasChildren ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {completedChildren}/{totalChildren} completed
                </p>
              ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDelete(todo.id)}
                disabled={isBusy}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveParentId((prev) => (prev === todo.id ? null : todo.id));
                  setSubtaskTitle('');
                }}
                disabled={isBusy}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Subtask
              </button>
              <button
                type="button"
                onClick={() => onGenerateSubtasks(todo)}
                disabled={isBusy}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Generating...' : 'Generate Subtasks with AI'}
              </button>
            </div>
          </div>

          {activeParentId === todo.id ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
                placeholder="Subtask title"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
                disabled={isCreatingSubtask}
              />
              <button
                type="button"
                onClick={() => handleSubtaskSubmit(todo.id)}
                disabled={isCreatingSubtask || subtaskTitle.trim().length === 0}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isCreatingSubtask ? 'Adding...' : 'Save Subtask'}
              </button>
            </div>
          ) : null}
        </article>

        {hasChildren ? <div className="space-y-2">{todo.children.map((child) => renderTodo(child, level + 1))}</div> : null}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {todos.map((todo) => renderTodo(todo))}
    </div>
  );
}
