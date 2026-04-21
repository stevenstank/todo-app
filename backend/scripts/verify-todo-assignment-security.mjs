/*
  Assignment security checker.

  Required env:
  - TOKEN_A JWT for user A
  - TOKEN_B JWT for user B

  Optional env:
  - API_URL (default: http://localhost:1337)
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

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getUserIdFromToken = (token) => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));

    if (typeof decoded?.id === 'number') {
      return decoded.id;
    }

    if (typeof decoded?.sub === 'number') {
      return decoded.sub;
    }

    if (typeof decoded?.sub === 'string') {
      const numeric = Number(decoded.sub);
      return Number.isInteger(numeric) ? numeric : null;
    }
  } catch {
    return null;
  }

  return null;
};

const createTodo = async (token, title) =>
  jsonFetch('/api/todos', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      data: {
        title,
        completed: false,
      },
    }),
  });

const updateTodoAssignment = async (token, todoId, assignedUser) =>
  jsonFetch(`/api/todos/${todoId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({
      data: {
        assignedUser,
      },
    }),
  });

const listAssignableUsers = async (token) =>
  jsonFetch('/api/todos/assignable-users', {
    method: 'GET',
    headers: authHeaders(token),
  });

const deleteTodo = async (token, todoId) =>
  jsonFetch(`/api/todos/${todoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

const run = async () => {
  let createdTodoId = null;

  try {
    const userAId = getUserIdFromToken(TOKEN_A);

    console.log('1) User A creates a todo...');
    const createResult = await createTodo(TOKEN_A, `Assignment security ${Date.now()}`);
    assert(createResult.response.ok, `Create failed (${createResult.response.status})`);

    createdTodoId = createResult.payload?.data?.id;
    assert(Number.isFinite(createdTodoId), 'Created todo id missing');

    console.log('2) User A gets assignable users and picks a valid assignee...');
    const usersResult = await listAssignableUsers(TOKEN_A);
    assert(usersResult.response.ok, `Assignable users failed (${usersResult.response.status})`);

    const users = Array.isArray(usersResult.payload?.data) ? usersResult.payload.data : [];
    assert(users.length > 0, 'Assignable users response was empty');

    const assignTarget =
      users.find((user) => typeof user?.id === 'number' && (userAId === null || user.id !== userAId)) ??
      users[0];
    const assignTargetId = assignTarget?.id;

    assert(Number.isFinite(assignTargetId), 'Could not resolve an assignable target user');

    console.log('3) User A assigns todo to another valid user (or self if single-user env)...');
    const assignAllowed = await updateTodoAssignment(TOKEN_A, createdTodoId, assignTargetId);
    assert(assignAllowed.response.ok, `Valid assignment failed (${assignAllowed.response.status})`);

    console.log('4) Invalid assignee id is rejected...');
    const invalidAssign = await updateTodoAssignment(TOKEN_A, createdTodoId, 999999999);
    assert(
      invalidAssign.response.status === 400,
      `Expected 400 for invalid assignee, got ${invalidAssign.response.status}`
    );

    console.log('5) User B cannot assign User A todo...');
    const unauthorizedAssign = await updateTodoAssignment(TOKEN_B, createdTodoId, assignTargetId);
    assert(
      unauthorizedAssign.response.status === 403 || unauthorizedAssign.response.status === 404,
      `Expected 403/404 for unauthorized assignment, got ${unauthorizedAssign.response.status}`
    );

    console.log('Assignment security checks passed.');
  } finally {
    if (Number.isFinite(createdTodoId)) {
      await deleteTodo(TOKEN_A, createdTodoId);
    }
  }
};

run().catch((error) => {
  console.error('Assignment verification failed:', error.message);
  process.exit(1);
});
