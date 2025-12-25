import { useEffect, useState, type FormEvent } from 'react';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    type User
} from 'firebase/auth';
import { auth, firebaseReady, getMissingFirebaseKeys, googleProvider } from '../lib/firebaseClient';

interface LoginFormProps {
    redirectTo?: string;
}

function formatErrorMessage(error: unknown) {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'Unable to sign in. Please try again.';
}

export default function LoginForm({ redirectTo = '/' }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
        return unsubscribe;
    }, []);

    if (!firebaseReady || !auth || !googleProvider) {
        const missing = getMissingFirebaseKeys();
        return (
            <div className="card space-y-3">
                <h3 className="text-lg text-white">Firebase needs configuration</h3>
                <p className="text-sm text-gray-300">
                    Add the Firebase client environment variables to your <code>.env</code> file so sign-in can load on
                    this page.
                </p>
                <p className="text-sm text-gray-400">
                    Missing keys: {missing.length > 0 ? missing.join(', ') : 'client configuration'}
                </p>
            </div>
        );
    }

    const redirectAfterAuth = () => {
        if (!redirectTo || typeof window === 'undefined') return;
        setStatus('Signed in! Redirecting...');
        setTimeout(() => {
            window.location.assign(redirectTo);
        }, 350);
    };

    const handleEmailSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!auth) return;

        setLoading(true);
        setError('');
        setStatus('');

        try {
            if (mode === 'signin') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            redirectAfterAuth();
        } catch (err) {
            setError(formatErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignin = async () => {
        if (!auth || !googleProvider) return;
        setLoading(true);
        setError('');
        setStatus('');

        try {
            await signInWithPopup(auth, googleProvider);
            redirectAfterAuth();
        } catch (err) {
            setError(formatErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        setLoading(true);
        setError('');

        try {
            await signOut(auth);
            setStatus('Signed out');
        } catch (err) {
            setError(formatErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <button
                    type="button"
                    className={`rounded-full border px-3 py-1 ${
                        mode === 'signin' ? 'border-primary text-primary' : 'border-gray-700 text-gray-300'
                    }`}
                    onClick={() => setMode('signin')}
                    disabled={loading}
                >
                    Sign in
                </button>
                <button
                    type="button"
                    className={`rounded-full border px-3 py-1 ${
                        mode === 'signup' ? 'border-primary text-primary' : 'border-gray-700 text-gray-300'
                    }`}
                    onClick={() => setMode('signup')}
                    disabled={loading}
                >
                    Create account
                </button>
                {user && <span className="text-gray-400">Signed in as {user.email || user.displayName || user.uid}</span>}
            </div>

            <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                    Email
                    <input
                        type="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-300">
                    Password
                    <input
                        type="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                    />
                </label>
                <button className="btn w-full" type="submit" disabled={loading}>
                    {mode === 'signin' ? 'Sign in with email' : 'Create account'}
                </button>
            </form>

            <div className="space-y-3">
                <button className="btn btn-outline w-full" type="button" onClick={handleGoogleSignin} disabled={loading}>
                    Continue with Google
                </button>
                {user && (
                    <button className="btn btn-outline w-full" type="button" onClick={handleSignOut} disabled={loading}>
                        Sign out
                    </button>
                )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {status && <p className="text-sm text-green-400">{status}</p>}
            <p className="text-xs text-gray-500">
                Login is required to comment. Blog publishing is restricted to the admin account.
            </p>
        </div>
    );
}

