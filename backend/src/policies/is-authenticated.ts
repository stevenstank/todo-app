import type { Core } from '@strapi/strapi';

const isAuthenticated: Core.PolicyHandler = (policyContext, _config, _ctx) => {
  const authUser = (policyContext as any)?.state?.user;

  if (!authUser || typeof authUser.id !== 'number') {
    (policyContext as any)?.unauthorized?.('Authentication required');
    return false;
  }

  return true;
};

export default isAuthenticated;
