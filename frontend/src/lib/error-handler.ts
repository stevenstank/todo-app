import { ApiError } from '@/lib/api';

const OFFLINE_MESSAGE = "You're offline. Check your internet connection.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const findMessageInPayload = (payload: unknown): string | undefined => {
  if (!payload) {
    return undefined;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nestedMessage = findMessageInPayload(entry);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    return undefined;
  }

  if (!isRecord(payload)) {
    return readString(payload);
  }

  const direct = readString(payload.message);
  if (direct) {
    return direct;
  }

  const errorValue = payload.error;
  if (errorValue) {
    const nestedErrorMessage = findMessageInPayload(errorValue);
    if (nestedErrorMessage) {
      return nestedErrorMessage;
    }
  }

  const detailsValue = payload.details;
  if (detailsValue) {
    const nestedDetailsMessage = findMessageInPayload(detailsValue);
    if (nestedDetailsMessage) {
      return nestedDetailsMessage;
    }
  }

  for (const value of Object.values(payload)) {
    const nested = findMessageInPayload(value);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

export const isOffline = (): boolean =>
  typeof navigator !== 'undefined' ? !navigator.onLine : false;

export const getOfflineMessage = (): string => OFFLINE_MESSAGE;

export const normalizeApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isOffline()) {
    return OFFLINE_MESSAGE;
  }

  if (error instanceof ApiError) {
    return findMessageInPayload(error.payload) ?? error.message ?? fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
};

export const getResponseErrorMessage = (
  payload: unknown,
  fallbackMessage: string,
  options?: { useGenericFallback?: boolean }
): string => {
  const payloadMessage = findMessageInPayload(payload);

  if (payloadMessage) {
    return payloadMessage;
  }

  if (options?.useGenericFallback) {
    return 'Something went wrong';
  }

  return fallbackMessage;
};
