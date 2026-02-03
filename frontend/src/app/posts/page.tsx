'use client';

import { useState, useEffect } from 'react';
import { supabase, Post } from '@/lib/supabase';
import { PostCard } from '@/components/PostCard';
import { Search, Filter, LayoutGrid, LayoutList } from 'lucide-react';

export default function PostsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        fetchPosts();
    }, [statusFilter]);

    async function fetchPosts() {
        setLoading(true);
        let query = supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data } = await query;
        setPosts(data || []);
        setLoading(false);
    }

    const filteredPosts = posts.filter(post =>
        post.source_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.caption_instagram?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statusOptions = [
        { value: 'all', label: 'Todos' },
        { value: 'scraping', label: 'Coletando' },
        { value: 'editing', label: 'Editando' },
        { value: 'designing', label: 'Desenhando' },
        { value: 'pending_approval', label: 'Aguardando' },
        { value: 'approved', label: 'Aprovado' },
        { value: 'published', label: 'Publicado' },
        { value: 'failed', label: 'Falhou' },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-qwei-text">Posts</h1>
                <p className="text-qwei-muted">Gerencie todos os seus posts</p>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-qwei-muted" />
                    <input
                        type="text"
                        placeholder="Buscar posts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-qwei-border rounded-lg focus:outline-none focus:ring-2 focus:ring-qwei-accent/20 focus:border-qwei-accent transition-all"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-qwei-muted" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-qwei-border rounded-lg focus:outline-none focus:ring-2 focus:ring-qwei-accent/20 focus:border-qwei-accent transition-all bg-white"
                    >
                        {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 p-1 bg-qwei-bg rounded-lg border border-qwei-border">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                    >
                        <LayoutList className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Posts Grid/List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-qwei-accent"></div>
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-qwei-muted">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p>Nenhum post encontrado.</p>
                </div>
            ) : (
                <div className={viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'flex flex-col gap-4'
                }>
                    {filteredPosts.map(post => (
                        <PostCard key={post.id} post={post} onAction={fetchPosts} />
                    ))}
                </div>
            )}
        </div>
    );
}
