export const STRAPI_BASE_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

export class ApiError extends Error {
  status: number;
  payload?: JsonValue;

  constructor(status: number, message: string, payload?: JsonValue) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const parseResponseBody = async (res: Response): Promise<JsonValue | undefined> => {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return (await res.json()) as JsonValue;
};

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (typeof window === 'undefined') {
    throw new ApiError(500, 'authFetch can only run in the browser');
  }

  const token = window.localStorage.getItem('token');

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  const res = await fetch(`${STRAPI_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    const payload = await parseResponseBody(res);
    throw new ApiError(401, 'Authentication required', payload);
  }

  if (res.status === 403) {
    const payload = await parseResponseBody(res);
    throw new ApiError(403, 'You are not allowed to access this resource', payload);
  }

  return res;
};

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> =>
  fetch(`${STRAPI_BASE_URL}${url}`, options);