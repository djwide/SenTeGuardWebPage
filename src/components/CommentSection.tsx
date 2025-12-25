import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, firebaseReady } from '../lib/firebaseClient';

export default function CommentSection() {
    const [user, setUser] = useState<User | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (!auth) {
            setChecking(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setChecking(false);
        });

        return unsubscribe;
    }, []);

    if (!firebaseReady || !auth) {
        return (
            <div className="card space-y-3">
                <h3 className="text-lg text-white">Reader Comments</h3>
                <p className="text-sm text-gray-300">
                    Sign-in is unavailable until Firebase client keys are added. Please add your Firebase environment
                    variables to enable commenting.
                </p>
            </div>
        );
    }

    if (checking) {
        return <div className="card text-sm text-gray-400">Checking your sign-in status...</div>;
    }

    if (!user) {
        return (
            <div className="card space-y-4">
                <h3 className="text-lg text-white">Reader Comments</h3>
                <p className="text-sm text-gray-300">Log in with email or Google to share a comment.</p>
                <a className="btn w-full sm:w-auto" href="/login">
                    Go to login
                </a>
            </div>
        );
    }

    return (
        <form
            className="card space-y-4"
            action="mailto:david@senteguard.com"
            method="post"
            encType="text/plain"
        >
            <div className="flex flex-col gap-1 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <span>Signed in as {user.displayName || user.email || user.uid}</span>
                <span className="text-gray-500">Comments are moderated before publishing.</span>
            </div>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
                Alias
                <input
                    type="text"
                    name="alias"
                    defaultValue={user.displayName || user.email || ''}
                    required
                    className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
                Comment
                <textarea
                    name="comment"
                    rows={5}
                    required
                    className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                ></textarea>
            </label>
            <input type="hidden" name="uid" value={user.uid} />
            <input type="hidden" name="email" value={user.email || ''} />
            <button className="btn w-full sm:w-auto" type="submit">
                Submit Comment
            </button>
        </form>
    );
}

