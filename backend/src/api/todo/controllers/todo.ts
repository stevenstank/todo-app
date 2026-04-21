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

const extractAssignedUserInput = (data: Record<string, unknown>): ExtractedIdentifier =>
	extractIdentifierInput('assignedUser', data);

const parseUserId = (identifier: number | string): number | null => {
	if (typeof identifier === 'number' && Number.isInteger(identifier)) {
		return identifier;
	}

	if (typeof identifier !== 'string') {
		return null;
	}

	const trimmed = identifier.trim();

	if (!/^\d+$/.test(trimmed)) {
		return null;
	}

	const numeric = Number(trimmed);
	return Number.isInteger(numeric) ? numeric : null;
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

const resolveUserByIdentifier = async (
	identifier: number | string,
	populate: Record<string, unknown> = {}
) => {
	const userId = parseUserId(identifier);

	if (userId === null) {
		return null;
	}

	return strapi.entityService.findOne('plugin::users-permissions.user', userId, {
		populate,
	});
};

const hasUserSystemAttribute = (): boolean => {
	const userModel = strapi.contentTypes['plugin::users-permissions.user'];
	const attributes = (userModel?.attributes ?? {}) as Record<string, unknown>;
	return hasOwn(attributes, 'system');
};

const getSystemId = (user: any): number | null => getRelationId(user?.system ?? null);

const sanitizeAssignedUser = (value: unknown): { id: number; username: string; avatarUrl: string | null } | null => {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const user = value as Record<string, unknown>;
	const id = typeof user.id === 'number' ? user.id : null;
	const username = typeof user.username === 'string' && user.username.trim().length > 0 ? user.username : null;

	if (id === null || username === null) {
		return null;
	}

	const avatarRaw = (user as any)?.avatar;
	const avatarUrl =
		typeof avatarRaw?.url === 'string'
			? avatarRaw.url
			: typeof avatarRaw === 'string'
				? avatarRaw
				: null;

	return {
		id,
		username,
		avatarUrl,
	};
};

const sanitizeTodoForResponse = <T extends Record<string, unknown>>(todo: T): T => {
	if (!todo || typeof todo !== 'object') {
		return todo;
	}

	const { user: _owner, ...rest } = todo as T & {
		user?: unknown;
		assignedUser?: unknown;
	};

	if (!hasOwn(rest as Record<string, unknown>, 'assignedUser')) {
		return rest as T;
	}

	const normalizedAssignedUser = sanitizeAssignedUser((rest as any).assignedUser);

	return {
		...rest,
		assignedUser: normalizedAssignedUser,
	} as T;
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

const isDebug = process.env.NODE_ENV !== 'production';

const findOwnedTodoOrFail = async (ctx: any, todoId: string | number, authUserId: number) => {
	const normalized = String(todoId);
	const todo = await resolveTodoByIdentifier(normalized, { user: true, assignedUser: true } as any);

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

const resolveAssignmentForRequest = async (
	ctx: any,
	authUserId: number,
	assignmentInput: ExtractedIdentifier
): Promise<{ provided: boolean; assignedUserId: number | null } | null> => {
	if (!assignmentInput.provided) {
		return { provided: false, assignedUserId: null };
	}

	if ('invalid' in assignmentInput && assignmentInput.invalid) {
		ctx.badRequest('Invalid assignedUser relation payload');
		return null;
	}

	if (!('value' in assignmentInput)) {
		ctx.badRequest('Invalid assignedUser relation payload');
		return null;
	}

	const assignmentValue = assignmentInput.value;

	if (assignmentValue === null) {
		return { provided: true, assignedUserId: null };
	}

	const populateSystem = hasUserSystemAttribute() ? { system: true } : {};
	const assignedUser = await resolveUserByIdentifier(assignmentValue, populateSystem as any);

	if (!assignedUser) {
		ctx.badRequest('Assigned user not found');
		return null;
	}

	if (hasUserSystemAttribute()) {
		const authUser = await strapi.entityService.findOne('plugin::users-permissions.user', authUserId, {
			populate: {
				system: true,
			} as any,
		});

		if (!authUser) {
			ctx.unauthorized('Authentication required');
			return null;
		}

		const ownerSystemId = getSystemId(authUser);
		const assigneeSystemId = getSystemId(assignedUser);

		if (
			ownerSystemId === null ||
			assigneeSystemId === null ||
			ownerSystemId !== assigneeSystemId
		) {
			ctx.forbidden('Assigned user must belong to the same system');
			return null;
		}
	}

	const assignedUserId =
		typeof assignedUser.id === 'number' ? assignedUser.id : Number(assignedUser.id);

	if (!Number.isInteger(assignedUserId)) {
		ctx.badRequest('Assigned user not found');
		return null;
	}

	return {
		provided: true,
		assignedUserId,
	};
};

const toAssignableUser = (user: any) => ({
	id: user.id,
	username: typeof user.username === 'string' ? user.username : `User ${user.id}`,
	avatarUrl: null,
});

export default factories.createCoreController('api::todo.todo', () => ({
	async listAssignableUsers(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const enforceSameSystem = hasUserSystemAttribute();
		let systemFilter: Record<string, unknown> | null = null;

		if (enforceSameSystem) {
			const owner = await strapi.entityService.findOne('plugin::users-permissions.user', authUser.id, {
				populate: {
					system: true,
				} as any,
			});

			const ownerSystemId = getSystemId(owner);

			if (ownerSystemId !== null) {
				systemFilter = {
					system: {
						id: {
							$eq: ownerSystemId,
						},
					},
				};
			}
		}

		const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
			filters: {
				...(systemFilter ?? {}),
				blocked: {
					$eq: false,
				},
			} as any,
			fields: ['id', 'username'],
			sort: ['username:asc'],
		});

		const mapped = (Array.isArray(users) ? users : []).map(toAssignableUser);
		return ctx.send({ data: mapped });
	},

	async create(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const incomingData = ctx.request.body?.data;
		const safeData = syncCompletionFields(withoutRestrictedFields(incomingData));
		const parentInput = extractParentInput(safeData);
		const assignedUserInput = extractAssignedUserInput(safeData);

		if ('invalid' in parentInput && parentInput.invalid) {
			return ctx.badRequest('Invalid parent relation payload');
		}

		const assignmentResolution = await resolveAssignmentForRequest(ctx, authUser.id, assignedUserInput);

		if (!assignmentResolution) {
			return;
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

		if (assignmentResolution.provided) {
			(safeData as any).assignedUser = assignmentResolution.assignedUserId;
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
			populate: {
				assignedUser: true,
			} as any,
		});

		return this.transformResponse(sanitizeTodoForResponse(todo as Record<string, unknown>));
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
		const sanitizedTodos = treeTodos.map((todo) => sanitizeTodoForResponse(todo as Record<string, unknown>));

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
		const parentInput = extractParentInput(safeData);
		const assignedUserInput = extractAssignedUserInput(safeData);
		const existingWithParent = await strapi.entityService.findOne('api::todo.todo', existingTodo.id, {
			populate: {
				parent: true,
			},
		});
		const previousParentId = getRelationId((existingWithParent as any)?.parent ?? null);

		if ('invalid' in parentInput && parentInput.invalid) {
			return ctx.badRequest('Invalid parent relation payload');
		}

		const assignmentResolution = await resolveAssignmentForRequest(ctx, authUser.id, assignedUserInput);

		if (!assignmentResolution) {
			return;
		}

		if (assignmentResolution.provided) {
			(safeData as any).assignedUser = assignmentResolution.assignedUserId;
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
			populate: {
				assignedUser: true,
			} as any,
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

		return this.transformResponse(sanitizeTodoForResponse(deletedTodo as Record<string, unknown>));
	},
}));
