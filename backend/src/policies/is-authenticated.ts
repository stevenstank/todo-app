import type { Core } from '@strapi/strapi';

const isAuthenticated: Core.PolicyHandler = (policyContext, _config, _ctx) => {
  return Boolean((policyContext as any)?.state?.user);
};

export default isAuthenticated;
