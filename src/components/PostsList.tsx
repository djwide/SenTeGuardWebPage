import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { firebaseReady } from '../lib/firebaseClient';
import { db } from '../lib/firestoreClient';
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

    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp) return '';
        return timestamp.toDate().toLocaleString();
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
                        <h2 className="text-2xl text-white">{post.title}</h2>
                        <p className="text-sm text-gray-500">
                            By {post.authorEmail || 'Team'} {formatDate(post.createdAt) ? `· ${formatDate(post.createdAt)}` : ''}
                        </p>
                        <p className="whitespace-pre-wrap text-gray-200">{post.body}</p>
                    </div>
                    <CommentSection postId={post.id} />
                </article>
            ))}
        </div>
    );
}

