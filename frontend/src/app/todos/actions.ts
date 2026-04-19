'use server';

import { revalidatePath } from 'next/cache';
import { ServerApiError, strapiPost } from '@/lib/server/api';

export type CreateTodoActionState = {
  error: string | null;
  success: boolean;
};

type StrapiCreateTodoResponse = {
  data?: {
    id: number;
  };
  error?: {
    message?: string;
  };
};

type CreateTodoBody = {
  data: {
    title: string;
    isCompleted: boolean;
  };
};

export async function createTodoAction(
  _prevState: CreateTodoActionState,
  formData: FormData
): Promise<CreateTodoActionState> {
  const title = String(formData.get('todo') ?? '').trim();

  if (!title) {
    return {
      error: 'Todo title cannot be empty.',
      success: false,
    };
  }

  try {
    await strapiPost<StrapiCreateTodoResponse, CreateTodoBody>(
      '/api/todos',
      {
        data: {
          title,
          isCompleted: false,
        },
      },
      {
        errorMessage: 'Could not add todo',
      }
    );

    revalidatePath('/todos');

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    if (error instanceof ServerApiError) {
      return {
        error: error.message,
        success: false,
      };
    }

    return {
      error: 'Could not add todo',
      success: false,
    };
  }
}
