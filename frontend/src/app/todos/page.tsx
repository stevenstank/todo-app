import { redirect } from 'next/navigation';
import TodosClient from '@root/components/todos/TodosClient';
import { fetchTodosServer } from '@/lib/server/todos';

export const dynamic = 'force-dynamic';

export default async function TodosPage({
  searchParams,
}: {
  searchParams?: { notice?: string };
}) {
  const result = await fetchTodosServer();

  const noticeMessage =
    searchParams?.notice === 'already-signed-in' ? 'You are already signed in' : undefined;

  if (result.status === 401) {
    redirect('/signin');
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return <TodosClient initialTodos={result.data} noticeMessage={noticeMessage} />;
}
