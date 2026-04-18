'use client';

import { FormEvent, useEffect, useState } from 'react';

const STRAPI_URL = 'http://localhost:1337';
const TOKEN_KEY = 'jwt';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jwt, setJwt] = useState('');

  useEffect(() => {
    const storedJwt = window.localStorage.getItem(TOKEN_KEY) ?? '';
    setJwt(storedJwt);
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: email,
        password,
      }),
    });

    const data = await response.json();
    console.log('Login response:', data);

    if (response.ok && data.jwt) {
      window.localStorage.setItem(TOKEN_KEY, data.jwt);
      setJwt(data.jwt);
    }
  };

  const fetchTodos = async () => {
    const response = await fetch(`${STRAPI_URL}/api/todos`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    const data = await response.json();
    console.log('Fetch todos response:', data);
  };

  const createTodo = async () => {
    const response = await fetch(`${STRAPI_URL}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        data: {
          title: `Todo ${new Date().toISOString()}`,
          isCompleted: false,
        },
      }),
    });

    const data = await response.json();
    console.log('Create todo response:', data);
  };

  return (
    <main>
      <h1>Todo Auth App</h1>

      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button type="submit">Login</button>
      </form>

      <p>JWT stored: {jwt ? 'Yes' : 'No'}</p>

      <button type="button" onClick={fetchTodos}>
        Fetch Todos
      </button>

      <button type="button" onClick={createTodo}>
        Create Todo
      </button>
    </main>
  );
}
