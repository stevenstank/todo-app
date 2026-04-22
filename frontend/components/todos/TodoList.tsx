import { useMemo, useState } from 'react';
import TodoItem from '@root/components/todos/TodoItem';
import type { TodoIdentifier, TodoUiItem } from '@/types/todo';

type TodoListProps = {
  todos: TodoUiItem[];
  searchTerm: string;
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
  searchTerm,
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
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const isTodoExpanded = useMemo(
    () => (todoId: TodoIdentifier) => expandedById[todoId] ?? true,
    [expandedById]
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const visibleTodoIds = useMemo(() => {
    if (!normalizedSearchTerm) {
      return null;
    }

    const ids = new Set<TodoIdentifier>();

    const markVisible = (todo: TodoUiItem, ancestorIds: TodoIdentifier[]): boolean => {
      const titleMatches = todo.title.toLowerCase().includes(normalizedSearchTerm);
      const hasMatchingDescendant = (todo.children ?? []).some((child) =>
        markVisible(child, [...ancestorIds, todo.id])
      );
      const shouldShow = titleMatches || hasMatchingDescendant;

      if (shouldShow) {
        ids.add(todo.id);

        for (const ancestorId of ancestorIds) {
          ids.add(ancestorId);
        }

        if (titleMatches) {
          const markSubtree = (node: TodoUiItem) => {
            ids.add(node.id);
            for (const child of node.children ?? []) {
              markSubtree(child);
            }
          };

          markSubtree(todo);
        }
      }

      return shouldShow;
    };

    for (const todo of todos) {
      markVisible(todo, []);
    }

    return ids;
  }, [todos, normalizedSearchTerm]);

  const visibleRootTodos = useMemo(() => {
    if (!visibleTodoIds) {
      return todos;
    }

    return todos.filter((todo) => visibleTodoIds.has(todo.id));
  }, [todos, visibleTodoIds]);

  if (todos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">No todos yet</p>
        <p className="mt-1 text-xs text-slate-500">Add your first todo above to get started.</p>
      </div>
    );
  }

  if (visibleRootTodos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">No matching todos</p>
        <p className="mt-1 text-xs text-slate-500">Try a different search term.</p>
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
      {visibleRootTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          level={0}
          visibleTodoIds={visibleTodoIds}
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
          onDelete={onDelete}
          onGenerateSubtasks={onGenerateSubtasks}
        />
      ))}
    </div>
  );
}
