/**
 * todo controller
 */

import { factories } from '@strapi/strapi';

type AuthUser = { id: number };

const getAuthUser = (ctx: any): AuthUser | null => {
	const user = ctx.state?.user;

	if (!user || typeof user.id !== 'number') {
		return null;
	}

	return { id: user.id };
};

const withoutRestrictedFields = (data: unknown): Record<string, unknown> => {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return {};
	}

	const {
		user: _ignoredUser,
		depth: _ignoredDepth,
		children: _ignoredChildren,
		...safeData
	} = data as Record<string, unknown>;
	return safeData;
};

const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
	Object.prototype.hasOwnProperty.call(obj, key);

const getRelationId = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return value;
	}

	if (value && typeof value === 'object' && typeof (value as any).id === 'number') {
		return (value as any).id;
	}

	return null;
};

const parseIdentifier = (value: unknown): string | number | null => {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		return value.trim();
	}

	if (!value || typeof value !== 'object') {
		return null;
	}

	const maybeObject = value as Record<string, unknown>;

	if (typeof maybeObject.id === 'number' && Number.isInteger(maybeObject.id)) {
		return maybeObject.id;
	}

	if (typeof maybeObject.documentId === 'string' && maybeObject.documentId.trim().length > 0) {
		return maybeObject.documentId.trim();
	}

	if (Array.isArray(maybeObject.connect) && maybeObject.connect.length > 0) {
		return parseIdentifier(maybeObject.connect[0]);
	}

	return null;
};

const extractParentInput = (
	data: Record<string, unknown>
): { provided: false } | { provided: true; value: number | string | null } | { provided: true; invalid: true } => {
	if (!hasOwn(data, 'parent')) {
		return { provided: false };
	}

	const rawParent = data.parent;

	if (rawParent === null) {
		return { provided: true, value: null };
	}

	const identifier = parseIdentifier(rawParent);

	if (identifier === null) {
		return { provided: true, invalid: true };
	}

	return { provided: true, value: identifier };
};

const getOwnerId = (todo: any): number | null => {
	if (!todo?.user) {
		return null;
	}

	if (typeof todo.user === 'number') {
		return todo.user;
	}

	if (typeof todo.user === 'object' && typeof todo.user.id === 'number') {
		return todo.user.id;
	}

	return null;
};

const checkOwnership = (todo: any, userId: number): boolean => getOwnerId(todo) === userId;

const resolveTodoByIdentifier = async (
	identifier: number | string,
	populate: Record<string, unknown> = { user: true }
) => {
	const normalized = String(identifier);
	const numericCandidate = Number(normalized);

	let todo: any = null;

	if (Number.isInteger(numericCandidate) && normalized === String(numericCandidate)) {
		todo = await strapi.entityService.findOne('api::todo.todo', numericCandidate, {
			populate,
		});
	}

	if (!todo) {
		const byDocumentId = await strapi.entityService.findMany('api::todo.todo', {
			filters: {
				documentId: {
					$eq: normalized,
				},
			} as any,
			populate,
		});

		if (Array.isArray(byDocumentId) && byDocumentId.length > 0) {
			todo = byDocumentId[0];
		}
	}

	return todo;
};

const validateNoCircularParent = async (todoId: number, candidateParentId: number): Promise<boolean> => {
	let cursorId: number | null = candidateParentId;
	const visited = new Set<number>();

	while (cursorId !== null) {
		if (cursorId === todoId) {
			return false;
		}

		if (visited.has(cursorId)) {
			return false;
		}

		visited.add(cursorId);

		const current = await strapi.entityService.findOne('api::todo.todo', cursorId, {
			populate: {
				parent: true,
			},
		});

		if (!current) {
			break;
		}

		cursorId = getRelationId((current as any).parent);
	}

	return true;
};

const isDebug = process.env.NODE_ENV !== 'production';

const stripUserRelation = <T extends Record<string, unknown>>(todo: T): T => {
	if (!todo || typeof todo !== 'object') {
		return todo;
	}

	const { user: _user, ...rest } = todo as T & { user?: unknown };
	return rest as T;
};

const findOwnedTodoOrFail = async (ctx: any, todoId: string | number, authUserId: number) => {
	const normalized = String(todoId);
	const todo = await resolveTodoByIdentifier(normalized, { user: true });

	if (!todo) {
		ctx.notFound('Todo not found');
		return null;
	}

	if (!checkOwnership(todo, authUserId)) {
		ctx.forbidden('You are not allowed to access this todo');
		return null;
	}

	if (isDebug) {
		strapi.log.info(
			`[todo.resolve] requestIdentifier=${normalized} resolvedId=${todo?.id ?? 'unknown'} resolvedDocumentId=${todo?.documentId ?? 'unknown'} userId=${authUserId}`
		);
	}

	return todo;
};

export default factories.createCoreController('api::todo.todo', () => ({
	async create(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const incomingData = ctx.request.body?.data;
		const safeData = withoutRestrictedFields(incomingData);
		const parentInput = extractParentInput(safeData);

		if ('invalid' in parentInput && parentInput.invalid) {
			return ctx.badRequest('Invalid parent relation payload');
		}

		let resolvedParentId: number | null = null;
		let computedDepth = 0;

		if (parentInput.provided && !('invalid' in parentInput) && parentInput.value !== null) {
			const parentTodo = await resolveTodoByIdentifier(parentInput.value, { user: true });

			if (!parentTodo) {
				return ctx.badRequest('Parent todo not found');
			}

			if (!checkOwnership(parentTodo, authUser.id)) {
				return ctx.forbidden('Parent todo does not belong to the authenticated user');
			}

			resolvedParentId = parentTodo.id;
			computedDepth = (typeof (parentTodo as any).depth === 'number' ? (parentTodo as any).depth : 0) + 1;
		}

		const todo = await strapi.entityService.create('api::todo.todo', {
			data: {
				...(safeData as any),
				parent: resolvedParentId,
				depth: computedDepth,
				user: authUser.id,
			} as any,
		});

		return this.transformResponse(stripUserRelation(todo as Record<string, unknown>));
	},

	async find(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const treeService = strapi.service('api::todo.todo') as {
			findUserTodoTree: (userId: number, options?: { maxLevels?: number }) => Promise<any[]>;
		};

		const maxLevels = 2;
		const treeTodos = await treeService.findUserTodoTree(authUser.id, { maxLevels });
		const sanitizedTodos = treeTodos.map((todo) => stripUserRelation(todo as Record<string, unknown>));

		if (isDebug) {
			strapi.log.info(
				`[todo.find] userId=${authUser.id} tree=true maxLevels=${maxLevels} roots=${sanitizedTodos.length} ids=${sanitizedTodos
					.map((todo: any) => todo?.id)
					.filter((id: unknown) => typeof id === 'number')
					.join(',')}`
			);
		}

		return this.transformResponse(sanitizedTodos, {
			pagination: {
				page: 1,
				pageSize: sanitizedTodos.length,
				pageCount: 1,
				total: sanitizedTodos.length,
			},
		});
	},

	async findOne(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const todo = await findOwnedTodoOrFail(ctx, ctx.params.id, authUser.id);

		if (!todo) {
			return;
		}

		return this.transformResponse(stripUserRelation(todo as Record<string, unknown>));
	},

	async update(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const existingTodo = await findOwnedTodoOrFail(ctx, ctx.params.id, authUser.id);

		if (!existingTodo) {
			return;
		}

		const incomingData = ctx.request.body?.data;
		const safeData = withoutRestrictedFields(incomingData);
		const parentInput = extractParentInput(safeData);

		if ('invalid' in parentInput && parentInput.invalid) {
			return ctx.badRequest('Invalid parent relation payload');
		}

		if (parentInput.provided && !('invalid' in parentInput)) {
			if (parentInput.value === null) {
				(safeData as any).parent = null;
				(safeData as any).depth = 0;
			} else {
				const parentTodo = await resolveTodoByIdentifier(parentInput.value, { user: true, parent: true });

				if (!parentTodo) {
					return ctx.badRequest('Parent todo not found');
				}

				if (!checkOwnership(parentTodo, authUser.id)) {
					return ctx.forbidden('Parent todo does not belong to the authenticated user');
				}

				if (parentTodo.id === existingTodo.id) {
					return ctx.badRequest('A todo cannot be its own parent');
				}

				const isValidHierarchy = await validateNoCircularParent(existingTodo.id, parentTodo.id);

				if (!isValidHierarchy) {
					return ctx.badRequest('Circular parent hierarchy is not allowed');
				}

				(safeData as any).parent = parentTodo.id;
				(safeData as any).depth =
					(typeof (parentTodo as any).depth === 'number' ? (parentTodo as any).depth : 0) + 1;
			}
		}

		const updatedTodo = await strapi.entityService.update('api::todo.todo', existingTodo.id, {
			data: safeData as any,
		});

		return this.transformResponse(stripUserRelation(updatedTodo as Record<string, unknown>));
	},

	async delete(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const existingTodo = await findOwnedTodoOrFail(ctx, ctx.params.id, authUser.id);

		if (!existingTodo) {
			return;
		}

		const children = await strapi.entityService.findMany('api::todo.todo', {
			filters: {
				parent: {
					id: {
						$eq: existingTodo.id,
					},
				},
			} as any,
			fields: ['id'],
			limit: 1,
		});

		if (Array.isArray(children) && children.length > 0) {
			return ctx.badRequest('Cannot delete a todo that still has children. Reassign or remove children first.');
		}

		const deletedTodo = await strapi.entityService.delete('api::todo.todo', existingTodo.id);

		if (isDebug) {
			const verify = await strapi.entityService.findMany('api::todo.todo', {
				filters: {
					id: {
						$eq: existingTodo.id,
					},
					user: {
						id: {
							$eq: authUser.id,
						},
					},
				},
				populate: {
					user: {
						fields: ['id'],
					},
				},
			});

			const remaining = Array.isArray(verify) ? verify.length : 0;
			strapi.log.info(
				`[todo.delete] userId=${authUser.id} todoId=${existingTodo.id} remaining=${remaining}`
			);
		}

		return this.transformResponse(stripUserRelation(deletedTodo as Record<string, unknown>));
	},
}));
