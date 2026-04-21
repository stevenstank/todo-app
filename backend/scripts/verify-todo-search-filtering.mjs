/*
  Todo search filtering checker.

  Required env:
  - TOKEN_A JWT for test user

  Optional env:
  - API_URL (default: http://localhost:1337)
*/

const API_URL = process.env.API_URL ?? 'http://localhost:1337';
const TOKEN_A = process.env.TOKEN_A;

if (!TOKEN_A) {
  console.error('Missing TOKEN_A environment variable.');
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${TOKEN_A}`,
  'Content-Type': 'application/json',
};

const jsonFetch = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const createTodo = async (title, completed) =>
  jsonFetch('/api/todos', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      data: {
        title,
        completed,
        isCompleted: completed,
      },
    }),
  });

const deleteTodo = async (id) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

const searchTodos = async (term, completed) => {
  const params = new URLSearchParams();

  if (typeof term === 'string' && term.trim().length > 0) {
    params.set('filters[title][$containsi]', term.trim());
  }

  if (typeof completed === 'boolean') {
    params.set('filters[completed][$eq]', String(completed));
  }

  params.set('populate', '*');
  return jsonFetch(`/api/todos?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders,
  });
};

const getTitles = (payload) =>
  (Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => item?.title ?? item?.attributes?.title)
    .filter((value) => typeof value === 'string');

const run = async () => {
  const createdIds = [];

  try {
    const titleA = `Search target Alpha MixedCase ${Date.now()}`;
    const titleB = `Another item unrelated ${Date.now()}`;

    console.log('1) Creating todos for search checks...');
    const a = await createTodo(titleA, true);
    const b = await createTodo(titleB, false);

    assert(a.response.ok, `Create A failed (${a.response.status})`);
    assert(b.response.ok, `Create B failed (${b.response.status})`);

    const idA = a.payload?.data?.id;
    const idB = b.payload?.data?.id;

    assert(Number.isFinite(idA), 'Missing id for todo A');
    assert(Number.isFinite(idB), 'Missing id for todo B');

    createdIds.push(idA, idB);

    console.log('2) Partial-word search should match target...');
    const partial = await searchTodos('Alpha Mix', undefined);
    assert(partial.response.ok, `Partial search failed (${partial.response.status})`);

    const partialTitles = getTitles(partial.payload);
    assert(partialTitles.some((title) => title.includes('Alpha MixedCase')), 'Partial search did not match expected todo');

    console.log('3) Case-insensitive search should match target...');
    const caseInsensitive = await searchTodos('aLpHa mIxEdCaSe', undefined);
    assert(caseInsensitive.response.ok, `Case-insensitive search failed (${caseInsensitive.response.status})`);

    const caseTitles = getTitles(caseInsensitive.payload);
    assert(caseTitles.some((title) => title.includes('Alpha MixedCase')), 'Case-insensitive search did not match expected todo');

    console.log('4) Optional completed filter should narrow results...');
    const completedTrue = await searchTodos('Alpha', true);
    assert(completedTrue.response.ok, `Completed=true search failed (${completedTrue.response.status})`);

    const completedTrueTitles = getTitles(completedTrue.payload);
    assert(completedTrueTitles.some((title) => title.includes('Alpha MixedCase')), 'Completed=true filter missed expected todo');

    const completedFalse = await searchTodos('Alpha', false);
    assert(completedFalse.response.ok, `Completed=false search failed (${completedFalse.response.status})`);

    const completedFalseTitles = getTitles(completedFalse.payload);
    assert(
      !completedFalseTitles.some((title) => title.includes('Alpha MixedCase')),
      'Completed=false filter unexpectedly returned completed todo'
    );

    console.log('Search filtering checks passed.');
  } finally {
    for (const id of createdIds.reverse()) {
      if (Number.isFinite(id)) {
        await deleteTodo(id);
      }
    }
  }
};

run().catch((error) => {
  console.error('Search filtering verification failed:', error.message);
  process.exit(1);
});
