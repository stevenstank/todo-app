/**
 * todo controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::todo.todo', () => ({
	async create(ctx) {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		ctx.request.body = ctx.request.body ?? {};
		ctx.request.body.data = ctx.request.body.data ?? {};
		ctx.request.body.data.user = authUser.id;

		const incomingData = ctx.request.body.data;
		const { user: _ignoredUser, ...safeData } = incomingData;

		const todo = await strapi.entityService.create('api::todo.todo', {
			data: {
				...safeData,
				user: authUser.id,
			},
		});

		return this.transformResponse(todo);
	},

	async find(ctx) {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const ownershipFilter = {
			user: {
				id: authUser.id,
			},
		};

		const existingFilters = ctx.query?.filters;

		ctx.query = {
			...ctx.query,
			filters: existingFilters
			? {
					$and: [existingFilters, ownershipFilter],
			  }
			: ownershipFilter,
		};

		const sanitizedQuery = await this.sanitizeQuery(ctx);
		const mergedFilters = sanitizedQuery.filters;

		const todos = await strapi.entityService.findMany('api::todo.todo', {
			...sanitizedQuery,
			filters: mergedFilters,
			populate: {
				...(typeof sanitizedQuery.populate === 'object' && sanitizedQuery.populate
					? sanitizedQuery.populate
					: {}),
				user: true,
			},
		});

		const ownedTodos = (Array.isArray(todos) ? todos : []).filter((todo: any) => {
			const todoOwnerId =
				typeof todo?.user === 'object' && todo.user ? todo.user.id : todo?.user;

			return todoOwnerId === authUser.id;
		});

		const total = ownedTodos.length;

		const pagination = {
			page: 1,
			pageSize: ownedTodos.length,
			pageCount: 1,
			total,
		};

		return this.transformResponse(ownedTodos, { pagination });
	},

	async findOne(ctx) {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const todoId = ctx.params.id;
		const existingTodo = (await strapi.entityService.findOne('api::todo.todo', todoId, {
			populate: {
				user: true,
			},
		})) as any;

		if (!existingTodo) {
			return ctx.notFound('Todo not found');
		}

		const todoOwnerId =
			typeof existingTodo?.user === 'object' && existingTodo.user
				? existingTodo.user.id
				: existingTodo?.user;

		if (todoOwnerId !== authUser.id) {
			return ctx.forbidden('Not your todo');
		}

		return this.transformResponse(existingTodo);
	},

	async update(ctx) {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const todoId = ctx.params.id;
		const existingTodo = (await strapi.entityService.findOne('api::todo.todo', todoId, {
			populate: {
				user: true,
			},
		})) as any;

		if (!existingTodo) {
			return ctx.notFound('Todo not found');
		}

		const todoOwnerId =
			typeof existingTodo?.user === 'object' && existingTodo.user
				? existingTodo.user.id
				: existingTodo?.user;

		if (todoOwnerId !== authUser.id) {
			return ctx.forbidden('Not your todo');
		}

		const incomingData = ctx.request.body?.data ?? {};
		const { user: _ignoredUser, ...safeData } = incomingData;

		const updatedTodo = await strapi.entityService.update('api::todo.todo', todoId, {
			data: safeData,
		});

		return this.transformResponse(updatedTodo);
	},

	async delete(ctx) {
		const authUser = ctx.state.user;

		if (!authUser) {
			return ctx.unauthorized('Authentication required');
		}

		const todoId = ctx.params.id;
		const existingTodo = (await strapi.entityService.findOne('api::todo.todo', todoId, {
			populate: {
				user: true,
			},
		})) as any;

		if (!existingTodo) {
			return ctx.notFound('Todo not found');
		}

		const todoOwnerId =
			typeof existingTodo?.user === 'object' && existingTodo.user
				? existingTodo.user.id
				: existingTodo?.user;

		if (todoOwnerId !== authUser.id) {
			return ctx.forbidden('Not your todo');
		}

		const deletedTodo = await strapi.entityService.delete('api::todo.todo', todoId);

		return this.transformResponse(deletedTodo);
	},
}));
