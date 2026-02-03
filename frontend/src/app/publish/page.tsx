'use client';

import { useState, useEffect } from 'react';
import { supabase, Post } from '@/lib/supabase';
import { Send, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function PublishPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingPosts();
    }, []);

    async function fetchPendingPosts() {
        setLoading(true);
        const { data } = await supabase
            .from('posts')
            .select('*')
            .in('status', ['pending_approval', 'approved'])
            .order('created_at', { ascending: false });

        setPosts(data || []);
        setLoading(false);
    }

    async function handleApprove(postId: string) {
        await supabase
            .from('posts')
            .update({ status: 'approved' })
            .eq('id', postId);
        fetchPendingPosts();
    }

    async function handleRegenerate(postId: string) {
        await supabase
            .from('posts')
            .update({ status: 'editing' })
            .eq('id', postId);
        fetchPendingPosts();
    }

    async function handlePublish(postId: string) {
        setPublishing(postId);
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/social-publisher`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ record: { id: postId } }),
                }
            );

            if (response.ok) {
                fetchPendingPosts();
            }
        } catch (error) {
            console.error('Publish error:', error);
        }
        setPublishing(null);
    }

    const pendingPosts = posts.filter(p => p.status === 'pending_approval');
    const approvedPosts = posts.filter(p => p.status === 'approved');

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-qwei-text">Publicar</h1>
                <p className="text-qwei-muted">Aprove e publique seus posts</p>
            </div>

            {/* Pending Approval Section */}
            <section className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-medium">Aguardando Aprovação ({pendingPosts.length})</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-qwei-accent"></div>
                    </div>
                ) : pendingPosts.length === 0 ? (
                    <div className="bg-qwei-bg border border-qwei-border rounded-xl p-8 text-center text-qwei-muted">
                        <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>Nenhum post aguardando aprovação</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {pendingPosts.map(post => (
                            <div key={post.id} className="bg-white border border-qwei-border rounded-xl overflow-hidden">
                                <div className="flex">
                                    {post.image_url && (
                                        <img
                                            src={post.image_url}
                                            alt=""
                                            className="w-40 h-40 object-cover"
                                        />
                                    )}
                                    <div className="flex-1 p-4">
                                        <h3 className="font-medium text-qwei-text line-clamp-2 mb-2">
                                            {post.source_title}
                                        </h3>
                                        <p className="text-sm text-qwei-muted line-clamp-3 mb-4">
                                            {post.caption_instagram?.substring(0, 120)}...
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(post.id)}
                                                className="flex-1 px-3 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                                            >
                                                Aprovar
                                            </button>
                                            <button
                                                onClick={() => handleRegenerate(post.id)}
                                                className="px-3 py-2 border border-qwei-border text-qwei-muted text-sm rounded-lg hover:bg-qwei-bg transition-colors"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Approved Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-medium">Aprovados - Prontos para Publicar ({approvedPosts.length})</h2>
                </div>

                {approvedPosts.length === 0 ? (
                    <div className="bg-qwei-bg border border-qwei-border rounded-xl p-8 text-center text-qwei-muted">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>Nenhum post aprovado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {approvedPosts.map(post => (
                            <div key={post.id} className="bg-white border border-qwei-border rounded-xl overflow-hidden">
                                <div className="flex">
                                    {post.image_url && (
                                        <img
                                            src={post.image_url}
                                            alt=""
                                            className="w-40 h-40 object-cover"
                                        />
                                    )}
                                    <div className="flex-1 p-4">
                                        <h3 className="font-medium text-qwei-text line-clamp-2 mb-2">
                                            {post.source_title}
                                        </h3>
                                        <p className="text-sm text-qwei-muted line-clamp-3 mb-4">
                                            {post.caption_instagram?.substring(0, 120)}...
                                        </p>
                                        <button
                                            onClick={() => handlePublish(post.id)}
                                            disabled={publishing === post.id}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-qwei-accent text-white rounded-lg hover:bg-qwei-accent/90 transition-colors disabled:opacity-50"
                                        >
                                            {publishing === post.id ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                            Publicar Agora
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
