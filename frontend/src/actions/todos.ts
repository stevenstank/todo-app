import { getOfflineMessage, getResponseErrorMessage, isOffline } from '@/lib/error-handler';
import type {
  AssignableUsersPayload,
  TodoIdentifier,
  TodoPayload,
  TodosPayload,
} from '@/types/todo';

export class TodoActionError extends Error {}
export class TodoUnauthorizedError extends TodoActionError {}

type GenerateSubtasksPayload = {
  subtasks?: unknown;
  error?: {
    message?: string;
  };
};

const parseJson = async <T>(response: Response): Promise<T> =>
  ((await response.json().catch(() => ({}))) as T);

const readCurrentUserId = (): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem('auth_user');

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { id?: unknown };

    if (typeof parsed.id === 'number') {
      return parsed.id;
    }

    if (typeof parsed.id === 'string') {
      const asNumber = Number(parsed.id);
      return Number.isNaN(asNumber) ? null : asNumber;
    }
  } catch {
    return null;
  }

  return null;
};

const buildTodosPath = (): string => {
  const userId = readCurrentUserId();
  const params = new URLSearchParams();

  if (typeof userId === 'number') {
    params.set('filters[user][id][$eq]', String(userId));
  }

  params.set('populate', '*');
  return `/api/todos?${params.toString()}`;
};

const getBearerAuthHeader = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = window.localStorage.getItem('token') ?? window.localStorage.getItem('jwt');

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

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

export const createTodoRequest = async (title: string, parentId?: TodoIdentifier): Promise<TodoPayload> => {
  try {
    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        data: {
          title,
          isCompleted: false,
          ...(parentId ? { parent: parentId } : {}),
        },
      }),
    });

    const payload = await parseJson<TodoPayload>(response);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[todos][create]', { status: response.status, payload });
    }

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

export const generateSubtasksWithAiRequest = async (taskTitle: string): Promise<string[]> => {
  try {
    console.info('[todos][ai] Sending request', { taskLength: taskTitle.length });

    const response = await fetch('/api/ai/generate-todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        task: taskTitle,
      }),
    });

    const rawText = await response.text();
    let payload = {} as GenerateSubtasksPayload;

    if (rawText) {
      try {
        payload = JSON.parse(rawText) as GenerateSubtasksPayload;
      } catch {
        payload = { error: { message: rawText } };
      }
    }

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      console.error('[todos][ai] Frontend API Error:', {
        status: response.status,
        body: rawText,
      });
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not generate subtasks'));
    }

    const rawSubtasks = Array.isArray(payload.subtasks) ? payload.subtasks : [];

    const subtasks = rawSubtasks
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);

    if (subtasks.length === 0) {
      throw new TodoActionError('AI did not return valid subtasks');
    }

    console.info('[todos][ai] Received subtasks', { count: subtasks.length });
    return subtasks;
  } catch (error) {
    throw toRequestError(error, 'Could not generate subtasks');
  }
};

export const toggleTodoRequest = async (todoId: TodoIdentifier, nextCompleted: boolean): Promise<void> => {
  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        data: {
          completed: nextCompleted,
          isCompleted: nextCompleted,
        },
      }),
    });

    const payload = await parseJson<TodoPayload>(response);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[todos][toggle]', { todoId, status: response.status, payload });
    }

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

export const assignTodoRequest = async (
  todoId: TodoIdentifier,
  assignedUserId: number | null
): Promise<void> => {
  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        data: {
          assignedUser: assignedUserId,
        },
      }),
    });

    const payload = await parseJson<TodoPayload>(response);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[todos][assign]', { todoId, assignedUserId, status: response.status, payload });
    }

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not assign todo'));
    }
  } catch (error) {
    throw toRequestError(error, 'Could not assign todo');
  }
};

export const deleteTodoRequest = async (todoId: TodoIdentifier): Promise<void> => {
  try {
    const response = await fetch(`/api/todos/${todoId}`, {
      method: 'DELETE',
      headers: {
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
    });

    const payload = await parseJson<TodosPayload>(response);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[todos][delete]', { todoId, status: response.status, payload });
    }

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

export const fetchAssignableUsersRequest = async (): Promise<AssignableUsersPayload> => {
  try {
    const response = await fetch('/api/todos/assignable-users', {
      method: 'GET',
      headers: {
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
    });

    const payload = await parseJson<AssignableUsersPayload>(response);

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not load users'));
    }

    return payload;
  } catch (error) {
    throw toRequestError(error, 'Could not load users');
  }
};

export const fetchTodosRequest = async (
  source: 'default' | 'after-create' | 'after-delete' | 'after-toggle' | 'after-assign' = 'default'
): Promise<TodosPayload> => {
  try {
    const path = buildTodosPath();

    const response = await fetch(path, {
      method: 'GET',
      headers: {
        ...getBearerAuthHeader(),
      },
      cache: 'no-store',
    });

    const payload = await parseJson<TodosPayload>(response);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[todos][fetch]', {
        source,
        path,
        status: response.status,
        total: Array.isArray(payload.data) ? payload.data.length : 0,
        ids: Array.isArray(payload.data) ? payload.data.map((item) => item.id) : [],
      });
    }

    if (response.status === 401) {
      throw new TodoUnauthorizedError('Authentication required');
    }

    if (!response.ok) {
      throw new TodoActionError(getResponseErrorMessage(payload, 'Could not load todos'));
    }

    return payload;
  } catch (error) {
    throw toRequestError(error, 'Could not load todos');
  }
};
