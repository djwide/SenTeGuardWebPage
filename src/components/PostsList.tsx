import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    serverTimestamp,
    type Timestamp
} from 'firebase/firestore';
import { auth, firebaseReady } from '../lib/firebaseClient';
import { db } from '../lib/firestoreClient';
import { isAdmin } from '../utils/auth';
import CommentSection from './CommentSection';

type Post = {
    id: string;
    title: string;
    body: string;
    authorEmail?: string;
    createdAt?: Timestamp;
};

export default function PostsList() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [admin, setAdmin] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);

    const postsRef = useMemo(() => {
        if (!db) return null;
        return collection(db, 'posts');
    }, [db]);

    useEffect(() => {
        if (!postsRef) return;
        const q = query(postsRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const next: Post[] = snapshot.docs.map((doc) => {
                const data = doc.data() as Omit<Post, 'id'>;
                return { id: doc.id, ...data };
            });
            setPosts(next);
        });
        return unsubscribe;
    }, [postsRef]);

    useEffect(() => {
        if (!auth) {
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setAdmin(isAdmin(currentUser));
        });
        return unsubscribe;
    }, []);

    const handleDeletePost = async (postId: string) => {
        if (!admin || !postsRef) return;
        setDeletingId(postId);
        setError('');
        try {
            await deleteDoc(doc(postsRef, postId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to delete post.');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp) return '';
        return timestamp.toDate().toLocaleString();
    };

    const startEdit = (post: Post) => {
        setEditingId(post.id);
        setEditTitle(post.title);
        setEditBody(post.body);
        setError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
        setEditBody('');
    };

    const handleSave = async (postId: string) => {
        if (!admin || !postsRef) return;
        if (!editTitle.trim() || !editBody.trim()) {
            setError('Title and body are required to update a post.');
            return;
        }
        setSavingId(postId);
        setError('');
        try {
            await updateDoc(doc(postsRef, postId), {
                title: editTitle.trim(),
                body: editBody.trim(),
                updatedAt: serverTimestamp()
            });
            cancelEdit();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update post.');
        } finally {
            setSavingId(null);
        }
    };

    if (!firebaseReady || !db) {
        return (
            <div className="card space-y-3">
                <h3 className="text-lg text-white">Blog posts</h3>
                <p className="text-sm text-gray-300">
                    Add your Firebase environment variables to load posts from Firestore. Admin publishing and
                    authenticated comments rely on the client SDK.
                </p>
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="card space-y-3">
                <h3 className="text-lg text-white">No posts yet</h3>
                <p className="text-sm text-gray-300">
                    When the admin publishes a post, it will appear here. Visit /blog/admin to add the first one.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {posts.map((post) => (
                <article key={post.id} className="space-y-5">
                    <div className="card space-y-3">
                        <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Post</p>
                        {editingId === post.id ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                                />
                                <textarea
                                    rows={6}
                                    value={editBody}
                                    onChange={(e) => setEditBody(e.target.value)}
                                    className="w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                                ></textarea>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => handleSave(post.id)}
                                        disabled={savingId === post.id}
                                    >
                                        {savingId === post.id ? 'Saving...' : 'Save changes'}
                                    </button>
                                    <button type="button" className="btn btn-outline" onClick={cancelEdit}>
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => handleDeletePost(post.id)}
                                        disabled={deletingId === post.id}
                                    >
                                        {deletingId === post.id ? 'Deleting...' : 'Delete post'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-2xl text-white">{post.title}</h2>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-gray-500">
                                        By {post.authorEmail || 'Team'} {formatDate(post.createdAt) ? `· ${formatDate(post.createdAt)}` : ''}
                                    </p>
                                    {admin && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                onClick={() => startEdit(post)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                onClick={() => handleDeletePost(post.id)}
                                                disabled={deletingId === post.id}
                                            >
                                                {deletingId === post.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="whitespace-pre-wrap text-gray-200">{post.body}</p>
                            </>
                        )}
                        {error && <p className="text-sm text-red-400">{error}</p>}
                    </div>
                    <CommentSection postId={post.id} />
                </article>
            ))}
        </div>
    );
}

