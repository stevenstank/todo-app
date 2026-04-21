import { useMemo, useState } from 'react';
import TodoItem from '@root/components/todos/TodoItem';
import type { AssignableUser, TodoIdentifier, TodoUiItem } from '@/types/todo';

type TodoListProps = {
  todos: TodoUiItem[];
  assignableUsers: AssignableUser[];
  updatingTodoId: TodoIdentifier | null;
  deletingTodoIds: TodoIdentifier[];
  generatingSubtasksTodoId: TodoIdentifier | null;
  onToggle: (todo: TodoUiItem) => void;
  onAssign: (todoId: TodoIdentifier, assignedUserId: number | null) => Promise<void>;
  onDelete: (todoId: TodoIdentifier) => void;
  onCreateSubtask: (parentId: TodoIdentifier, title: string) => Promise<void>;
  onGenerateSubtasks: (todo: TodoUiItem) => Promise<void>;
};

export default function TodoList({
  todos,
  assignableUsers,
  updatingTodoId,
  deletingTodoIds,
  generatingSubtasksTodoId,
  onToggle,
  onAssign,
  onDelete,
  onCreateSubtask,
  onGenerateSubtasks,
}: TodoListProps) {
  const [activeParentId, setActiveParentId] = useState<TodoIdentifier | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [submittingParentId, setSubmittingParentId] = useState<TodoIdentifier | null>(null);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const isTodoExpanded = useMemo(
    () => (todoId: TodoIdentifier) => expandedById[todoId] ?? true,
    [expandedById]
  );

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

  const handleToggleExpand = (todoId: TodoIdentifier) => {
    setExpandedById((prev) => ({
      ...prev,
      [todoId]: !(prev[todoId] ?? true),
    }));
  };

  const handleSubtaskEditorToggle = (todoId: TodoIdentifier) => {
    setActiveParentId((prev) => (prev === todoId ? null : todoId));
    setSubtaskTitle('');
  };

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          level={0}
          assignableUsers={assignableUsers}
          updatingTodoId={updatingTodoId}
          deletingTodoIds={deletingTodoIds}
          generatingSubtasksTodoId={generatingSubtasksTodoId}
          activeParentId={activeParentId}
          subtaskTitle={subtaskTitle}
          submittingParentId={submittingParentId}
          isTodoExpanded={isTodoExpanded}
          onToggleExpand={handleToggleExpand}
          onSubtaskTitleChange={setSubtaskTitle}
          onSubtaskEditorToggle={handleSubtaskEditorToggle}
          onSubtaskSubmit={handleSubtaskSubmit}
          onToggle={onToggle}
          onAssign={onAssign}
          onDelete={onDelete}
          onGenerateSubtasks={onGenerateSubtasks}
        />
      ))}
    </div>
  );
}
