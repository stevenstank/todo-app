/*
  Tree fetch and performance checker for hierarchical todos.

  Required env:
  - TOKEN_A JWT for a test user

  Optional env:
  - API_URL (default: http://localhost:1337)
  - TODO_COUNT (default: 120)
*/

const API_URL = process.env.API_URL ?? 'http://localhost:1337';
const TOKEN_A = process.env.TOKEN_A;
const TODO_COUNT = Number(process.env.TODO_COUNT ?? '120');

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

const createTodo = async (title, extraData = {}) =>
  jsonFetch('/api/todos', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ data: { title, ...extraData } }),
  });

const deleteTodo = async (id) =>
  jsonFetch(`/api/todos/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const flattenIds = (nodes, ids = []) => {
  for (const node of nodes) {
    if (typeof node?.id === 'number') {
      ids.push(node.id);
    }

    const children = Array.isArray(node?.children) ? node.children : [];
    flattenIds(children, ids);
  }

  return ids;
};

const ensureMaxDepth = (nodes, maxLevels, level = 0) => {
  for (const node of nodes) {
    const children = Array.isArray(node?.children) ? node.children : [];

    if (level >= maxLevels) {
      assert(children.length === 0, `Exceeded max child levels at todo ${String(node?.id)}`);
      continue;
    }

    ensureMaxDepth(children, maxLevels, level + 1);
  }
};

const run = async () => {
  const created = [];

  try {
    console.log(`1) Creating ${TODO_COUNT} todos in a shallow tree...`);

    const rootTarget = Math.max(10, Math.floor(TODO_COUNT / 4));
    for (let i = 0; i < rootTarget; i += 1) {
      const rootRes = await createTodo(`Perf root ${Date.now()}-${i}`);
      assert(rootRes.response.ok, `Root create failed (${rootRes.response.status})`);
      created.push(rootRes.payload?.data?.id);
    }

    const rootIds = created.filter(Number.isFinite);
    assert(rootIds.length > 0, 'No root todos created');

    for (let i = rootIds.length; i < TODO_COUNT; i += 1) {
      const parentId = rootIds[i % rootIds.length];
      const childRes = await createTodo(`Perf child ${Date.now()}-${i}`, { parent: parentId });
      assert(childRes.response.ok, `Child create failed (${childRes.response.status})`);
      created.push(childRes.payload?.data?.id);
    }

    console.log('2) Fetching /api/todos tree and measuring response time...');
    const start = Date.now();
    const treeRes = await jsonFetch('/api/todos', {
      method: 'GET',
      headers: authHeaders,
    });
    const elapsedMs = Date.now() - start;

    assert(treeRes.response.ok, `Tree fetch failed (${treeRes.response.status})`);

    const roots = Array.isArray(treeRes.payload?.data) ? treeRes.payload.data : [];
    assert(roots.length > 0, 'Expected root todos in tree response');

    ensureMaxDepth(roots, 2);

    const allIds = flattenIds(roots, []);
    const uniqueCount = new Set(allIds).size;
    assert(uniqueCount === allIds.length, 'Duplicate todo IDs found in tree response');

    console.log(`Tree fetch completed in ${elapsedMs}ms for ${allIds.length} returned nodes.`);
    console.log('No duplicate nodes found; max nesting level constraint is respected.');
  } finally {
    console.log('3) Cleaning up created todos...');
    const ids = created.filter(Number.isFinite).reverse();

    for (const id of ids) {
      await deleteTodo(id);
    }
  }
};

run().catch((error) => {
  console.error('Tree performance verification failed:', error.message);
  process.exit(1);
});
