"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type ConnectionStatus = "idle" | "connecting" | "qr_ready" | "connected" | "error";

interface WhatsAppConnectProps {
    userId?: string;
    onConnected?: (phone: string) => void;
}

export function WhatsAppConnect({ userId = "demo-user", onConnected }: WhatsAppConnectProps) {
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [instanceId, setInstanceId] = useState<string | null>(null);
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // 1-Click Connect: Create instance automatically
    const handleConnect = async () => {
        setStatus("connecting");
        setError(null);
        setShowModal(true);

        try {
            const response = await fetch(`${supabaseUrl}/functions/v1/instance-manager/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            });

            const data = await response.json();
            console.log("Connect response:", data);

            if (data.status === "already_connected") {
                setStatus("connected");
                setConnectedPhone(data.phone);
                onConnected?.(data.phone);
            } else if (data.success && data.instance_id) {
                setInstanceId(data.instance_id);
                if (data.qr_code) {
                    setQrCode(data.qr_code);
                }
                setStatus("qr_ready");
            } else {
                throw new Error(data.error || "Falha ao criar conexão");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro desconhecido");
            setStatus("error");
        }
    };

    // Poll for QR Code updates
    const pollQRCode = useCallback(async () => {
        if (!instanceId) return;

        try {
            const response = await fetch(
                `${supabaseUrl}/functions/v1/instance-manager/qr-code?instance_id=${instanceId}`
            );
            const data = await response.json();
            console.log("QR Code poll response:", data);

            if (data.qr_code) {
                setQrCode(data.qr_code);
            }
        } catch (err) {
            console.error("QR Code poll error:", err);
        }
    }, [instanceId, supabaseUrl]);

    // Poll for connection status
    const pollStatus = useCallback(async () => {
        if (!instanceId) return;

        try {
            const response = await fetch(
                `${supabaseUrl}/functions/v1/instance-manager/status?instance_id=${instanceId}`
            );
            const data = await response.json();

            if (data.status === "connected") {
                setStatus("connected");
                setConnectedPhone(data.phone);
                onConnected?.(data.phone);
            }
        } catch (err) {
            console.error("Status poll error:", err);
        }
    }, [instanceId, supabaseUrl, onConnected]);

    // Cancel and delete instance from Uazapi
    const handleCancel = async () => {
        if (instanceId && status !== "connected") {
            try {
                await fetch(
                    `${supabaseUrl}/functions/v1/instance-manager/cancel?instance_id=${instanceId}`,
                    { method: "POST" }
                );
                console.log("Instance cancelled and deleted from Uazapi");
            } catch (err) {
                console.error("Cancel error:", err);
            }
        }
        // Reset state
        setInstanceId(null);
        setQrCode(null);
        setStatus("idle");
        setShowModal(false);
    };

    // Polling effect
    useEffect(() => {
        if (status === "qr_ready" && instanceId) {
            const qrInterval = setInterval(pollQRCode, 3000);
            const statusInterval = setInterval(pollStatus, 2000);

            return () => {
                clearInterval(qrInterval);
                clearInterval(statusInterval);
            };
        }
    }, [status, instanceId, pollQRCode, pollStatus]);

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#128C7E] transition-colors font-medium"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span>Conectar WhatsApp</span>
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancel}>
                    <div
                        className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Conectar WhatsApp</h2>
                            <button
                                onClick={handleCancel}
                                className="text-[var(--muted)] hover:text-[var(--foreground)] text-xl"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Connecting */}
                        {status === "connecting" && (
                            <div className="flex flex-col items-center py-12">
                                <div className="w-16 h-16 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mb-6"></div>
                                <p className="text-[var(--muted)] text-lg">Preparando sua conexão...</p>
                                <p className="text-[var(--muted)] text-sm mt-2">Isso leva apenas alguns segundos</p>
                            </div>
                        )}

                        {/* QR Code Ready */}
                        {status === "qr_ready" && (
                            <div className="flex flex-col items-center py-4">
                                <p className="text-[var(--muted)] text-sm mb-4">
                                    Escaneie o QR Code com seu WhatsApp
                                </p>
                                <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center p-4 shadow-inner">
                                    {qrCode ? (
                                        <Image
                                            src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                                            alt="QR Code WhatsApp"
                                            width={240}
                                            height={240}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin"></div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-6 text-[var(--muted)]">
                                    <div className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse"></div>
                                    <p className="text-sm">Aguardando você escanear...</p>
                                </div>
                                <p className="text-xs text-[var(--muted)] mt-2">
                                    Abra o WhatsApp → Menu → Dispositivos Conectados → Conectar
                                </p>
                            </div>
                        )}

                        {/* Connected */}
                        {status === "connected" && (
                            <div className="flex flex-col items-center py-8">
                                <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-[#25D366] mb-2">Conectado!</h3>
                                {connectedPhone && (
                                    <p className="text-[var(--muted)] text-lg">{connectedPhone}</p>
                                )}
                                <p className="text-[var(--muted)] text-sm mt-4 text-center">
                                    Seu agente QWEI está pronto para trabalhar!
                                </p>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="mt-8 px-8 py-3 bg-[#25D366] text-white rounded-lg font-medium hover:bg-[#128C7E] transition-colors"
                                >
                                    Começar a usar
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {status === "error" && (
                            <div className="flex flex-col items-center py-8">
                                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-red-500 mb-2">Ops!</h3>
                                <p className="text-[var(--muted)] text-center">{error}</p>
                                <button
                                    onClick={handleConnect}
                                    className="mt-6 px-6 py-2 bg-[var(--sidebar)] rounded-lg hover:bg-[var(--border)] transition-colors"
                                >
                                    Tentar novamente
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
