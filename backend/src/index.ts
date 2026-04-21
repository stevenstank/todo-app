import type { Core } from '@strapi/strapi';

const AUTHENTICATED_TODO_ACTIONS = [
  'api::todo.todo.find',
  'api::todo.todo.findOne',
  'api::todo.todo.create',
  'api::todo.todo.update',
  'api::todo.todo.delete',
  'api::ai.ai.generateTodos',
] as const;

const parseBackfillUserId = (): number | null => {
  const rawUserId = process.env.TODO_BACKFILL_USER_ID;

  if (!rawUserId) {
    return null;
  }

  const parsedUserId = Number(rawUserId);
  return Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.server.routes([
      {
        method: 'GET',
        path: '/api',
        handler(ctx) {
          ctx.body = {
            status: 'ok',
            message: 'Strapi API is running',
          };
        },
        config: { auth: false },
      },
    ]);
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const roleQuery = strapi.db.query('plugin::users-permissions.role');
    const permissionQuery = strapi.db.query('plugin::users-permissions.permission');

    const authenticatedRole = await roleQuery.findOne({
      where: { type: 'authenticated' },
    });

    if (!authenticatedRole) {
      strapi.log.warn('Authenticated role not found, skipping todo permission bootstrap.');
      return;
    }

    for (const action of AUTHENTICATED_TODO_ACTIONS) {
      const existing = await permissionQuery.findOne({
        where: {
          role: authenticatedRole.id,
          action,
        },
      });

      if (!existing) {
        await permissionQuery.create({
          data: {
            action,
            role: authenticatedRole.id,
            enabled: true,
          },
        });

        continue;
      }

      if (!existing.enabled) {
        await permissionQuery.update({
          where: { id: existing.id },
          data: { enabled: true },
        });
      }
    }

    const backfillUserId = parseBackfillUserId();

    if (!backfillUserId) {
      return;
    }

    const orphanTodos = (await strapi.entityService.findMany('api::todo.todo', {
      filters: {
        user: {
          id: {
            $null: true,
          },
        },
      },
      fields: ['id'],
      limit: 10000,
    })) as Array<{ id: number }>;

    for (const todo of orphanTodos) {
      await strapi.entityService.update('api::todo.todo', todo.id, {
        data: {
          user: backfillUserId,
        },
      });
    }

    strapi.log.info(
      `Backfilled ${orphanTodos.length} orphan todos with user ${backfillUserId}.`
    );
  },
};
