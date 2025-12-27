import { useEffect, useMemo, useRef, useState } from 'react';
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
import { marked } from 'marked';

type Post = {
    id: string;
    title: string;
    body: string;
    authorEmail?: string;
    createdAt?: Timestamp;
    tags?: string[];
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
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [editTags, setEditTags] = useState('');

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
        setEditTags((post.tags || []).join(', '));
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
                tags: toTagArray(editTags),
                updatedAt: serverTimestamp()
            });
            cancelEdit();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update post.');
        } finally {
            setSavingId(null);
        }
    };

    const applyFormatting = (before: string, after?: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const { selectionStart, selectionEnd, value } = textarea;
        const selected = value.slice(selectionStart, selectionEnd);
        const insertAfter = after ?? before;
        const nextValue =
            value.slice(0, selectionStart) + before + selected + insertAfter + value.slice(selectionEnd);
        setEditBody(nextValue);
        const nextPos = selectionStart + before.length + selected.length + insertAfter.length;
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(nextPos, nextPos);
        });
    };

    const handleLink = () => {
        applyFormatting('[', '](https://example.com)');
    };

    const handleImage = () => {
        const url = typeof window !== 'undefined' ? window.prompt('Image URL (https://...)') : '';
        if (!url) return;
        const alt = typeof window !== 'undefined' ? window.prompt('Alt text', 'Image') : 'Image';
        applyFormatting(`![${alt || 'Image'}](${url})`, '');
    };

    const toTagArray = (value: string) =>
        value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

    const slugify = (value: string) =>
        String(value ?? '')
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

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
            {posts.map((post) => {
                const slugCounts = new Map<string, number>();
                const uniqueSlug = (text: string) => {
                    const base = slugify(text);
                    const count = slugCounts.get(base) ?? 0;
                    slugCounts.set(base, count + 1);
                    return count ? `${base}-${count}` : base;
                };

                const tokens = marked.lexer(post.body || '');
                const headingTokens = tokens.filter(
                    (t) => t.type === 'heading' && (t as any).depth <= 3
                ) as { depth: number; text?: string }[];
                const toc = headingTokens.map((t) => ({
                    depth: t.depth,
                    text: t.text ?? '',
                    id: uniqueSlug(t.text ?? '')
                }));

                const renderer: any = new (marked as any).Renderer();
                renderer.heading = (text: string, level: number, raw?: string) => {
                    const headingText = raw ?? text ?? '';
                    const id = uniqueSlug(headingText);
                    return `<h${level} id="${id}">${text}</h${level}>`;
                };
                const html = (marked as any).parser(tokens, { renderer });

                return (
                    <article key={post.id} className="space-y-6">
                        <div className="card space-y-4 max-w-4xl mx-auto">
                            <p className="text-sm uppercase tracking-[0.3em] text-primary">Post</p>
                            {editingId === post.id ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full max-w-3xl rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={editTags}
                                        onChange={(e) => setEditTags(e.target.value)}
                                        placeholder="Tags (comma separated)"
                                        className="w-full max-w-3xl rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                                    />
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="text-gray-400">Formatting:</span>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('**')}
                                        >
                                            Bold
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('*')}
                                        >
                                            Italic
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('## ')}
                                        >
                                            H2
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('### ')}
                                        >
                                            H3
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('- ')}
                                        >
                                            Bullet
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('1. ')}
                                        >
                                            Numbered
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={handleLink}
                                        >
                                            Link
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={() => applyFormatting('😊')}
                                        >
                                            Emoji
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline px-3 py-1"
                                            onClick={handleImage}
                                        >
                                            Image
                                        </button>
                                    </div>
                                    <textarea
                                        rows={10}
                                        value={editBody}
                                        onChange={(e) => setEditBody(e.target.value)}
                                        ref={textareaRef}
                                        className="w-full max-w-3xl rounded-lg border border-gray-800 bg-neutral-900 px-3 py-2 text-white leading-7 focus:border-primary focus:outline-none"
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
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-semibold text-white">{post.title}</h2>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                            <span>
                                                By {admin ? 'David' : post.authorEmail ? post.authorEmail.split('@')[0] : 'Team'}
                                            </span>
                                            {formatDate(post.createdAt) && <span>· {formatDate(post.createdAt)}</span>}
                                            {post.tags && post.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {post.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full border border-gray-800 bg-neutral-900 px-2 py-1 text-xs text-gray-200"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {admin && (
                                            <div className="flex gap-2 pt-2">
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

                                    {toc.length > 1 && (
                                        <div className="rounded-xl border border-gray-800 bg-neutral-950/70 p-4 max-w-3xl mx-auto space-y-2">
                                            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Contents</p>
                                            <ul className="space-y-1 text-sm text-gray-300">
                                                {toc.map((item) => (
                                                    <li key={item.id} className="ml-[calc((item.depth-1)*12px)]">
                                                        <a className="hover:underline" href={`#${item.id}`}>
                                                            {item.text}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div
                                        className="prose prose-invert prose-lg max-w-3xl mx-auto leading-7 prose-headings:text-white prose-strong:text-white prose-em:text-gray-100 prose-a:text-primary prose-a:underline hover:prose-a:opacity-90 prose-li:text-gray-200 prose-p:text-gray-200 prose-pre:bg-neutral-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-code:font-mono prose-img:rounded-2xl prose-img:border prose-img:border-gray-800 prose-img:mx-auto prose-img:max-h-[480px] prose-figcaption:text-sm prose-figcaption:text-gray-500"
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                </>
                            )}
                            {error && <p className="text-sm text-red-400">{error}</p>}
                        </div>
                        <CommentSection postId={post.id} />
                    </article>
                );
            })}
        </div>
    );
}

