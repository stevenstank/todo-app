import type { AssignableUser, TodoIdentifier, TodoUiItem } from '@/types/todo';

type TodoItemProps = {
  todo: TodoUiItem;
  level: number;
  assignableUsers: AssignableUser[];
  updatingTodoId: TodoIdentifier | null;
  deletingTodoIds: TodoIdentifier[];
  generatingSubtasksTodoId: TodoIdentifier | null;
  activeParentId: TodoIdentifier | null;
  subtaskTitle: string;
  submittingParentId: TodoIdentifier | null;
  isTodoExpanded: (todoId: TodoIdentifier) => boolean;
  onToggleExpand: (todoId: TodoIdentifier) => void;
  onSubtaskTitleChange: (value: string) => void;
  onSubtaskEditorToggle: (todoId: TodoIdentifier) => void;
  onSubtaskSubmit: (parentId: TodoIdentifier) => void;
  onToggle: (todo: TodoUiItem) => void;
  onAssign: (todoId: TodoIdentifier, assignedUserId: number | null) => Promise<void>;
  onDelete: (todoId: TodoIdentifier) => void;
  onGenerateSubtasks: (todo: TodoUiItem) => Promise<void>;
};

export default function TodoItem({
  todo,
  level,
  assignableUsers,
  updatingTodoId,
  deletingTodoIds,
  generatingSubtasksTodoId,
  activeParentId,
  subtaskTitle,
  submittingParentId,
  isTodoExpanded,
  onToggleExpand,
  onSubtaskTitleChange,
  onSubtaskEditorToggle,
  onSubtaskSubmit,
  onToggle,
  onAssign,
  onDelete,
  onGenerateSubtasks,
}: TodoItemProps) {
  const isUpdating = updatingTodoId === todo.id;
  const isDeleting = deletingTodoIds.includes(todo.id);
  const isCreatingSubtask = submittingParentId === todo.id;
  const isGenerating = generatingSubtasksTodoId === todo.id;
  const isBusy = isUpdating || isDeleting || isCreatingSubtask || isGenerating;
  const hasChildren = (todo.children?.length ?? 0) > 0;
  const isExpanded = isTodoExpanded(todo.id);
  const isChild = level > 0;
  const computedCompletedChildren = (todo.children ?? []).filter((child) => child.completed).length;
  const computedTotalChildren = todo.children?.length ?? 0;
  const completedChildren = computedCompletedChildren;
  const totalChildren =
    typeof todo.totalChildren === 'number'
      ? Math.max(todo.totalChildren, computedTotalChildren)
      : computedTotalChildren;
  const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
  const assignedUser = todo.assignedUser ?? null;
  const isAssigned = Boolean(assignedUser);
  const assigneeInitial = assignedUser?.username?.trim()?.charAt(0)?.toUpperCase() ?? '?';
  const titleClass = hasChildren ? 'text-base font-semibold' : 'text-sm font-medium';

  return (
    <div className="space-y-2" style={{ paddingLeft: `${level * 18}px` }}>
      <article
        className={`rounded-lg border px-3 py-3 ${
          isAssigned
            ? 'border-blue-200 bg-blue-50/50'
            : isChild
              ? 'border-slate-200 bg-white'
              : 'border-slate-300 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleExpand(todo.id)}
                className="mt-0.5 rounded px-1 text-sm text-slate-600 transition hover:bg-slate-200"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${todo.title}`}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="mt-1 inline-block w-4 text-center text-slate-300">•</span>
            )}

            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => onToggle(todo)}
              disabled={isBusy}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 disabled:cursor-not-allowed"
              aria-label={`Mark ${todo.title} as ${todo.completed ? 'pending' : 'completed'}`}
            />
            <div>
              <p className={`${titleClass} ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
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
              {hasChildren ? (
                <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                    aria-label={`${progressPercent}% complete`}
                  />
                </div>
              ) : null}
              {assignedUser ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-blue-700">
                  {assignedUser.avatarUrl ? (
                    <img
                      src={assignedUser.avatarUrl}
                      alt={assignedUser.username}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
                      {assigneeInitial}
                    </span>
                  )}
                  <span>Assigned to {assignedUser.username}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={assignedUser?.id ?? ''}
              onChange={(event) => {
                const next = event.target.value.trim();
                void onAssign(todo.id, next ? Number(next) : null);
              }}
              disabled={isBusy}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
              aria-label={`Assign ${todo.title} to a user`}
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
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
              onClick={() => onSubtaskEditorToggle(todo.id)}
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
              onChange={(event) => onSubtaskTitleChange(event.target.value)}
              placeholder="Subtask title"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
              disabled={isCreatingSubtask}
            />
            <button
              type="button"
              onClick={() => onSubtaskSubmit(todo.id)}
              disabled={isCreatingSubtask || subtaskTitle.trim().length === 0}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isCreatingSubtask ? 'Adding...' : 'Save Subtask'}
            </button>
          </div>
        ) : null}
      </article>

      {hasChildren && isExpanded ? (
        <div className="space-y-2">
          {todo.children.map((child) => (
            <TodoItem
              key={child.id}
              todo={child}
              level={level + 1}
              assignableUsers={assignableUsers}
              updatingTodoId={updatingTodoId}
              deletingTodoIds={deletingTodoIds}
              generatingSubtasksTodoId={generatingSubtasksTodoId}
              activeParentId={activeParentId}
              subtaskTitle={subtaskTitle}
              submittingParentId={submittingParentId}
              isTodoExpanded={isTodoExpanded}
              onToggleExpand={onToggleExpand}
              onSubtaskTitleChange={onSubtaskTitleChange}
              onSubtaskEditorToggle={onSubtaskEditorToggle}
              onSubtaskSubmit={onSubtaskSubmit}
              onToggle={onToggle}
              onAssign={onAssign}
              onDelete={onDelete}
              onGenerateSubtasks={onGenerateSubtasks}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
