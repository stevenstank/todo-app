/*
  Completion propagation checker for hierarchical todos.

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

const createTodo = async (title, extraData = {}) =>
  jsonFetch('/api/todos', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      data: {
        title,
        completed: false,
        isCompleted: false,
        ...extraData,
      },
    }),
  });

const updateTodo = async (id, completed) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      data: {
        completed,
        isCompleted: completed,
      },
    }),
  });

const getTodo = async (id) =>
  jsonFetch(`/api/todos/${id}?populate=children`, {
    method: 'GET',
    headers: authHeaders,
  });

const deleteTodo = async (id) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

const readCompleted = (payload) =>
  Boolean(payload?.data?.completed ?? payload?.data?.isCompleted ?? payload?.data?.attributes?.completed);

const run = async () => {
  const created = [];

  try {
    console.log('1) Creating parent with two children...');
    const parentRes = await createTodo(`Completion parent ${Date.now()}`);
    assert(parentRes.response.ok, `Parent create failed (${parentRes.response.status})`);

    const parentId = parentRes.payload?.data?.id;
    assert(Number.isFinite(parentId), 'Parent id missing');
    created.push(parentId);

    const childARes = await createTodo(`Completion child A ${Date.now()}`, { parent: parentId });
    const childBRes = await createTodo(`Completion child B ${Date.now()}`, { parent: parentId });

    assert(childARes.response.ok, `Child A create failed (${childARes.response.status})`);
    assert(childBRes.response.ok, `Child B create failed (${childBRes.response.status})`);

    const childAId = childARes.payload?.data?.id;
    const childBId = childBRes.payload?.data?.id;
    assert(Number.isFinite(childAId) && Number.isFinite(childBId), 'Child ids missing');
    created.push(childAId, childBId);

    console.log('2) Completing all children should auto-complete parent...');
    const updateA = await updateTodo(childAId, true);
    const updateB = await updateTodo(childBId, true);
    assert(updateA.response.ok, `Child A update failed (${updateA.response.status})`);
    assert(updateB.response.ok, `Child B update failed (${updateB.response.status})`);

    const parentAfterComplete = await getTodo(parentId);
    assert(parentAfterComplete.response.ok, `Parent fetch failed (${parentAfterComplete.response.status})`);
    assert(readCompleted(parentAfterComplete.payload) === true, 'Parent should be completed when all children are completed');

    console.log('3) Unchecking one child should revert parent to incomplete...');
    const revertA = await updateTodo(childAId, false);
    assert(revertA.response.ok, `Child A revert failed (${revertA.response.status})`);

    const parentAfterRevert = await getTodo(parentId);
    assert(parentAfterRevert.response.ok, `Parent fetch after revert failed (${parentAfterRevert.response.status})`);
    assert(readCompleted(parentAfterRevert.payload) === false, 'Parent should revert to incomplete when a child is incomplete');

    console.log('Completion propagation checks passed.');
  } finally {
    console.log('4) Cleaning up...');
    const [parentId, ...childIds] = created;

    for (const id of childIds.reverse()) {
      if (Number.isFinite(id)) {
        await deleteTodo(id);
      }
    }

    if (Number.isFinite(parentId)) {
      await deleteTodo(parentId);
    }
  }
};

run().catch((error) => {
  console.error('Completion propagation verification failed:', error.message);
  process.exit(1);
});
