const appendPagination = (params: URLSearchParams) => {
  params.set('pagination[page]', '1');
  params.set('pagination[pageSize]', '200');
};

export const buildTodosByUserPath = (userId: number): string => {
  const params = new URLSearchParams();
  params.set('filters[user][id][$eq]', String(userId));
  params.set('populate', '*');
  params.set('sort[0]', 'id:desc');
  appendPagination(params);
  return `/api/todos?${params.toString()}`;
};

export const buildTodoByIdForUserPath = (todoId: string, userId: number): string => {
  const params = new URLSearchParams();
  params.set('filters[$or][0][documentId][$eq]', todoId);
  params.set('filters[$or][1][id][$eq]', todoId);
  params.set('filters[user][id][$eq]', String(userId));
  params.set('populate', '*');
  params.set('pagination[page]', '1');
  params.set('pagination[pageSize]', '1');
  return `/api/todos?${params.toString()}`;
};