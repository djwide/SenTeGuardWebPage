import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, firebaseReady } from '../lib/firebaseClient';
import { isAdmin } from '../utils/auth';

export default function AuthNav() {
    const [user, setUser] = useState<User | null>(null);
    const [checking, setChecking] = useState(true);
    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        if (!auth) {
            setChecking(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAdmin(isAdmin(currentUser));
            setChecking(false);
        });

        return unsubscribe;
    }, []);

    if (!firebaseReady || !auth) {
        return (
            <a className="btn btn-outline" href="/login" aria-label="Log in">
                Login
            </a>
        );
    }

    if (checking) {
        return <span className="px-3 py-1 text-sm text-gray-500">Checking login...</span>;
    }

    const displayName = user?.displayName || user?.email || 'Account';

    const handleLogout = async () => {
        if (!auth) return;

        try {
            await signOut(auth);
        } catch (error) {
            console.warn('Error signing out', error);
        }
    };

    return user ? (
        <div className="flex items-center gap-3">
            {admin && (
                <a href="/blog/admin" className="px-3 py-1 text-sm text-gray-200 underline decoration-transparent hover:decoration-current">
                    Admin
                </a>
            )}
            <span className="text-sm text-gray-300">Hi, {displayName}</span>
            <button type="button" className="btn btn-outline" onClick={handleLogout}>
                Logout
            </button>
        </div>
    ) : (
        <a className="btn btn-outline" href="/login" aria-label="Log in">
            Login
        </a>
    );
}

