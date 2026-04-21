export default {
  routes: [
    {
      method: 'POST',
      path: '/ai/generate-todos',
      handler: 'ai.generateTodos',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
  ],
};
