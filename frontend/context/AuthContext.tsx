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

type AuthUser = Record<string, unknown> | null;

type AuthContextValue = {
	user: AuthUser;
	jwt: string | null;
	loading: boolean;
	login: (nextJwt: string, nextUser: AuthUser) => void;
	logout: () => void;
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

	const login = useCallback((nextJwt: string, nextUser: AuthUser) => {
		window.localStorage.setItem(TOKEN_STORAGE_KEY, nextJwt);
		window.localStorage.setItem(JWT_STORAGE_KEY, nextJwt);
		writeTokenCookie(nextJwt);

		if (nextUser) {
			window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
		} else {
			window.localStorage.removeItem(USER_STORAGE_KEY);
		}

		setJwt(nextJwt);
		setUser(nextUser);
	}, []);

	const logout = useCallback(() => {
		window.localStorage.removeItem(TOKEN_STORAGE_KEY);
		window.localStorage.removeItem(JWT_STORAGE_KEY);
		window.localStorage.removeItem(USER_STORAGE_KEY);
		clearTokenCookie();
		setJwt(null);
		setUser(null);
		router.replace('/login');
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
			loading,
			login,
			logout,
			loadUserFromStorage,
		}),
		[user, jwt, loading, login, logout, loadUserFromStorage]
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
