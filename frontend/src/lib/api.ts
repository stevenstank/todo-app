const DEFAULT_BASE_URL = 'http://localhost:1337';

const sanitizeBaseUrl = (value: string | undefined): string => {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return DEFAULT_BASE_URL;
  }

  return trimmed.replace(/\/$/, '');
};

export const BASE_URL = sanitizeBaseUrl(process.env.NEXT_PUBLIC_STRAPI_URL);
export const STRAPI_BASE_URL = BASE_URL;

const toStrapiUrl = (path: string): string => new URL(path, `${BASE_URL}/`).toString();

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

export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

const parseResponseBody = async (res: Response): Promise<JsonValue | undefined> => {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return (await res.json()) as JsonValue;
};

export const getFriendlyApiErrorMessage = (status: number): string => {
  if (status === 401) {
    return 'Invalid credentials';
  }

  return 'Something went wrong';
};

export const parseJsonSafely = async <T>(res: Response): Promise<T | undefined> => {
  const contentType = res.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return (await res.json()) as T;
};

export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (typeof window === 'undefined') {
    throw new ApiError(500, 'authFetch can only run in the browser');
  }

  const token = window.localStorage.getItem('token');

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  const res = await fetch(toStrapiUrl(url), {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    const payload = await parseResponseBody(res);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(401, 'Authentication required', payload);
  }

  if (res.status === 403) {
    const payload = await parseResponseBody(res);
    throw new ApiError(403, 'You are not allowed to access this resource', payload);
  }

  return res;
};

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> =>
  fetch(toStrapiUrl(url), options);

type AuthResponse = {
  jwt?: string;
  user?: Record<string, unknown>;
  error?: {
    message?: string;
  };
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const endpoint = toStrapiUrl('/api/auth/local');
  console.log('Calling Strapi API...', endpoint);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: email,
      password: password,
    }),
  });

  const data = (await parseJsonSafely<AuthResponse>(res)) ?? {};

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Login failed');
  }

  return data;
};

export const registerUser = async (
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> => {
  const endpoint = toStrapiUrl('/api/auth/local/register');
  console.log('Calling Strapi API...', endpoint);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });

  const data = (await parseJsonSafely<AuthResponse>(res)) ?? {};

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Signup failed');
  }

  return data;
};