import { supabase, Post } from "@/lib/supabase";
import { PostCard } from "@/components/PostCard";
import { Newspaper, Clock, CheckCircle, AlertCircle } from "lucide-react";

async function getPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  return data || [];
}

async function getStats() {
  const { data, error } = await supabase
    .from("posts")
    .select("status");

  if (error) return { total: 0, pending: 0, published: 0, failed: 0 };

  const stats = {
    total: data.length,
    pending: data.filter((p) => p.status === "pending_approval").length,
    published: data.filter((p) => p.status === "published").length,
    failed: data.filter((p) => p.status === "failed").length,
  };

  return stats;
}

export default async function Dashboard() {
  const [posts, stats] = await Promise.all([getPosts(), getStats()]);
  const pendingPosts = posts.filter((p) => p.status === "pending_approval");
  const recentPosts = posts.slice(0, 6);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
          Dashboard
        </h1>
        <p className="text-[var(--text-secondary)]">
          Gerencie suas publicações automatizadas
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Newspaper}
          label="Total Posts"
          value={stats.total}
          color="text-[var(--accent)]"
        />
        <StatCard
          icon={Clock}
          label="Aguardando"
          value={stats.pending}
          color="text-amber-500"
        />
        <StatCard
          icon={CheckCircle}
          label="Publicados"
          value={stats.published}
          color="text-green-500"
        />
        <StatCard
          icon={AlertCircle}
          label="Falhas"
          value={stats.failed}
          color="text-red-500"
        />
      </div>

      {/* Pending Approval Section */}
      {pendingPosts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Aguardando Aprovação ({pendingPosts.length})
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {pendingPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Posts */}
      <section>
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">
          Posts Recentes
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {recentPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum post encontrado.</p>
            <p className="text-sm">Os posts aparecerão aqui após a curadoria automática.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border-minimal rounded-xl p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className={`${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
          <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        </div>
      </div>
    </div>
  );
}
