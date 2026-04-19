import { getOfflineMessage, getResponseErrorMessage, isOffline } from '@/lib/error-handler';
import type { TodoPayload, TodosPayload } from '@/types/todo';

export class TodoActionError extends Error {}
export class TodoUnauthorizedError extends TodoActionError {}

const parseJson = async <T>(response: Response): Promise<T> =>
  ((await response.json().catch(() => ({}))) as T);

const toRequestError = (
  error: unknown,
  fallbackMessage: string
): TodoActionError => {
  if (error instanceof TodoActionError) {
    return error;
  }

  if (isOffline()) {
    return new TodoActionError(getOfflineMessage());
  }

  if (error instanceof Error && error.name === 'TypeError') {
    return new TodoActionError('Network error. Please try again.');
  }

  return new TodoActionError(fallbackMessage);
};

export const createTodoRequest = async (title: string): Promise<TodoPayload> => {
  try {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        data: {
          title,
          isCompleted: false,
        },
      }),
    });

    const payload = await parseJson<TodoPayload>(response);

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok || !payload.data) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not add todo'));
    }

    return payload;
  } catch (error) {
    throw toRequestError(error, 'Could not add todo');
  }
};

export const toggleTodoRequest = async (todoId: number, nextCompleted: boolean): Promise<void> => {
  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        data: {
          isCompleted: nextCompleted,
        },
      }),
    });

    const payload = await parseJson<TodoPayload>(response);

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not update todo'));
    }
  } catch (error) {
    throw toRequestError(error, 'Could not update todo');
  }
};

export const deleteTodoRequest = async (todoId: number): Promise<void> => {
  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'DELETE',
      cache: 'no-store',
    });

    const payload = await parseJson<TodosPayload>(response);

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not delete todo'));
    }
  } catch (error) {
    throw toRequestError(error, 'Could not delete todo');
  }
};
