import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseClient';

export interface RequireAuthOptions {
    redirectTo?: string;
    requireAdmin?: boolean;
    adminEmail?: string;
}

export function waitForUser(): Promise<User | null> {
    if (!auth || typeof window === 'undefined') {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

export function isAdmin(user: User | null, adminEmail = import.meta.env.PUBLIC_ADMIN_EMAIL): boolean {
    if (!user || !adminEmail) return false;
    return (user.email || '').toLowerCase() === adminEmail.toLowerCase();
}

export async function requireAuth(options: RequireAuthOptions = {}): Promise<User | null> {
    const { redirectTo = '/login', requireAdmin = false, adminEmail } = options;
    if (typeof window === 'undefined') return null;

    const user = await waitForUser();

    if (!user) {
        if (redirectTo) window.location.href = redirectTo;
        return null;
    }

    if (requireAdmin && !isAdmin(user, adminEmail)) {
        if (redirectTo) window.location.href = redirectTo;
        return null;
    }

    return user;
}

export async function logout() {
    if (!auth) return;
    await signOut(auth);
}

