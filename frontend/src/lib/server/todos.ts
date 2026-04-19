import { ServerApiError, strapiGet } from '@/lib/server/api';
import type { TodoItem, TodoApiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';

type TodosPayload = {
  data?: TodoApiItem[];
  error?: {
    message?: string;
  };
};

type FetchTodosResult = {
  status: number;
  data: TodoItem[];
  error?: string;
};

export const fetchTodosServer = async (): Promise<FetchTodosResult> => {
  try {
    const payload = await strapiGet<TodosPayload>('/api/todos', {
      errorMessage: 'Failed to load todos',
    });

    return {
      status: 200,
      data: (payload.data ?? []).map(mapTodoApiItem),
    };
  } catch (error) {
    if (error instanceof ServerApiError) {
      return {
        status: error.status,
        data: [],
        error: error.message,
      };
    }

    return {
      status: 500,
      data: [],
      error: 'Failed to load todos',
    };
  }
};
