export type TodoIdentifier = string;

export type TodoItem = {
  id: TodoIdentifier;
  numericId?: number;
  documentId?: string;
  title: string;
  completed: boolean;
};

export type TodoUiItem = TodoItem & {
  isOptimistic?: boolean;
};

export type TodoApiItem = {
  id?: number;
  documentId?: string;
  title?: string;
  completed?: boolean;
  isCompleted?: boolean;
  attributes?: {
    title?: string;
    completed?: boolean;
    isCompleted?: boolean;
  };
};

export type TodoPayload = {
  data?: TodoApiItem;
  error?: {
    message?: string;
  };
};

export type TodosPayload = {
  data?: TodoApiItem[];
  error?: {
    message?: string;
  };
};

export const mapTodoApiItem = (todo: TodoApiItem): TodoItem => ({
  id: todo.documentId ?? (typeof todo.id === 'number' ? String(todo.id) : 'unknown'),
  numericId: typeof todo.id === 'number' ? todo.id : undefined,
  documentId: typeof todo.documentId === 'string' ? todo.documentId : undefined,
  title: todo.attributes?.title ?? todo.title ?? 'Untitled',
  completed: Boolean(todo.attributes?.isCompleted ?? todo.attributes?.completed ?? todo.isCompleted ?? todo.completed),
});
