/**
 * todo service
 */

import { factories } from '@strapi/strapi';

type RawTodo = {
	id: number;
	title?: string;
	completed?: boolean;
	isCompleted?: boolean;
	depth?: number;
	parent?: unknown;
	children?: unknown[];
	assignedUser?: unknown;
	[key: string]: unknown;
};

type TreeTodo = {
	id: number;
	title?: string;
	completed?: boolean;
	isCompleted?: boolean;
	depth?: number;
	assignedUser: {
		id: number;
		username: string;
		avatarUrl: string | null;
	} | null;
	parentId: number | null;
	children: TreeTodo[];
};

type TreeOptions = {
	maxLevels?: number;
	titleContains?: string;
	completed?: boolean;
};

const getRelationId = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isInteger(value)) {
		return value;
	}

	if (value && typeof value === 'object' && typeof (value as any).id === 'number') {
		return (value as any).id;
	}

	return null;
};

const toPublicAssignedUser = (value: unknown): TreeTodo['assignedUser'] => {
	if (!value || typeof value !== 'object') {
		return null;
	}

	const user = value as Record<string, unknown>;
	const id = typeof user.id === 'number' ? user.id : null;
	const username = typeof user.username === 'string' && user.username.trim().length > 0 ? user.username : null;

	if (id === null || username === null) {
		return null;
	}

	const avatarRaw = (user as any).avatar;
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

const clampMaxLevels = (value: unknown): number => {
	const DEFAULT_MAX = 2;

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_MAX;
	}

	const parsed = Math.floor(value);

	if (parsed < 0) {
		return 0;
	}

	return Math.min(parsed, DEFAULT_MAX);
};

const pruneToMaxLevels = (roots: TreeTodo[], maxLevels: number): TreeTodo[] => {
	const cloneNode = (node: TreeTodo, level: number): TreeTodo => {
		const { children, ...rest } = node;

		if (level >= maxLevels) {
			return {
				...rest,
				children: [],
			};
		}

		return {
			...rest,
			children: children.map((child) => cloneNode(child, level + 1)),
		};
	};

	return roots.map((root) => cloneNode(root, 0));
};

export default factories.createCoreService('api::todo.todo', () => ({
	async findUserTodoTree(userId: number, options: TreeOptions = {}): Promise<TreeTodo[]> {
		const maxLevels = clampMaxLevels(options.maxLevels);
		const titleContains =
			typeof options.titleContains === 'string' ? options.titleContains.trim() : '';
		const hasTitleFilter = titleContains.length > 0;
		const hasCompletedFilter = typeof options.completed === 'boolean';

		const filters: Record<string, unknown> = {
			user: {
				id: {
					$eq: userId,
				},
			},
		};

		if (hasTitleFilter) {
			filters.title = {
				$containsi: titleContains,
			};
		}

		if (hasCompletedFilter) {
			filters.completed = {
				$eq: options.completed,
			};
		}

		const records = await strapi.entityService.findMany('api::todo.todo', {
			filters: filters as any,
			populate: {
				parent: {
					fields: ['id'],
				},
				children: {
					fields: ['id'],
				},
				assignedUser: {
					fields: ['id', 'username'],
				},
			},
		});

		const todos = (Array.isArray(records) ? records : []) as RawTodo[];
		const todoMap = new Map<number, TreeTodo>();

		for (const todo of todos) {
			const parentId = getRelationId(todo.parent ?? null);
			const completion =
				typeof todo.completed === 'boolean'
					? todo.completed
					: typeof todo.isCompleted === 'boolean'
						? todo.isCompleted
						: undefined;

			todoMap.set(todo.id, {
				id: todo.id,
				title: typeof todo.title === 'string' ? todo.title : undefined,
				completed: completion,
				isCompleted: completion,
				depth: typeof todo.depth === 'number' ? todo.depth : undefined,
				assignedUser: toPublicAssignedUser(todo.assignedUser ?? null),
				parentId,
				children: [],
			});
		}

		const roots: TreeTodo[] = [];

		for (const todo of todoMap.values()) {
			if (todo.parentId === null) {
				roots.push(todo);
				continue;
			}

			const parent = todoMap.get(todo.parentId);

			if (!parent) {
				roots.push(todo);
				continue;
			}

			parent.children.push(todo);
		}

		if (process.env.NODE_ENV !== 'production') {
			strapi.log.info(
				`[todo.tree] userId=${userId} total=${todos.length} roots=${roots.length} maxLevels=${maxLevels} titleFilter=${hasTitleFilter} completedFilter=${hasCompletedFilter} queries=1`
			);
		}

		return pruneToMaxLevels(roots, maxLevels);
	},
}));
