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
                    className={`rounded-full border px-3 py-1 ${mode === 'signin' ? 'border-primary text-primary' : 'border-gray-700 text-gray-300'
                        }`}
                    onClick={() => setMode('signin')}
                    disabled={loading}
                >
                    Sign in
                </button>
                <button
                    type="button"
                    className={`rounded-full border px-3 py-1 ${mode === 'signup' ? 'border-primary text-primary' : 'border-gray-700 text-gray-300'
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
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-300">Continue with</span>
                    <button
                        className="btn btn-outline px-3 py-2"
                        type="button"
                        onClick={handleGoogleSignin}
                        disabled={loading}
                        aria-label="Continue with Google"
                        title="Continue with Google"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="h-5 w-5">
                            <path
                                fill="#4285f4"
                                d="M533.5 278.4c0-18.5-1.5-32-4.7-46H272.1v87h149c-3 21.7-19.3 54.4-55.6 76.3l-.5 3.3 80.7 62.5 5.6.6c51.3-47.3 81.2-117 81.2-183.7"
                            />
                            <path
                                fill="#34a853"
                                d="M272.1 544.3c73.5 0 135.3-24.1 180.4-65.6l-86.1-66.6c-23.2 15-54.4 25.5-94.3 25.5-71.9 0-132.8-47.3-154.5-112.7l-3.2.3-84.3 65.3-1.1 3.1C72.7 480.7 165.4 544.3 272.1 544.3"
                            />
                            <path
                                fill="#fbbc04"
                                d="M117.6 325c-5.8-17.5-9.2-36.3-9.2-55.5 0-19.2 3.4-38 9-55.5l-.2-3.7-85-66-2.8 1.3C13.6 192 0 232 0 273.6c0 41.6 13.6 81.6 29.4 112l88.2-60.6"
                            />
                            <path
                                fill="#ea4335"
                                d="M272.1 109.7c51.1 0 85.6 22.1 105.3 40.6l76.9-74.8C407.1 28.5 345.6 0 272.1 0 165.4 0 72.7 63.6 29.4 161l88.2 60.6c21.8-65.4 82.7-111.9 154.5-111.9"
                            />
                        </svg>
                    </button>
                </div>
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

