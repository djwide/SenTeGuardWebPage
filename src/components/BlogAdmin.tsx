import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, firebaseReady } from '../lib/firebaseClient';
import { db } from '../lib/firestoreClient';
import { isAdmin, waitForUser } from '../utils/auth';

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

export default function BlogAdmin() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [adminUser, setAdminUser] = useState(false);
    const [checkedAuth, setCheckedAuth] = useState(false);

    const postsRef = useMemo(() => {
        if (!db) return null;
        return collection(db, 'posts');
    }, [db]);

    useEffect(() => {
        let mounted = true;
        waitForUser().then((user) => {
            if (!mounted) return;
            setAdminUser(isAdmin(user));
            setCheckedAuth(true);
        });
        return () => {
            mounted = false;
        };
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!auth || !db || !postsRef) {
            setError('Firebase is not ready. Check your environment variables.');
            return;
        }

        if (!adminUser) {
            setError('Only the admin can publish posts.');
            return;
        }

        if (!title.trim() || !body.trim()) {
            setError('Title and body are required.');
            return;
        }

        setLoading(true);
        setError('');
        setStatus('');

        try {
            const slug = `${slugify(title) || 'post'}-${Date.now()}`;
            await addDoc(postsRef, {
                title: title.trim(),
                body: body.trim(),
                slug,
                authorEmail: auth.currentUser?.email || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            setStatus('Post published to Firestore.');
            setTitle('');
            setBody('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to publish post.');
        } finally {
            setLoading(false);
        }
    };

    if (!firebaseReady || !db) {
        return (
            <div className="card space-y-3">
                <h2 className="text-xl text-white">Admin publishing</h2>
                <p className="text-sm text-gray-300">
                    Add your Firebase client environment variables to enable admin publishing. Firestore is required.
                </p>
            </div>
        );
    }

    if (!checkedAuth) {
        return <div className="card text-sm text-gray-400">Checking admin access...</div>;
    }

    if (!adminUser) {
        return (
            <div className="card space-y-3">
                <h2 className="text-xl text-white">Admin only</h2>
                <p className="text-sm text-gray-300">
                    Sign in with the admin account configured in <code>PUBLIC_ADMIN_EMAIL</code> to publish posts.
                </p>
                <a className="btn w-full sm:w-auto" href="/login">
                    Go to login
                </a>
            </div>
        );
    }

    return (
        <form className="card space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
                <h2 className="text-xl text-white">Publish a post</h2>
                <p className="text-sm text-gray-400">Only the admin account can publish.</p>
            </div>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
                Title
                <input
                    type="text"
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
                Body
                <textarea
                    name="body"
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                ></textarea>
            </label>
            <button className="btn w-full sm:w-auto" type="submit" disabled={loading}>
                Publish post
            </button>
            {status && <p className="text-sm text-green-400">{status}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
    );
}

