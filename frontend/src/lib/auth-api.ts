import { getResponseErrorMessage } from '@/lib/error-handler';

export type AuthUser = Record<string, unknown> | null;

type AuthResponsePayload = {
  jwt?: string;
  user?: Record<string, unknown>;
  error?: {
    message?: string;
  };
};

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

type AuthSession = {
  jwt: string;
  user: AuthUser;
};

const parseAuthResponse = async (res: Response, fallbackMessage: string): Promise<AuthSession> => {
  const payload = (await res.json().catch(() => ({}))) as AuthResponsePayload;

  if (!res.ok) {
    throw new Error(getResponseErrorMessage(payload, fallbackMessage));
  }

  const jwt = typeof payload.jwt === 'string' ? payload.jwt : null;

  if (!jwt) {
    throw new Error(`${fallbackMessage}: missing auth token.`);
  }

  return {
    jwt,
    user: (payload.user as Record<string, unknown>) ?? null,
  };
};

export const loginApi = async ({ email, password }: LoginInput): Promise<AuthSession> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  return parseAuthResponse(response, 'Login failed');
};

export const registerApi = async ({ username, email, password }: RegisterInput): Promise<AuthSession> => {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      username: username.trim(),
      email: email.trim(),
      password,
    }),
  });

  return parseAuthResponse(response, 'Signup failed');
};

export const logoutApi = async (): Promise<void> => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    cache: 'no-store',
  });
};
