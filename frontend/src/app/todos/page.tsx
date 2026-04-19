import { redirect } from 'next/navigation';
import TodosClient from '@root/components/todos/TodosClient';
import { fetchTodosServer } from '@/lib/server/todos';

export const dynamic = 'force-dynamic';

export default async function TodosPage() {
  const result = await fetchTodosServer();

  if (result.status === 401) {
    redirect('/login');
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return <TodosClient initialTodos={result.data} />;
}
