import { authFetch, ApiError } from '@/lib/api';

export type TodoAttributes = {
  title?: string;
  description?: string;
  completed?: boolean;
  isCompleted?: boolean;
};

export type TodoItem = {
  id: number;
  attributes?: TodoAttributes;
  title?: string;
  description?: string;
  completed?: boolean;
  isCompleted?: boolean;
};

export const fetchTodos = async (): Promise<TodoItem[]> => {
  const res = await authFetch('/api/todos');

  if (!res.ok) {
    throw new ApiError(res.status, 'Failed to fetch todos');
  }

  const json = (await res.json()) as { data?: TodoItem[] };
  return Array.isArray(json?.data) ? json.data : [];
};

export const createTodoRequest = async (title: string): Promise<void> => {
  const response = await authFetch('/api/todos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        title,
        isCompleted: false,
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to create todo');
  }
};

export const toggleTodoRequest = async (
  id: number,
  nextCompleted: boolean
): Promise<void> => {
  const response = await authFetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        isCompleted: nextCompleted,
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to toggle todo');
  }
};

export const deleteTodoRequest = async (id: number): Promise<void> => {
  const response = await authFetch(`/api/todos/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to delete todo');
  }
};
