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

    const htmlToMarkdown = (html: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const serialize = (node: Node, listPrefix = ''): string => {
            if (node.nodeType === Node.TEXT_NODE) {
                return (node.textContent || '').replace(/\s+/g, ' ');
            }

            if (!(node instanceof HTMLElement)) {
                return '';
            }

            const children = Array.from(node.childNodes).map((child, index) =>
                serialize(child, node.tagName === 'OL' ? `${index + 1}. ` : listPrefix)
            );
            const content = children.join('').trim();

            switch (node.tagName) {
                case 'STRONG':
                case 'B':
                    return content ? `**${content}**` : '';
                case 'EM':
                case 'I':
                    return content ? `*${content}*` : '';
                case 'CODE':
                    return content ? '`' + content + '`' : '';
                case 'A': {
                    const href = node.getAttribute('href') || '';
                    return href ? `[${content || href}](${href})` : content;
                }
                case 'BR':
                    return '\n';
                case 'P':
                case 'DIV':
                    return content ? `${content}\n\n` : '\n\n';
                case 'H1':
                    return `# ${content}\n\n`;
                case 'H2':
                    return `## ${content}\n\n`;
                case 'H3':
                    return `### ${content}\n\n`;
                case 'H4':
                    return `#### ${content}\n\n`;
                case 'UL': {
                    return Array.from(node.children)
                        .map((li) => `- ${serialize(li).trim()}`)
                        .join('\n') + '\n\n';
                }
                case 'OL': {
                    return Array.from(node.children)
                        .map((li, idx) => `${idx + 1}. ${serialize(li).trim()}`)
                        .join('\n') + '\n\n';
                }
                case 'LI':
                    return `${listPrefix || '- '}${content}\n`;
                case 'IMG': {
                    const src = node.getAttribute('src') || '';
                    const alt = node.getAttribute('alt') || 'image';
                    return src ? `![${alt}](${src})` : '';
                }
                default:
                    return content;
            }
        };

        return serialize(doc.body).trim();
    };

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

    const applyFormatting = (before: string, after?: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const { selectionStart, selectionEnd, value } = textarea;
        const selected = value.slice(selectionStart, selectionEnd);
        const insertAfter = after ?? before;
        const nextValue =
            value.slice(0, selectionStart) + before + selected + insertAfter + value.slice(selectionEnd);
        setEditBody(nextValue);
        const nextPos = selectionEnd + before.length + insertAfter.length;
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

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData) return;
            const html = event.clipboardData.getData('text/html');
            if (!html) return;
            event.preventDefault();
            const markdown = htmlToMarkdown(html);
            if (markdown) {
                const { selectionStart, selectionEnd, value } = textarea;
                const nextValue = value.slice(0, selectionStart) + markdown + value.slice(selectionEnd);
                setEditBody(nextValue);
                const nextPos = selectionStart + markdown.length;
                requestAnimationFrame(() => {
                    textarea.focus();
                    textarea.setSelectionRange(nextPos, nextPos);
                });
            }
        };

        textarea.addEventListener('paste', handlePaste);
        return () => textarea.removeEventListener('paste', handlePaste);
    }, []);

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
                        <p className="text-sm uppercase tracking-[0.3em] text-primary">Post</p>
                        {editingId === post.id ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
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
                                    rows={6}
                                    value={editBody}
                                    onChange={(e) => setEditBody(e.target.value)}
                                    ref={textareaRef}
                                    className="w-full max-w-3xl rounded-lg border border-gray-800 bg-neutral-900 px-3 py-2 text-white focus:border-primary focus:outline-none"
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
                                        By {admin ? 'David' : post.authorEmail ? post.authorEmail.split('@')[0] : 'Team'}{' '}
                                        {formatDate(post.createdAt) ? `· ${formatDate(post.createdAt)}` : ''}
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
                                <div
                                    className="prose prose-invert prose-lg max-w-3xl prose-headings:text-white prose-strong:text-white prose-em:text-gray-100 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-li:text-gray-200 prose-p:text-gray-200 prose-img:rounded-xl prose-img:border prose-img:border-gray-800 prose-img:mx-auto prose-img:max-h-[480px]"
                                    dangerouslySetInnerHTML={{ __html: marked.parse(post.body || '') }}
                                />
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

