"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { WhatsAppSection } from "@/components/WhatsAppSection";
import { NicheManager } from "@/components/NicheManager";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            // Use authenticated user or fallback for demo
            setUserId(user?.id || "00000000-0000-0000-0000-000000000001");
            setLoading(false);
        }
        getUser();
    }, []);

    if (loading) {
        return (
            <div className="max-w-2xl animate-pulse">
                <div className="h-8 w-48 bg-[var(--sidebar)] rounded mb-8"></div>
                <div className="h-32 bg-[var(--sidebar)] rounded-lg mb-8"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-8">
            {/* Header */}
            <header>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                    <SettingsIcon className="w-6 h-6" />
                    Configurações
                </h1>
                <p className="text-[var(--text-secondary)]">
                    Gerencie sua conexão WhatsApp e nichos de atuação
                </p>
            </header>

            {/* WhatsApp Connection */}
            <WhatsAppSection onConnected={(phone) => console.log('Connected:', phone)} />

            {/* Niche Manager */}
            {userId && <NicheManager userId={userId} />}
        </div>
    );
}
