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

		const incomingData = ctx.request.body?.data ?? {};
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

		const sanitizedQuery = await this.sanitizeQuery(ctx);

		const ownershipFilter = {
			user: {
				id: {
					$eq: authUser.id,
				},
			},
		};

		const mergedFilters = sanitizedQuery.filters
			? {
					$and: [sanitizedQuery.filters, ownershipFilter],
			  }
			: ownershipFilter;

		const todos = await strapi.entityService.findMany('api::todo.todo', {
			...sanitizedQuery,
			filters: mergedFilters,
		});

		const total = await strapi.entityService.count('api::todo.todo', {
			filters: mergedFilters,
		});

		const pagination = {
			page: 1,
			pageSize: Array.isArray(todos) ? todos.length : 0,
			pageCount: 1,
			total,
		};

		return this.transformResponse(todos, { pagination });
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
			return ctx.forbidden('You cannot update this todo');
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
			return ctx.forbidden('You cannot delete this todo');
		}

		const deletedTodo = await strapi.entityService.delete('api::todo.todo', todoId);

		return this.transformResponse(deletedTodo);
	},
}));
