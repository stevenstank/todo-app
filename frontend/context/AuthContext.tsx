'use client';

import { useRouter } from 'next/navigation';
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { UNAUTHORIZED_EVENT } from '@/lib/api';
import { AuthUser, loginApi, logoutApi, registerApi } from '@/lib/auth-api';

type LoginInput = {
	email: string;
	password: string;
};

type RegisterInput = {
	username: string;
	email: string;
	password: string;
};

type AuthContextValue = {
	user: AuthUser;
	jwt: string | null;
	isAuthenticated: boolean;
	loading: boolean;
	login: (input: LoginInput) => Promise<void>;
	register: (input: RegisterInput) => Promise<void>;
	logout: () => Promise<void>;
	loadUserFromStorage: () => void;
};

const TOKEN_STORAGE_KEY = 'token';
const JWT_STORAGE_KEY = 'jwt';
const USER_STORAGE_KEY = 'auth_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseStoredUser = (value: string | null): AuthUser => {
	if (!value) {
		return null;
	}

	try {
		const parsed = JSON.parse(value) as AuthUser;
		return parsed;
	} catch {
		return null;
	}
};

const writeTokenCookie = (token: string) => {
	document.cookie = `token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
};

const clearTokenCookie = () => {
	document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
};

const persistAuthState = (nextJwt: string, nextUser: AuthUser) => {
	window.localStorage.setItem(TOKEN_STORAGE_KEY, nextJwt);
	window.localStorage.setItem(JWT_STORAGE_KEY, nextJwt);
	writeTokenCookie(nextJwt);

	if (nextUser) {
		window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
		return;
	}

	window.localStorage.removeItem(USER_STORAGE_KEY);
};

const clearPersistedAuthState = () => {
	window.localStorage.removeItem(TOKEN_STORAGE_KEY);
	window.localStorage.removeItem(JWT_STORAGE_KEY);
	window.localStorage.removeItem(USER_STORAGE_KEY);
	clearTokenCookie();
};

export function AuthProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [user, setUser] = useState<AuthUser>(null);
	const [jwt, setJwt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const loadUserFromStorage = useCallback(() => {
		setLoading(true);

		const storedJwt = window.localStorage.getItem(TOKEN_STORAGE_KEY);
		const compatJwt = window.localStorage.getItem(JWT_STORAGE_KEY);
		const storedUser = parseStoredUser(window.localStorage.getItem(USER_STORAGE_KEY));
		const resolvedJwt = storedJwt ?? compatJwt;

		if (!resolvedJwt) {
			setJwt(null);
			setUser(null);
			setLoading(false);
			return;
		}

		window.localStorage.setItem(TOKEN_STORAGE_KEY, resolvedJwt);
		window.localStorage.setItem(JWT_STORAGE_KEY, resolvedJwt);
		setJwt(resolvedJwt);
		setUser(storedUser);
		setLoading(false);
	}, []);

	const login = useCallback(async (input: LoginInput) => {
		const session = await loginApi(input);
		persistAuthState(session.jwt, session.user);
		setJwt(session.jwt);
		setUser(session.user);
	}, []);

	const register = useCallback(async (input: RegisterInput) => {
		const session = await registerApi(input);
		persistAuthState(session.jwt, session.user);
		setJwt(session.jwt);
		setUser(session.user);
	}, []);

	const logout = useCallback(async () => {
		await logoutApi().catch(() => null);
		clearPersistedAuthState();
		setJwt(null);
		setUser(null);
		router.replace('/signin');
	}, [router]);

	useEffect(() => {
		loadUserFromStorage();
	}, [loadUserFromStorage]);

	useEffect(() => {
		const handleUnauthorized = () => {
			logout();
		};

		window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);

		return () => {
			window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
		};
	}, [logout]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			jwt,
			isAuthenticated: Boolean(jwt),
			loading,
			login,
			register,
			logout,
			loadUserFromStorage,
		}),
		[user, jwt, loading, login, register, logout, loadUserFromStorage]
	);

	if (loading) {
		return (
			<AuthContext.Provider value={value}>
				<div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</div>
			</AuthContext.Provider>
		);
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}

	return context;
};
