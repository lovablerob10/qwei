"use client";

import Image from "next/image";
import { Clock, ExternalLink, Check, RefreshCw } from "lucide-react";

type PostStatus = 'scraping' | 'editing' | 'designing' | 'pending_approval' | 'approved' | 'published' | 'failed';

interface Post {
    id: string;
    source_title: string | null;
    source_link: string | null;
    content_raw: string | null;
    caption_instagram: string | null;
    copy_linkedin: string | null;
    image_url: string | null;
    status: PostStatus;
    created_at: string;
}

interface PostCardProps {
    post: Post;
    onApprove?: (id: string) => void;
    onRegenerate?: (id: string) => void;
    onEdit?: (id: string) => void;
    onAction?: () => void;
}

const statusLabels: Record<PostStatus, string> = {
    scraping: "Coletando",
    editing: "Editando",
    designing: "Criando Arte",
    pending_approval: "Aguardando",
    approved: "Aprovado",
    published: "Publicado",
    failed: "Falhou",
};

export function PostCard({ post, onApprove, onRegenerate, onEdit, onAction }: PostCardProps) {
    const formattedDate = new Date(post.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <article className="bg-white border-minimal rounded-xl p-5 shadow-soft transition-smooth hover:shadow-md">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="font-medium text-[var(--text-primary)] line-clamp-2 mb-1">
                        {post.source_title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate}
                        </span>
                        {post.source_link && (
                            <a
                                href={post.source_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-[var(--accent)] transition-smooth"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Fonte
                            </a>
                        )}
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-medium status-${post.status}`}>
                    {statusLabels[post.status]}
                </span>
            </div>

            {/* Content Grid */}
            <div className="flex gap-4">
                {/* Image Preview */}
                {post.image_url && (
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--sidebar)]">
                        <Image
                            src={post.image_url}
                            alt={post.source_title || ''}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                {/* Caption Preview */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-3">
                        {post.caption_instagram || post.content_raw?.substring(0, 150) || "Aguardando conteúdo..."}
                    </p>
                </div>
            </div>

            {/* Actions - Only show for pending_approval */}
            {post.status === "pending_approval" && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    <button
                        onClick={() => onApprove?.(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg transition-smooth hover:opacity-90"
                    >
                        <Check className="w-4 h-4" />
                        Aprovar
                    </button>
                    <button
                        onClick={() => onRegenerate?.(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--sidebar)] text-[var(--text-primary)] text-sm font-medium rounded-lg transition-smooth hover:bg-[var(--border)]"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Regerar
                    </button>
                </div>
            )}
        </article>
    );
}
