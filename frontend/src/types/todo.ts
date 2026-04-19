export type TodoItem = {
  id: number;
  title: string;
  completed: boolean;
};

export type TodoUiItem = TodoItem & {
  isOptimistic?: boolean;
};

export type TodoApiItem = {
  id: number;
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
  id: todo.id,
  title: todo.attributes?.title ?? todo.title ?? 'Untitled',
  completed: Boolean(todo.attributes?.isCompleted ?? todo.attributes?.completed ?? todo.isCompleted ?? todo.completed),
});
