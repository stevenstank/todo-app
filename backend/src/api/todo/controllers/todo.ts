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

const stripUserRelation = <T extends Record<string, unknown>>(todo: T): T => {
	if (!todo || typeof todo !== 'object') {
		return todo;
	}

	const { user: _user, ...rest } = todo as T & { user?: unknown };
	return rest as T;
};

const findOwnedTodoOrFail = async (ctx: any, todoId: string | number, authUserId: number) => {
	const todo = await strapi.entityService.findOne('api::todo.todo', todoId, {
		populate: { user: true },
	});

	if (!todo) {
		ctx.notFound('Todo not found');
		return null;
	}

	if (getOwnerId(todo) !== authUserId) {
		ctx.forbidden('You are not allowed to access this todo');
		return null;
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

		return this.transformResponse(todo);
	},

	async find(ctx) {
		const authUser = getAuthUser(ctx);

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		// Keep both patterns because relation filtering has been inconsistent in this project.
		const ownershipFilter = {
			$or: [{ user: authUser.id }, { user: { id: authUser.id } }],
		};
		const existingFilters = ctx.query?.filters;

		ctx.query = {
			...ctx.query,
			filters: existingFilters ? { $and: [existingFilters, ownershipFilter] } : ownershipFilter,
		};

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

		return this.transformResponse(updatedTodo);
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
		return this.transformResponse(deletedTodo);
	},
}));
