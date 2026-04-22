/**
 * todo controller
 */

import { factories } from '@strapi/strapi';

type AuthUser = { id: number };

type ExtractedIdentifier =
	| { provided: false }
	| { provided: true; value: number | string | null }
	| { provided: true; invalid: true };

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

const getTodoCompleted = (todo: any): boolean =>
	Boolean(
		todo?.completed ??
		todo?.isCompleted ??
		todo?.attributes?.completed ??
		todo?.attributes?.isCompleted
	);

const syncCompletionFields = (data: Record<string, unknown>): Record<string, unknown> => {
	if (hasOwn(data, 'completed') && typeof data.completed === 'boolean') {
		return {
			...data,
			isCompleted: data.completed,
		};
	}

	if (hasOwn(data, 'isCompleted') && typeof data.isCompleted === 'boolean') {
		return {
			...data,
			completed: data.isCompleted,
		};
	}

	return data;
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

const extractIdentifierInput = (field: string, data: Record<string, unknown>): ExtractedIdentifier => {
	if (!hasOwn(data, field)) {
		return { provided: false };
	}

	const rawValue = data[field];

	if (rawValue === null) {
		return { provided: true, value: null };
	}

	const identifier = parseIdentifier(rawValue);

	if (identifier === null) {
		return { provided: true, invalid: true };
	}

	return { provided: true, value: identifier };
};

const extractParentInput = (data: Record<string, unknown>): ExtractedIdentifier =>
	extractIdentifierInput('parent', data);

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

const sanitizeTodoForResponse = <T extends Record<string, unknown>>(todo: T): T => {
	if (!todo || typeof todo !== 'object') {
		return todo;
	}

	const { user: _owner, ...rest } = todo as T & { user?: unknown };

	return rest as T;
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

const recomputeParentCompletion = async (parentId: number, userId: number, visited = new Set<number>()) => {
	if (visited.has(parentId)) {
		return;
	}

	visited.add(parentId);

	const parent = await strapi.entityService.findOne('api::todo.todo', parentId, {
		populate: {
			parent: true,
			user: true,
		},
	});

	if (!parent || !checkOwnership(parent, userId)) {
		return;
	}

	const siblings = await strapi.entityService.findMany('api::todo.todo', {
		filters: {
			parent: {
				id: {
					$eq: parentId,
				},
			},
			user: {
				id: {
					$eq: userId,
				},
			},
		} as any,
		fields: ['id', 'completed', 'isCompleted'],
	});

	const childTodos = Array.isArray(siblings) ? siblings : [];
	const nextCompleted = childTodos.length > 0 && childTodos.every((child) => getTodoCompleted(child));

	if (getTodoCompleted(parent) !== nextCompleted) {
		await strapi.entityService.update('api::todo.todo', parentId, {
			data: {
				completed: nextCompleted,
				isCompleted: nextCompleted,
			} as any,
		});
	}

	const ancestorId = getRelationId((parent as any).parent);

	if (ancestorId !== null) {
		await recomputeParentCompletion(ancestorId, userId, visited);
	}
};

const getOwnedChildrenCompletionSummary = async (
	parentId: number,
	userId: number
): Promise<{ total: number; completed: number; allCompleted: boolean }> => {
	const children = await strapi.entityService.findMany('api::todo.todo', {
		filters: {
			parent: {
				id: {
					$eq: parentId,
				},
			},
			user: {
				id: {
					$eq: userId,
				},
			},
		} as any,
		fields: ['id', 'completed', 'isCompleted'],
	});

	const childTodos = Array.isArray(children) ? children : [];
	const total = childTodos.length;
	const completed = childTodos.filter((child) => getTodoCompleted(child)).length;

	return {
		total,
		completed,
		allCompleted: total > 0 && completed === total,
	};
};

const isDebug = process.env.NODE_ENV !== 'production';

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

const parseCompletedFilter = (
	value: unknown
): { provided: false } | { provided: true; value: boolean } | { provided: true; invalid: true } => {
	if (value === undefined || value === null || value === '') {
		return { provided: false };
	}

	if (typeof value === 'boolean') {
		return { provided: true, value };
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();

		if (normalized === 'true') {
			return { provided: true, value: true };
		}

		if (normalized === 'false') {
			return { provided: true, value: false };
		}
	}

	return { provided: true, invalid: true };
};

const listOwnedDirectChildren = async (parentId: number, userId: number): Promise<Array<{ id: number }>> => {
	const children = await strapi.entityService.findMany('api::todo.todo', {
		filters: {
			parent: {
				id: {
					$eq: parentId,
				},
			},
			user: {
				id: {
					$eq: userId,
				},
			},
		} as any,
		fields: ['id'],
	});

	return (Array.isArray(children) ? children : []) as Array<{ id: number }>;
};

const collectDeleteOrderIds = async (
	todoId: number,
	userId: number,
	visited = new Set<number>()
): Promise<number[]> => {
	if (visited.has(todoId)) {
		return [];
	}

	visited.add(todoId);

	const children = await listOwnedDirectChildren(todoId, userId);
	const ordered: number[] = [];

	for (const child of children) {
		ordered.push(...(await collectDeleteOrderIds(child.id, userId, visited)));
	}

	ordered.push(todoId);
	return ordered;
};

const deleteTodoIds = async (todoIds: number[]) => {
  for (const todoId of todoIds) {
    await strapi.entityService.delete('api::todo.todo', todoId);
  }
};

const validateTitleLength = (
	ctx: any,
	data: Record<string, unknown>,
	options: { required: boolean }
): boolean => {
	if (!hasOwn(data, 'title')) {
		return !options.required;
	}

	if (typeof data.title !== 'string') {
		ctx.badRequest('Title must be a string');
		return false;
	}

	const normalized = data.title.trim();

	if (normalized.length < 3) {
		ctx.badRequest('Title must be at least 3 characters long');
		return false;
	}

	data.title = normalized;
	return true;
};

export default factories.createCoreController('api::todo.todo', () => ({
	async create(ctx) {
		console.log('[todo.create] user:', ctx.state?.user?.id, 'body:', ctx.request.body);
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const incomingData = ctx.request.body?.data;
		const safeData = syncCompletionFields(withoutRestrictedFields(incomingData));
		if (!validateTitleLength(ctx, safeData, { required: true })) {
			return;
		}
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

			// When adding a new subtask under a completed parent, force parent back to incomplete.
			if (getTodoCompleted(parentTodo)) {
				await strapi.entityService.update('api::todo.todo', parentTodo.id, {
					data: {
						completed: false,
						isCompleted: false,
					} as any,
				});
			}

			resolvedParentId = parentTodo.id;
			computedDepth = (typeof (parentTodo as any).depth === 'number' ? (parentTodo as any).depth : 0) + 1;

			// New subtasks must start incomplete, so parent state can be derived correctly.
			(safeData as any).completed = false;
			(safeData as any).isCompleted = false;
		}

		const todo = await strapi.entityService.create('api::todo.todo', {
			data: {
				...(safeData as any),
				completed: hasOwn(safeData, 'completed') ? (safeData.completed as any) : false,
				isCompleted: hasOwn(safeData, 'isCompleted') ? (safeData.isCompleted as any) : false,
				parent: resolvedParentId,
				depth: computedDepth,
				user: authUser.id,
			} as any,
		});

		if (resolvedParentId !== null) {
			await recomputeParentCompletion(resolvedParentId, authUser.id);
		}

		if (isDebug) {
			strapi.log.info('[todo.create] created todo:', JSON.stringify(todo));
			strapi.log.info(
				`[todo.subtask.create] parentId=${resolvedParentId} createdSubtaskId=${(todo as any)?.id ?? 'unknown'} title=${(todo as any)?.title ?? 'unknown'}`
			);
		}
		return this.transformResponse(sanitizeTodoForResponse(todo as Record<string, unknown>));
	},

	async find(ctx) {
		// Removed problematic log statement to fix syntax error
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const treeService = strapi.service('api::todo.todo') as {
			findUserTodoTree: (
				userId: number,
				options?: { maxLevels?: number; titleContains?: string; completed?: boolean }
			) => Promise<any[]>;
		};

		const maxLevels = 20;
		const rawTitleFilter = (ctx.query as any)?.filters?.title?.$containsi;
		const titleContains = typeof rawTitleFilter === 'string' ? rawTitleFilter.trim() : '';
		const completedCandidate = parseCompletedFilter((ctx.query as any)?.filters?.completed?.$eq);

		if ('invalid' in completedCandidate && completedCandidate.invalid) {
			return ctx.badRequest('Invalid completed filter value. Use true or false.');
		}

		const completedFilterValue =
			completedCandidate.provided && 'value' in completedCandidate
				? completedCandidate.value
				: undefined;

		const treeTodos = await treeService.findUserTodoTree(authUser.id, {
			maxLevels,
			titleContains,
			...(typeof completedFilterValue === 'boolean' ? { completed: completedFilterValue } : {}),
		});
		const sanitizedTodos = treeTodos.map((todo) => sanitizeTodoForResponse(todo as Record<string, unknown>));

		if (isDebug) {
			strapi.log.info(
				`[todo.find] userId=${authUser.id} tree=true maxLevels=${maxLevels} titleContains=${titleContains ? `"${titleContains}"` : 'none'} completedFilter=${typeof completedFilterValue === 'boolean' ? String(completedFilterValue) : 'none'} roots=${sanitizedTodos.length} ids=${sanitizedTodos
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

		return this.transformResponse(sanitizeTodoForResponse(todo as Record<string, unknown>));
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
		const safeData = syncCompletionFields(withoutRestrictedFields(incomingData));
		if (!validateTitleLength(ctx, safeData, { required: false })) {
			return;
		}
		const parentInput = extractParentInput(safeData);
		const existingWithParent = await strapi.entityService.findOne('api::todo.todo', existingTodo.id, {
			populate: {
				parent: true,
			},
		});
		const previousParentId = getRelationId((existingWithParent as any)?.parent ?? null);

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

		const childSummary = await getOwnedChildrenCompletionSummary(existingTodo.id, authUser.id);

		// Parent completion is always derived from children when children exist.
		if (childSummary.total > 0) {
			(safeData as any).completed = childSummary.allCompleted;
			(safeData as any).isCompleted = childSummary.allCompleted;
		}

		const updatedTodo = await strapi.entityService.update('api::todo.todo', existingTodo.id, {
			data: safeData as any,
		});

		const updatedWithParent = await strapi.entityService.findOne('api::todo.todo', existingTodo.id, {
			populate: {
				parent: true,
			},
		});

		const nextParentId = getRelationId((updatedWithParent as any)?.parent ?? null);
		const parentsToRecompute = new Set<number>();

		if (previousParentId !== null) {
			parentsToRecompute.add(previousParentId);
		}

		if (nextParentId !== null) {
			parentsToRecompute.add(nextParentId);
		}

		for (const parentId of parentsToRecompute) {
			await recomputeParentCompletion(parentId, authUser.id);
		}

		return this.transformResponse(sanitizeTodoForResponse(updatedTodo as Record<string, unknown>));
	},

	async delete(ctx) {
		console.log('[todo.delete] user:', ctx.state?.user?.id, 'params:', ctx.params);
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const existingTodo = await findOwnedTodoOrFail(ctx, ctx.params.id, authUser.id);

		if (!existingTodo) {
			return;
		}

		const forceDelete = ctx.query.forceDelete === 'true';
		console.log('forceDelete query:', ctx.query.forceDelete);
		const existingWithParent = await strapi.entityService.findOne('api::todo.todo', existingTodo.id, {
			populate: {
				parent: true,
			},
		});
		const previousParentId = getRelationId((existingWithParent as any)?.parent ?? null);

		const children = await listOwnedDirectChildren(existingTodo.id, authUser.id);

		if (children.length > 0 && !forceDelete) {
			return ctx.badRequest('Cannot delete a todo that still has children. Reassign or remove children first.');
		}

		const deleteOrderIds = forceDelete
			? await collectDeleteOrderIds(existingTodo.id, authUser.id)
			: [existingTodo.id];

		await deleteTodoIds(deleteOrderIds);

		if (previousParentId !== null) {
			await recomputeParentCompletion(previousParentId, authUser.id);
		}

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
				`[todo.delete] userId=${authUser.id} todoId=${existingTodo.id} forceDelete=${String(forceDelete)} removed=${deleteOrderIds.length} remaining=${remaining}`
			);
		}

		return this.transformResponse(
			sanitizeTodoForResponse({
				...(existingTodo as Record<string, unknown>),
				deletedIds: deleteOrderIds,
				cascade: forceDelete,
			})
		);
	},
}));
