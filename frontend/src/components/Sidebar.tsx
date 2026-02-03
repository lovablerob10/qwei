"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Newspaper,
    Settings,
    Zap,
    Send
} from "lucide-react";

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/posts", icon: Newspaper, label: "Posts" },
    { href: "/publish", icon: Send, label: "Publicar" },
    { href: "/settings", icon: Settings, label: "Configurações" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-screen w-16 bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col items-center py-6 z-50">
            {/* Logo */}
            <div className="mb-8">
                <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-2 flex-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                group relative w-10 h-10 rounded-lg flex items-center justify-center
                transition-smooth hover:bg-[var(--border)]
                ${isActive ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}
              `}
                            title={item.label}
                        >
                            <Icon className="w-5 h-5" />

                            {/* Tooltip */}
                            <span className="absolute left-14 px-2 py-1 bg-[var(--accent)] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* QWEI Text */}
            <div className="writing-mode-vertical text-[10px] tracking-[0.3em] text-[var(--text-secondary)] font-medium rotate-180" style={{ writingMode: 'vertical-rl' }}>
                QWEI
            </div>
        </aside>
    );
}
