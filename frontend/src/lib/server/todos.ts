import { ServerApiError, strapiGet } from '@/lib/server/api';
import { getAuthUserId } from '@/lib/server/strapi';
import type { TodoItem, TodoApiItem } from '@/types/todo';
import { mapTodoApiItem } from '@/types/todo';
import { buildTodosByUserPath } from '@/lib/server/todos-query';

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
    const authUserId = getAuthUserId();

    if (typeof authUserId !== 'number') {
      return {
        status: 401,
        data: [],
        error: 'Authentication required',
      };
    }

    const payload = await strapiGet<TodosPayload>(buildTodosByUserPath(authUserId), {
      errorMessage: 'Failed to load todos',
    });

    if (process.env.NODE_ENV !== 'production') {
      const ids = (payload.data ?? [])
        .map((todo) => todo.id)
        .filter((id): id is number => typeof id === 'number');

      console.info('[todos][server-fetch]', {
        userId: authUserId,
        total: ids.length,
        ids,
      });
    }

    return {
      status: 200,
      data: (payload.data ?? []).map(mapTodoApiItem),
    };
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[todos][server-fetch][error]', {
          status: error.status,
          message: error.message,
          payload: error.payload,
        });
      }

      if (error.status === 401 || error.status === 403) {
        return {
          status: 401,
          data: [],
          error: 'Authentication required',
        };
      }

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
