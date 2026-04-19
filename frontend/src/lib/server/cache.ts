export const TODOS_PATH = '/todos';

export const TODOS_TAG = 'todos';

export const getTodosUserTag = (userId: number): string => `todos:user:${userId}`;
