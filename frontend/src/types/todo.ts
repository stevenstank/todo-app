export type TodoIdentifier = string;

export type TodoItem = {
  id: TodoIdentifier;
  numericId?: number;
  documentId?: string;
  title: string;
  completed: boolean;
  depth?: number;
  completedChildren?: number;
  totalChildren?: number;
  parentId?: TodoIdentifier | null;
  children: TodoItem[];
};

export type TodoUiItem = TodoItem & {
  isOptimistic?: boolean;
};

export type TodoApiItem = {
  id?: number;
  documentId?: string;
  title?: string;
  depth?: number;
  completedChildren?: number;
  totalChildren?: number;
  parentId?: number | string | null;
  completed?: boolean;
  isCompleted?: boolean;
  children?: TodoApiItem[];
  attributes?: {
    title?: string;
    depth?: number;
    completedChildren?: number;
    totalChildren?: number;
    parentId?: number | string | null;
    completed?: boolean;
    isCompleted?: boolean;
    children?: {
      data?: TodoApiItem[];
    };
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

const toIdentifier = (value: unknown): TodoIdentifier | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const resolveChildren = (todo: TodoApiItem): TodoApiItem[] => {
  if (Array.isArray(todo.children)) {
    return todo.children;
  }

  const nested = todo.attributes?.children?.data;
  return Array.isArray(nested) ? nested : [];
};

export const mapTodoApiItem = (todo: TodoApiItem): TodoItem => {
  const id = toIdentifier(todo.documentId) ?? toIdentifier(todo.id) ?? 'unknown';

  return {
    id,
    numericId: typeof todo.id === 'number' ? todo.id : undefined,
    documentId: typeof todo.documentId === 'string' ? todo.documentId : undefined,
    title: todo.attributes?.title ?? todo.title ?? 'Untitled',
    completed: Boolean(
      todo.attributes?.isCompleted ?? todo.attributes?.completed ?? todo.isCompleted ?? todo.completed
    ),
    depth:
      typeof todo.attributes?.depth === 'number'
        ? todo.attributes.depth
        : typeof todo.depth === 'number'
          ? todo.depth
          : undefined,
    completedChildren:
      typeof todo.attributes?.completedChildren === 'number'
        ? todo.attributes.completedChildren
        : typeof todo.completedChildren === 'number'
          ? todo.completedChildren
          : undefined,
    totalChildren:
      typeof todo.attributes?.totalChildren === 'number'
        ? todo.attributes.totalChildren
        : typeof todo.totalChildren === 'number'
          ? todo.totalChildren
          : undefined,
    parentId:
      toIdentifier(todo.attributes?.parentId) ??
      toIdentifier(todo.parentId) ??
      null,
    children: resolveChildren(todo).map(mapTodoApiItem),
  };
};
