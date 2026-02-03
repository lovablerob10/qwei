"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { WhatsAppConnect } from "./WhatsAppConnect";

interface WhatsAppSectionProps {
    onConnected?: (phone: string) => void;
}

type Plan = "starter" | "business" | "authority";

interface Nicho {
    id?: string;
    nome_nicho: string;
    tom_de_voz: string;
    ativo: boolean;
}

interface Plano {
    id: string;
    nome: string;
    limite_nichos: number;
    preco_centavos: number;
    features: string[];
}

const PLAN_LIMITS: Record<Plan, number> = {
    starter: 1,
    business: 3,
    authority: 999,
};

const PLAN_NAMES: Record<Plan, string> = {
    starter: "Starter",
    business: "Business",
    authority: "Authority",
};

const PLAN_PRICES: Record<Plan, string> = {
    starter: "R$ 97/mês",
    business: "R$ 197/mês",
    authority: "R$ 497/mês",
};

const TOM_OPTIONS = [
    { value: "profissional", label: "Profissional" },
    { value: "casual", label: "Casual" },
    { value: "tecnico", label: "Técnico" },
    { value: "educativo", label: "Educativo" },
];

const NICHE_SUGGESTIONS = [
    "Mercado Imobiliário",
    "Investimentos e Finanças",
    "Marketing Digital",
    "Tecnologia e IA",
    "E-commerce",
    "Advocacia e Direito",
    "Saúde e Bem-estar",
    "Gastronomia",
    "Turismo e Viagens",
    "Educação",
    "Moda e Beleza",
    "Construção Civil",
];

const frequencies = [
    { value: 1, label: "1 post/dia" },
    { value: 3, label: "3 posts/dia" },
    { value: 5, label: "5 posts/dia" },
    { value: 7, label: "7 posts/dia" },
];

export function WhatsAppSection({ onConnected }: WhatsAppSectionProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Plan and nichos
    const [plan, setPlan] = useState<Plan>("starter");
    const [nichos, setNichos] = useState<Nicho[]>([{ nome_nicho: "", tom_de_voz: "profissional", ativo: true }]);
    const [frequency, setFrequency] = useState(3);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Get authenticated user on mount
    useEffect(() => {
        async function initUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            } else {
                // Development fallback - valid UUID format
                setUserId("00000000-0000-0000-0000-000000000001");
            }
        }
        initUser();
    }, []);

    const maxNichos = PLAN_LIMITS[plan];

    useEffect(() => {
        if (userId) {
            checkConnection();
            loadNichos();
        }
    }, [userId]);

    async function checkConnection() {
        setLoading(true);
        try {
            // Check for connected WhatsApp instance
            const { data: instances } = await supabase
                .from("whatsapp_instances")
                .select("*")
                .eq("status", "connected")
                .limit(1);

            if (instances && instances.length > 0) {
                setIsConnected(true);
                setConnectedPhone(instances[0].phone_connected);
            }

            // Load agent profile with plan
            const { data: profiles } = await supabase
                .from("agent_profiles")
                .select("*")
                .limit(1);

            if (profiles && profiles.length > 0) {
                setPlan((profiles[0].plan as Plan) || "starter");
                setFrequency(profiles[0].post_frequency || 3);
            }
        } catch (error) {
            console.error("Error checking connection:", error);
        }
        setLoading(false);
    }

    async function loadNichos() {
        try {
            const { data } = await supabase
                .from("nichos_usuario")
                .select("*")
                .eq("user_id", userId)
                .eq("ativo", true)
                .order("created_at", { ascending: true });

            if (data && data.length > 0) {
                setNichos(data.map(n => ({
                    id: n.id,
                    nome_nicho: n.nome_nicho,
                    tom_de_voz: n.tom_de_voz || "profissional",
                    ativo: n.ativo,
                })));
            }
        } catch (error) {
            console.error("Error loading nichos:", error);
        }
    }

    function handleConnected(phone: string) {
        setIsConnected(true);
        setConnectedPhone(phone);
        onConnected?.(phone);
    }

    function addNicho() {
        if (nichos.length >= maxNichos) {
            setShowUpgradeModal(true);
            return;
        }
        setNichos([...nichos, { nome_nicho: "", tom_de_voz: "profissional", ativo: true }]);
    }

    function removeNicho(index: number) {
        if (nichos.length <= 1) return;
        setNichos(nichos.filter((_, i) => i !== index));
    }

    function updateNicho(index: number, field: keyof Nicho, value: string | boolean) {
        const updated = [...nichos];
        updated[index] = { ...updated[index], [field]: value };
        setNichos(updated);
    }

    async function saveNichos() {
        setSaving(true);
        try {
            const validNichos = nichos.filter(n => n.nome_nicho.trim() !== "");

            // Delete existing nichos
            await supabase
                .from("nichos_usuario")
                .delete()
                .eq("user_id", userId);

            // Insert new nichos
            if (validNichos.length > 0) {
                await supabase
                    .from("nichos_usuario")
                    .insert(validNichos.map(n => ({
                        user_id: userId,
                        nome_nicho: n.nome_nicho,
                        tom_de_voz: n.tom_de_voz,
                        ativo: true,
                    })));
            }

            // Update agent_profile frequency
            const { data: existing } = await supabase
                .from("agent_profiles")
                .select("id")
                .eq("user_id", userId)
                .limit(1);

            if (existing && existing.length > 0) {
                await supabase
                    .from("agent_profiles")
                    .update({ post_frequency: frequency })
                    .eq("id", existing[0].id);
            } else {
                await supabase.from("agent_profiles").insert({
                    user_id: userId,
                    plan: "starter",
                    post_frequency: frequency,
                });
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Error saving nichos:", error);
        }
        setSaving(false);
    }

    // Wait for auth to be ready
    if (!userId || loading) {
        return (
            <div className="bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-xl p-6">
                <div className="animate-pulse flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#25D366]/30 rounded-full"></div>
                    <div className="flex-1">
                        <div className="h-4 bg-[#25D366]/30 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-[#25D366]/20 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Not connected - show connect button
    if (!isConnected) {
        return (
            <div className="bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                            Conexão WhatsApp
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Conecte seu WhatsApp para receber aprovações e interagir com a IA
                        </p>
                    </div>
                    <WhatsAppConnect userId={userId!} onConnected={handleConnected} />
                </div>
            </div>
        );
    }

    // Connected - show status and config fields
    return (
        <>
            <div className="bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border border-[#25D366]/20 rounded-xl p-6 space-y-6">
                {/* Connection Status + Plan Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[#25D366]">
                                WhatsApp Conectado
                            </h2>
                            {connectedPhone && (
                                <p className="text-sm text-[var(--text-secondary)]">
                                    {connectedPhone}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${plan === "business"
                            ? "bg-blue-100 text-blue-700"
                            : plan === "authority"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                            {PLAN_NAMES[plan]} • {PLAN_PRICES[plan]}
                        </span>
                        <span className="flex items-center gap-2 px-3 py-1 bg-[#25D366]/20 text-[#25D366] rounded-full text-sm font-medium">
                            <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse"></span>
                            Online
                        </span>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#25D366]/20"></div>

                {/* Nichos Configuration */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-md font-medium text-[var(--text-primary)]">
                                Nichos de Notícias
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {plan === "starter"
                                    ? "1 nicho disponível • Faça upgrade para mais"
                                    : plan === "business"
                                        ? `Até ${maxNichos} nichos no plano Business`
                                        : "Nichos ilimitados no plano Authority"
                                }
                            </p>
                        </div>
                        <span className="text-sm text-[var(--text-secondary)] font-medium">
                            {nichos.filter(n => n.nome_nicho.trim()).length}/{maxNichos === 999 ? "∞" : maxNichos}
                        </span>
                    </div>

                    {/* Niche Inputs with Tom de Voz */}
                    <div className="space-y-4">
                        {nichos.map((nicho, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 border border-[var(--border)] space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 bg-[#25D366] text-white rounded-full flex items-center justify-center text-xs font-bold">
                                        {index + 1}
                                    </span>
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                        Nicho #{index + 1}
                                    </span>
                                    {nichos.length > 1 && (
                                        <button
                                            onClick={() => removeNicho(index)}
                                            className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                <input
                                    type="text"
                                    value={nicho.nome_nicho}
                                    onChange={(e) => updateNicho(index, "nome_nicho", e.target.value)}
                                    placeholder={`Ex: ${NICHE_SUGGESTIONS[index % NICHE_SUGGESTIONS.length]}`}
                                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]"
                                    list={`niche-suggestions-${index}`}
                                />
                                <datalist id={`niche-suggestions-${index}`}>
                                    {NICHE_SUGGESTIONS.map(s => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>

                                <div className="flex gap-2 flex-wrap">
                                    {TOM_OPTIONS.map(tom => (
                                        <button
                                            key={tom.value}
                                            onClick={() => updateNicho(index, "tom_de_voz", tom.value)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${nicho.tom_de_voz === tom.value
                                                ? "bg-[#25D366] text-white"
                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                }`}
                                        >
                                            {tom.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Niche Button */}
                    <button
                        onClick={addNicho}
                        className={`w-full py-3 border-2 border-dashed rounded-lg text-sm font-medium transition-all ${nichos.length >= maxNichos
                            ? "border-amber-300 text-amber-600 hover:bg-amber-50"
                            : "border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/5"
                            }`}
                    >
                        {nichos.length >= maxNichos
                            ? `+ Upgrade para ${plan === "starter" ? "Business" : "Authority"} para mais nichos`
                            : "+ Adicionar Novo Nicho"
                        }
                    </button>
                </div>

                {/* Frequency Selection */}
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Frequência de Posts
                    </label>
                    <div className="flex gap-2">
                        {frequencies.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setFrequency(f.value)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${frequency === f.value
                                    ? "bg-[#25D366] text-white"
                                    : "bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#25D366]"
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={saveNichos}
                    disabled={saving || nichos.every(n => !n.nome_nicho.trim())}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${saved
                        ? "bg-[#25D366] text-white"
                        : "bg-[var(--accent)] text-white hover:opacity-90"
                        } disabled:opacity-50`}
                >
                    {saving ? "Salvando..." : saved ? "✓ Configuração Salva!" : "Salvar Nichos e Configuração"}
                </button>
            </div>

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUpgradeModal(false)}>
                    <div
                        className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                Quer Dominar mais Nichos?
                            </h2>
                            <p className="text-gray-600">
                                Você atingiu o limite do plano {PLAN_NAMES[plan]}. Faça upgrade para expandir sua presença!
                            </p>
                        </div>

                        {/* Plan Options */}
                        <div className="space-y-3 mb-6">
                            {plan === "starter" && (
                                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-blue-700">Business</span>
                                        <span className="text-lg font-bold text-blue-700">R$ 197/mês</span>
                                    </div>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                        <li>✓ Até <strong>3 nichos</strong> diferentes</li>
                                        <li>✓ 7 posts por dia</li>
                                        <li>✓ Suporte prioritário</li>
                                    </ul>
                                </div>
                            )}
                            <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-4 border-2 border-amber-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-amber-700">Authority</span>
                                    <span className="text-lg font-bold text-amber-700">R$ 497/mês</span>
                                </div>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>✓ <strong>Nichos ilimitados</strong></li>
                                    <li>✓ Posts ilimitados</li>
                                    <li>✓ Suporte VIP 24/7</li>
                                    <li>✓ API de integração</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="flex-1 py-3 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50"
                            >
                                Depois
                            </button>
                            <button
                                onClick={() => {
                                    // TODO: Implement Stripe checkout
                                    alert("Integração Stripe em breve!");
                                    setShowUpgradeModal(false);
                                }}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90"
                            >
                                Fazer Upgrade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
