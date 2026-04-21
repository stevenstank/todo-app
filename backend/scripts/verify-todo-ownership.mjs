/*
  Manual integration checker for todo ownership and deletion consistency.

  Required env:
  - API_URL   (default: http://localhost:1337)
  - TOKEN_A   JWT for User A
  - TOKEN_B   JWT for User B
*/

const API_URL = process.env.API_URL ?? 'http://localhost:1337';
const TOKEN_A = process.env.TOKEN_A;
const TOKEN_B = process.env.TOKEN_B;

if (!TOKEN_A || !TOKEN_B) {
  console.error('Missing TOKEN_A or TOKEN_B environment variable.');
  process.exit(1);
}

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const jsonFetch = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const getTodos = async (token) =>
  jsonFetch('/api/todos?populate=*', {
    method: 'GET',
    headers: authHeaders(token),
  });

const createTodo = async (token, title, extraData = {}) =>
  jsonFetch('/api/todos', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ data: { title, isCompleted: false, ...extraData } }),
  });

const deleteTodo = async (token, id) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const updateTodo = async (token, id, title) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ data: { title } }),
  });

const getIds = (payload) => (Array.isArray(payload?.data) ? payload.data.map((item) => item?.id).filter(Number.isFinite) : []);

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log('1) Fetching User A and User B todos...');
  const aBefore = await getTodos(TOKEN_A);
  const bBefore = await getTodos(TOKEN_B);

  assert(aBefore.response.ok, `User A fetch failed (${aBefore.response.status})`);
  assert(bBefore.response.ok, `User B fetch failed (${bBefore.response.status})`);

  const aIdsBefore = getIds(aBefore.payload);
  const bIdsBefore = getIds(bBefore.payload);
  console.log('User A IDs:', aIdsBefore);
  console.log('User B IDs:', bIdsBefore);

  const overlap = aIdsBefore.filter((id) => bIdsBefore.includes(id));
  assert(overlap.length === 0, `Ownership leak detected, overlapping todo IDs: ${overlap.join(', ')}`);

  console.log('2) User A creates one todo...');
  const createRes = await createTodo(TOKEN_A, `Ownership test ${Date.now()}`);
  assert(createRes.response.ok, `Create failed (${createRes.response.status})`);

  const createdId = createRes.payload?.data?.id;
  assert(Number.isFinite(createdId), 'Create response missing todo id');
  console.log('Created todo id:', createdId);

  console.log('3) User B tries to update/delete User A todo (must fail 403/404)...');
  const updateByB = await updateTodo(TOKEN_B, createdId, 'hacked by b');
  const deleteByB = await deleteTodo(TOKEN_B, createdId);

  assert(
    updateByB.response.status === 403 || updateByB.response.status === 404,
    `User B update unexpectedly succeeded (${updateByB.response.status})`
  );
  assert(
    deleteByB.response.status === 403 || deleteByB.response.status === 404,
    `User B delete unexpectedly succeeded (${deleteByB.response.status})`
  );

  console.log('4) User A deletes created todo and verifies hard delete...');
  const deleteByA = await deleteTodo(TOKEN_A, createdId);
  assert(deleteByA.response.ok, `User A delete failed (${deleteByA.response.status})`);

  const aAfterDelete = await getTodos(TOKEN_A);
  assert(aAfterDelete.response.ok, `User A fetch after delete failed (${aAfterDelete.response.status})`);
  const aIdsAfterDelete = getIds(aAfterDelete.payload);

  assert(!aIdsAfterDelete.includes(createdId), `Deleted todo reappeared (${createdId})`);

  console.log('5) User A creates again and verifies deleted id stays absent...');
  const createAgain = await createTodo(TOKEN_A, `Post-delete consistency ${Date.now()}`);
  assert(createAgain.response.ok, `Second create failed (${createAgain.response.status})`);

  const aAfterCreate = await getTodos(TOKEN_A);
  assert(aAfterCreate.response.ok, `User A fetch after create failed (${aAfterCreate.response.status})`);

  const aIdsAfterCreate = getIds(aAfterCreate.payload);
  assert(!aIdsAfterCreate.includes(createdId), `Deleted todo id returned after create (${createdId})`);

  console.log('6) User A creates parent + sub-todo and verifies linkage...');
  const parentRes = await createTodo(TOKEN_A, `Hierarchy parent ${Date.now()}`);
  assert(parentRes.response.ok, `Parent create failed (${parentRes.response.status})`);

  const parentId = parentRes.payload?.data?.id;
  assert(Number.isFinite(parentId), 'Parent create response missing id');

  const parentDepth = parentRes.payload?.data?.depth;
  assert(parentDepth === 0, `Parent depth expected 0 but got ${String(parentDepth)}`);

  const childRes = await createTodo(TOKEN_A, `Hierarchy child ${Date.now()}`, { parent: parentId });
  assert(childRes.response.ok, `Child create failed (${childRes.response.status})`);

  const childId = childRes.payload?.data?.id;
  assert(Number.isFinite(childId), 'Child create response missing id');
  assert(childRes.payload?.data?.depth === 1, `Child depth expected 1 but got ${String(childRes.payload?.data?.depth)}`);

  const parentWithChildren = await jsonFetch(`/api/todos/${parentId}?populate=children`, {
    method: 'GET',
    headers: authHeaders(TOKEN_A),
  });

  assert(parentWithChildren.response.ok, `Fetching parent with children failed (${parentWithChildren.response.status})`);

  const children = parentWithChildren.payload?.data?.children ?? parentWithChildren.payload?.data?.attributes?.children?.data ?? [];
  const childIds = Array.isArray(children)
    ? children.map((item) => item?.id).filter(Number.isFinite)
    : [];

  assert(childIds.includes(childId), `Expected child ${childId} under parent ${parentId}`);

  console.log('7) Parent deletion is blocked while children exist...');
  const blockedDelete = await deleteTodo(TOKEN_A, parentId);
  assert(
    blockedDelete.response.status === 400 || blockedDelete.response.status === 409,
    `Expected blocked parent delete, got ${blockedDelete.response.status}`
  );

  const childDelete = await deleteTodo(TOKEN_A, childId);
  assert(childDelete.response.ok, `Child delete failed (${childDelete.response.status})`);

  const parentDelete = await deleteTodo(TOKEN_A, parentId);
  assert(parentDelete.response.ok, `Parent delete after child removal failed (${parentDelete.response.status})`);

  console.log('All ownership and deletion consistency checks passed.');
};

run().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
