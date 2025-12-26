import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    type Timestamp
} from 'firebase/firestore';
import { auth, firebaseReady } from '../lib/firebaseClient';
import { db } from '../lib/firestoreClient';
import { isAdmin } from '../utils/auth';

type Comment = {
    id: string;
    text: string;
    alias: string;
    userId?: string;
    userEmail?: string;
    createdAt?: Timestamp;
};

interface CommentSectionProps {
    postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
    const [user, setUser] = useState<User | null>(null);
    const [checking, setChecking] = useState(true);
    const [comments, setComments] = useState<Comment[]>([]);
    const [alias, setAlias] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [admin, setAdmin] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const commentsRef = useMemo(() => {
        if (!db) return null;
        return collection(db, 'posts', postId, 'comments');
    }, [db, postId]);

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

    useEffect(() => {
        if (!commentsRef) return;
        const q = query(commentsRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const next: Comment[] = snapshot.docs.map((doc) => {
                const data = doc.data() as Omit<Comment, 'id'>;
                return { id: doc.id, ...data };
            });
            setComments(next);
        });
        return unsubscribe;
    }, [commentsRef]);

    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleString();
    };

    if (!firebaseReady || !auth || !db) {
        return (
            <div className="card space-y-3">
                <h3 className="text-lg text-white">Reader Comments</h3>
                <p className="text-sm text-gray-300">
                    Firebase client keys are required to load comments. Add your Firebase environment variables to enable
                    authenticated commenting.
                </p>
            </div>
        );
    }

    if (checking) {
        return <div className="card text-sm text-gray-400">Checking your sign-in status...</div>;
    }

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!user || !commentsRef) {
            setError('You must be logged in to comment.');
            return;
        }

        if (!text.trim()) {
            setError('Comment cannot be empty.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await addDoc(commentsRef, {
                text: text.trim(),
                alias: alias || user.displayName || user.email || 'Anonymous',
                userId: user.uid,
                userEmail: user.email || '',
                createdAt: serverTimestamp()
            });
            setText('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to post comment.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!admin || !commentsRef) return;
        setDeletingId(commentId);
        setError('');
        try {
            await deleteDoc(doc(commentsRef, commentId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to delete comment.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {!user ? (
                <div className="card space-y-4">
                    <h3 className="text-lg text-white">Reader Comments</h3>
                    <p className="text-sm text-gray-300">Log in with email or Google to share a comment.</p>
                    <a className="btn w-full sm:w-auto" href="/login">
                        Go to login
                    </a>
                </div>
            ) : (
                <form className="card space-y-4" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-1 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>Signed in as {user.displayName || user.email || user.uid}</span>
                        <span className="text-gray-500">Comments are moderated before publishing.</span>
                    </div>
                    <label className="flex flex-col gap-2 text-sm text-gray-300">
                        Alias
                        <input
                            type="text"
                            name="alias"
                            value={alias}
                            onChange={(e) => setAlias(e.target.value)}
                            placeholder={user.displayName || user.email || 'Your alias'}
                            className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                        />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-gray-300">
                        Comment
                        <textarea
                            name="comment"
                            rows={5}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                            className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                        ></textarea>
                    </label>
                    <button className="btn w-full sm:w-auto" type="submit" disabled={loading}>
                        Submit Comment
                    </button>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </form>
            )}

            <div className="card space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg text-white">Comments</h3>
                    <span className="text-xs text-gray-500">{comments.length} total</span>
                </div>
                {comments.length === 0 ? (
                    <p className="text-sm text-gray-400">No comments yet. Be the first to share your thoughts.</p>
                ) : (
                    <ul className="space-y-3">
                        {comments.map((comment) => (
                            <li key={comment.id} className="rounded-lg border border-gray-800 bg-neutral-950/70 p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-white">{comment.alias}</span>
                                        <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                                    </div>
                                    {admin && (
                                        <button
                                            type="button"
                                            className="btn btn-outline text-xs"
                                            onClick={() => handleDelete(comment.id)}
                                            disabled={deletingId === comment.id}
                                        >
                                            {deletingId === comment.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-gray-200">{comment.text}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

