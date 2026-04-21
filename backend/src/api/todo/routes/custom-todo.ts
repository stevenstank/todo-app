export default {
  routes: [
    {
      method: 'GET',
      path: '/todos/assignable-users',
      handler: 'todo.listAssignableUsers',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
  ],
};
