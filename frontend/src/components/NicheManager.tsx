"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Settings2, Tag, Mic2 } from "lucide-react";

interface Niche {
    id: string;
    name: string;
    keywords: string[];
    tone: string;
    active: boolean;
}

interface Plan {
    id: string;
    name: string;
    display_name: string;
    max_niches: number;
}

interface NicheManagerProps {
    userId: string;
}

const TONE_OPTIONS = [
    { value: "profissional", label: "Profissional", desc: "Tom corporativo e confiável" },
    { value: "autoridade", label: "Autoridade", desc: "Especialista do setor" },
    { value: "informal", label: "Informal", desc: "Amigável e acessível" },
    { value: "tecnico", label: "Técnico", desc: "Detalhado e preciso" },
];

export function NicheManager({ userId }: NicheManagerProps) {
    const [niches, setNiches] = useState<Niche[]>([]);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingNiche, setEditingNiche] = useState<Niche | null>(null);

    // Form state
    const [nicheName, setNicheName] = useState("");
    const [keywords, setKeywords] = useState("");
    const [tone, setTone] = useState("profissional");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [userId]);

    async function loadData() {
        setLoading(true);

        // Load user plan
        let { data: profile } = await supabase
            .from("agent_profiles")
            .select("plan_id, plans(*)")
            .eq("user_id", userId)
            .single();

        // If no profile exists, create one with starter plan
        if (!profile) {
            // Get starter plan
            const { data: starterPlan } = await supabase
                .from("plans")
                .select("id")
                .eq("name", "starter")
                .single();

            if (starterPlan) {
                // Create agent profile
                await supabase
                    .from("agent_profiles")
                    .insert({
                        user_id: userId,
                        plan_id: starterPlan.id,
                    });

                // Reload profile
                const { data: newProfile } = await supabase
                    .from("agent_profiles")
                    .select("plan_id, plans(*)")
                    .eq("user_id", userId)
                    .single();

                profile = newProfile;
            }
        }

        if (profile?.plans) {
            setPlan(profile.plans as unknown as Plan);
        } else {
            // Fallback to starter plan defaults
            setPlan({
                id: 'default',
                name: 'starter',
                display_name: 'Starter',
                max_niches: 1,
            });
        }

        // Load niches
        const { data: nichesData } = await supabase
            .from("user_niches")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true });

        setNiches(nichesData || []);
        setLoading(false);
    }

    const canAddNiche = () => {
        if (!plan) return false;
        if (plan.max_niches === -1) return true; // Ilimitado
        return niches.length < plan.max_niches;
    };

    const openAddModal = () => {
        setEditingNiche(null);
        setNicheName("");
        setKeywords("");
        setTone("profissional");
        setShowAddModal(true);
    };

    const openEditModal = (niche: Niche) => {
        setEditingNiche(niche);
        setNicheName(niche.name);
        setKeywords(niche.keywords.join(", "));
        setTone(niche.tone);
        setShowAddModal(true);
    };

    const saveNiche = async () => {
        if (!nicheName.trim()) return;

        setSaving(true);
        const keywordsArray = keywords.split(",").map(k => k.trim()).filter(k => k);

        if (editingNiche) {
            // Update
            await supabase
                .from("user_niches")
                .update({
                    name: nicheName,
                    keywords: keywordsArray,
                    tone,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", editingNiche.id);
        } else {
            // Insert
            await supabase
                .from("user_niches")
                .insert({
                    user_id: userId,
                    name: nicheName,
                    keywords: keywordsArray,
                    tone,
                });
        }

        setSaving(false);
        setShowAddModal(false);
        loadData();
    };

    const deleteNiche = async (id: string) => {
        if (!confirm("Remover este nicho? Notícias curadas serão perdidas.")) return;

        await supabase
            .from("user_niches")
            .delete()
            .eq("id", id);

        loadData();
    };

    const toggleNiche = async (niche: Niche) => {
        await supabase
            .from("user_niches")
            .update({ active: !niche.active })
            .eq("id", niche.id);

        loadData();
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-20 bg-[var(--sidebar)] rounded-lg"></div>
                <div className="h-20 bg-[var(--sidebar)] rounded-lg"></div>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Meus Nichos
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                        Configure os temas que a IA vai monitorar para você
                    </p>
                </div>
                {plan && (
                    <div className="text-right">
                        <span className="text-xs text-[var(--text-secondary)]">Plano {plan.display_name}</span>
                        <p className="text-sm font-medium">
                            {niches.length}/{plan.max_niches === -1 ? "∞" : plan.max_niches} nichos
                        </p>
                    </div>
                )}
            </div>

            {/* Niches List */}
            <div className="space-y-3">
                {niches.map((niche) => (
                    <div
                        key={niche.id}
                        className={`p-4 rounded-lg border transition-all ${niche.active
                            ? "bg-[var(--card)] border-[var(--border)]"
                            : "bg-[var(--sidebar)] border-transparent opacity-60"
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-[var(--text-primary)]">{niche.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${niche.active
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-gray-500/20 text-gray-400"
                                        }`}>
                                        {niche.active ? "Ativo" : "Pausado"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-secondary)]">
                                    <span className="flex items-center gap-1">
                                        <Mic2 className="w-3 h-3" />
                                        {TONE_OPTIONS.find(t => t.value === niche.tone)?.label || niche.tone}
                                    </span>
                                    {niche.keywords.length > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Tag className="w-3 h-3" />
                                            {niche.keywords.slice(0, 3).join(", ")}
                                            {niche.keywords.length > 3 && ` +${niche.keywords.length - 3}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleNiche(niche)}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${niche.active ? "bg-green-500" : "bg-gray-600"
                                        }`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${niche.active ? "right-1" : "left-1"
                                        }`}></span>
                                </button>
                                <button
                                    onClick={() => openEditModal(niche)}
                                    className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors"
                                >
                                    <Settings2 className="w-4 h-4 text-[var(--text-secondary)]" />
                                </button>
                                <button
                                    onClick={() => deleteNiche(niche.id)}
                                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Button */}
                {canAddNiche() ? (
                    <button
                        onClick={openAddModal}
                        className="w-full p-4 border-2 border-dashed border-[var(--border)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--sidebar)] transition-all flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Adicionar Nicho</span>
                    </button>
                ) : (
                    <div className="p-4 bg-[var(--sidebar)] rounded-lg text-center">
                        <p className="text-sm text-[var(--text-secondary)]">
                            Limite de nichos atingido.{" "}
                            <button className="text-[var(--accent)] hover:underline">
                                Upgrade para mais
                            </button>
                        </p>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
                    <div
                        className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-semibold mb-4">
                            {editingNiche ? "Editar Nicho" : "Novo Nicho"}
                        </h2>

                        <div className="space-y-4">
                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome do Nicho</label>
                                <input
                                    type="text"
                                    value={nicheName}
                                    onChange={(e) => setNicheName(e.target.value)}
                                    placeholder="Ex: Mercado Imobiliário"
                                    className="w-full p-3 rounded-lg bg-[var(--sidebar)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
                                />
                            </div>

                            {/* Keywords */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Palavras-chave</label>
                                <input
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="imóveis, zoneamento, construtoras"
                                    className="w-full p-3 rounded-lg bg-[var(--sidebar)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
                                />
                                <p className="text-xs text-[var(--text-secondary)] mt-1">
                                    Separe por vírgulas. A IA usará para buscar notícias.
                                </p>
                            </div>

                            {/* Tom de Voz */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Tom de Voz</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TONE_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setTone(option.value)}
                                            className={`p-3 rounded-lg border text-left transition-all ${tone === option.value
                                                ? "border-[var(--accent)] bg-[var(--accent)]/10"
                                                : "border-[var(--border)] hover:border-[var(--accent)]/50"
                                                }`}
                                        >
                                            <span className="block font-medium text-sm">{option.label}</span>
                                            <span className="block text-xs text-[var(--text-secondary)]">{option.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar)] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveNiche}
                                disabled={saving || !nicheName.trim()}
                                className="flex-1 py-3 px-4 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {saving ? "Salvando..." : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
