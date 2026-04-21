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

const withoutUserField = (data: unknown): Record<string, unknown> => {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return {};
	}

	const { user: _ignoredUser, ...safeData } = data as Record<string, unknown>;
	return safeData;
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
	const numericCandidate = Number(normalized);

	let todo: any = null;

	if (Number.isInteger(numericCandidate) && normalized === String(numericCandidate)) {
		todo = await strapi.entityService.findOne('api::todo.todo', numericCandidate, {
			populate: { user: true },
		});
	}

	if (!todo) {
		const byDocumentId = await strapi.entityService.findMany('api::todo.todo', {
			filters: {
				documentId: {
					$eq: normalized,
				},
			} as any,
			populate: { user: true },
		});

		if (Array.isArray(byDocumentId) && byDocumentId.length > 0) {
			todo = byDocumentId[0];
		}
	}

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
		const safeData = withoutUserField(incomingData);

		const todo = await strapi.entityService.create('api::todo.todo', {
			data: {
				...(safeData as any),
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

		const incomingFilters = ctx.query?.filters;
		const ownershipFilter = {
			user: {
				id: authUser.id,
			},
		};

		ctx.query = {
			...ctx.query,
			filters: ownershipFilter,
		};

		if (isDebug) {
			strapi.log.info(
				`[todo.find.filters] userId=${authUser.id} incoming=${JSON.stringify(incomingFilters ?? null)} applied=${JSON.stringify(ownershipFilter)}`
			);
		}

		const sanitizedQuery = await this.sanitizeQuery(ctx);
		const results = await strapi.entityService.findMany('api::todo.todo', {
			...sanitizedQuery,
			populate: {
				...(typeof sanitizedQuery.populate === 'object' && sanitizedQuery.populate
					? sanitizedQuery.populate
					: {}),
				user: {
					fields: ['id'],
				},
			},
		});

		const todos = Array.isArray(results) ? results : [];

		// Defense in depth: verify ownership after query to prevent cross-user leakage.
		const ownedTodos = todos.filter((todo) => getOwnerId(todo) === authUser.id);
		const sanitizedTodos = ownedTodos.map((todo) => stripUserRelation(todo as Record<string, unknown>));

		if (isDebug) {
			strapi.log.info(
				`[todo.find] userId=${authUser.id} total=${sanitizedTodos.length} ids=${sanitizedTodos
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
		const safeData = withoutUserField(incomingData);

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
