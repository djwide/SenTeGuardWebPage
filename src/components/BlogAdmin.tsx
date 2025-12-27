import { useEffect, useMemo, useState, useRef, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, firebaseApp, firebaseReady } from '../lib/firebaseClient';
import { db } from '../lib/firestoreClient';
import { isAdmin, waitForUser } from '../utils/auth';
import { marked } from 'marked';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

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
    const [tags, setTags] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [adminUser, setAdminUser] = useState(false);
    const [checkedAuth, setCheckedAuth] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewHtml = marked.parse(body || '') as string;

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
            const tagList = tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);

            await addDoc(postsRef, {
                title: title.trim(),
                body: body.trim(),
                slug,
                authorEmail: auth.currentUser?.email || '',
                tags: tagList,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            setStatus('Post published to Firestore.');
            setTitle('');
            setBody('');
            setTags('');
        } catch (err) {
            if (err instanceof FirebaseError && err.code === 'permission-denied') {
                setError(
                    'Permission denied. Ensure Firestore rules allow the admin email and you are signed in as that admin.'
                );
            } else {
                setError(err instanceof Error ? err.message : 'Unable to publish post.');
            }
        } finally {
            setLoading(false);
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
        setBody(nextValue);
        const nextPos = selectionStart + before.length + selected.length + insertAfter.length;
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(nextPos, nextPos);
        });
    };

    const handleLink = () => applyFormatting('[', '](https://example.com)');
    const handleImageUrl = () => {
        const url = typeof window !== 'undefined' ? window.prompt('Image URL (https://...)') : '';
        if (!url) return;
        const alt = typeof window !== 'undefined' ? window.prompt('Alt text', 'Image') : 'Image';
        applyFormatting(`![${alt || 'Image'}](${url})`, '');
    };

    const handleUploadImage = () => {
        if (!firebaseApp || !firebaseReady) {
            setError('Firebase not ready for uploads.');
            return;
        }
        fileInputRef.current?.click();
    };

    const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firebaseApp) return;
        const storage = getStorage(firebaseApp);
        setUploading(true);
        setError('');
        try {
            const path = `blog-images/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            applyFormatting(`![${file.name}](${downloadUrl})`, '');
            setStatus('Image uploaded and inserted.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Image upload failed.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
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
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="card space-y-3">
                <div className="space-y-1">
                    <h2 className="text-2xl text-white">Publish a post</h2>
                    <p className="text-sm text-gray-400">Only the admin account can publish.</p>
                </div>
                <label className="flex flex-col gap-2 text-sm text-gray-300 max-w-3xl">
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
                <label className="flex flex-col gap-2 text-sm text-gray-300 max-w-3xl">
                    Tags (comma separated)
                    <input
                        type="text"
                        name="tags"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="ai, security, launch"
                        className="rounded-lg border border-gray-800 bg-black px-3 py-2 text-white focus:border-primary focus:outline-none"
                    />
                </label>
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                            <span>Formatting:</span>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('**')}>
                                Bold
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('*')}>
                                Italic
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('## ')}>
                                H2
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('### ')}>
                                H3
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('- ')}>
                                Bullet
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={() => applyFormatting('1. ')}>
                                Numbered
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={handleLink}>
                                Link
                            </button>
                            <button type="button" className="btn btn-outline px-3 py-1" onClick={handleImageUrl}>
                                Image URL
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline px-3 py-1"
                                onClick={handleUploadImage}
                                disabled={uploading}
                            >
                                {uploading ? 'Uploading...' : 'Upload image'}
                            </button>
                        </div>
                        <textarea
                            ref={textareaRef}
                            name="body"
                            rows={14}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            required
                            className="w-full rounded-lg border border-gray-800 bg-neutral-900 px-3 py-3 text-white leading-7 focus:border-primary focus:outline-none"
                        ></textarea>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onFileChange}
                        />
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-neutral-950/70 p-4 max-w-3xl mx-auto">
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Live preview</p>
                        <div
                            className="prose prose-invert prose-lg max-w-none leading-7 prose-headings:text-white prose-strong:text-white prose-em:text-gray-100 prose-a:text-primary prose-a:underline hover:prose-a:opacity-90 prose-li:text-gray-200 prose-p:text-gray-200 prose-pre:bg-neutral-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-code:font-mono prose-img:rounded-2xl prose-img:border prose-img:border-gray-800 prose-img:mx-auto prose-img:max-h-[480px]"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <button className="btn" type="submit" disabled={loading}>
                    Publish post
                </button>
                {status && <p className="text-sm text-green-400">{status}</p>}
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </form>
    );
}

