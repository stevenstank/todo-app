import { getStrapiUrl, getAuthToken } from '@/lib/server/strapi';

type Primitive = string | number | boolean | null;
type JsonValue = Primitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export class ServerApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ServerApiError';
    this.status = status;
    this.payload = payload;
  }
}

type BaseRequestOptions = {
  headers?: HeadersInit;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  revalidate?: number | false;
  tags?: string[];
  withAuth?: boolean;
  errorMessage?: string;
};

type RequestOptions<TBody> = BaseRequestOptions & {
  body?: TBody;
};

type StrapiErrorPayload = {
  error?: {
    message?: string;
  };
  message?: string;
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return response.json().catch(() => undefined);
};

const extractMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const parsed = payload as StrapiErrorPayload;
  return parsed.error?.message || parsed.message || fallback;
};

const buildHeaders = (body: unknown, headers?: HeadersInit): HeadersInit => {
  const baseHeaders = new Headers(headers);

  if (body !== undefined && !(body instanceof FormData) && !baseHeaders.has('Content-Type')) {
    baseHeaders.set('Content-Type', 'application/json');
  }

  return baseHeaders;
};

const attachAuthHeader = (headers: HeadersInit, token: string): Headers => {
  const nextHeaders = new Headers(headers);
  nextHeaders.set('Authorization', `Bearer ${token}`);
  return nextHeaders;
};

export async function strapiRequest<TResponse, TBody = JsonObject>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const {
    body,
    headers,
    cache,
    next,
    revalidate,
    tags,
    withAuth = true,
    errorMessage = 'Request failed',
  } = options;

  const resolvedCache =
    cache ??
    (method === 'GET' && !withAuth
      ? 'force-cache'
      : 'no-store');

  if (withAuth && (resolvedCache === 'force-cache' || typeof revalidate === 'number')) {
    throw new ServerApiError(
      500,
      'Authenticated requests must use non-cacheable fetch settings to avoid leaking user data'
    );
  }

  let resolvedHeaders = buildHeaders(body, headers);

  if (withAuth) {
    const token = getAuthToken();

    if (!token) {
      throw new ServerApiError(401, 'Authentication required');
    }

    resolvedHeaders = attachAuthHeader(resolvedHeaders, token);
  }

  const fetchNext =
    revalidate !== undefined || tags?.length
      ? {
          ...(next ?? {}),
          ...(revalidate !== undefined ? { revalidate } : {}),
          ...(tags?.length ? { tags } : {}),
        }
      : next;

  const response = await fetch(getStrapiUrl(path), {
    method,
    headers: resolvedHeaders,
    cache: resolvedCache,
    next: fetchNext,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ServerApiError(response.status, extractMessage(payload, errorMessage), payload);
  }

  return (payload ?? ({} as TResponse)) as TResponse;
}

export const strapiGet = <TResponse>(path: string, options?: BaseRequestOptions): Promise<TResponse> =>
  strapiRequest<TResponse>('GET', path, options);

export const strapiPost = <TResponse, TBody = JsonObject>(
  path: string,
  body?: TBody,
  options?: BaseRequestOptions
): Promise<TResponse> => strapiRequest<TResponse, TBody>('POST', path, { ...options, body });

export const strapiPut = <TResponse, TBody = JsonObject>(
  path: string,
  body?: TBody,
  options?: BaseRequestOptions
): Promise<TResponse> => strapiRequest<TResponse, TBody>('PUT', path, { ...options, body });

export const strapiDelete = <TResponse>(path: string, options?: BaseRequestOptions): Promise<TResponse> =>
  strapiRequest<TResponse>('DELETE', path, options);
