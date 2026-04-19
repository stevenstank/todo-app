import { strapiGet } from '@/lib/server/api';

type PublicTodoPreviewResponse = {
  data?: Array<{
    id: number;
    attributes?: {
      title?: string;
    };
    title?: string;
  }>;
};

// Example only: use for public, non-authenticated pages/widgets.
export const fetchPublicTodoPreview = async (): Promise<string[]> => {
  const payload = await strapiGet<PublicTodoPreviewResponse>('/api/todos?pagination[pageSize]=5', {
    withAuth: false,
    cache: 'force-cache',
    revalidate: 300,
    tags: ['public:todos-preview'],
    errorMessage: 'Failed to load todo preview',
  });

  return (payload.data ?? []).map((item) => item.attributes?.title ?? item.title ?? 'Untitled');
};
