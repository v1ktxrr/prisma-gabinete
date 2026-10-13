"use client";

import {
    CalendarDays,
    BarChart3,
    RefreshCw,
    LogOut
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import Image from "next/image";
import BuscaGlobal from "./busca-global";
interface HeaderProps {
    onRefresh?: () => void;
    loading?: boolean;
}

export default function Header({ onRefresh, loading = false }: HeaderProps) {
    const { profile, signOut } = useAuth();
    const { currentView, setView } = useAppStore();

    const initials = profile?.nome
        ? profile.nome
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?";

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">

                {/* Left: Logo & Navigation */}
                <div className="flex items-center justify-between md:justify-start md:gap-8">
                    {/* Logo */}
                    <button onClick={() => setView('calendar')} className="group flex items-center outline-none">
                        <Image
                            src="/icone-prisma.png"
                            alt="Prisma by GovTech"
                            width={48}
                            height={48}
                            className="h-10 w-10 md:h-12 md:w-12 object-contain transition-all duration-300 ease-out group-hover:scale-110 group-hover:-rotate-12 group-hover:drop-shadow-lg"
                            priority
                        />
                    </button>

                    {/* Navigation Tabs (Mobile: Show as icons next to logo, Desktop: full tabs) */}
                    <nav className="flex items-center gap-1 md:gap-2">
                        <button
                            onClick={() => setView('calendar')}
                            className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 ${currentView === "calendar"
                                ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                }`}
                        >
                            <CalendarDays className={`h-4 w-4 transition-transform duration-300 ${currentView !== "calendar" && "group-hover:scale-110"}`} />
                            <span className="hidden sm:inline">Calendário</span>
                        </button>

                        <button
                            onClick={() => setView('reports')}
                            className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 ${currentView === "reports"
                                ? "bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                }`}
                        >
                            <BarChart3 className={`h-4 w-4 transition-transform duration-300 ${currentView !== "reports" && "group-hover:scale-110"}`} />
                            <span className="hidden sm:inline">Relatórios</span>
                        </button>
                    </nav>
                </div>

                {/* Right: User info + actions */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted hover:text-foreground border border-border shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">Atualizar</span>
                        </button>
                    )}

                    {/* User Avatar / Name */}
                    <button
                        onClick={() => setView('profile')}
                        className={`group flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm transition-all hover:bg-muted hover:border-border ${currentView === 'profile'
                            ? "bg-muted border-border"
                            : "bg-card border-border"
                            }`}
                        title="Meu Perfil"
                    >
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.nome}
                                className="h-6 w-6 rounded-full object-cover transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white transition-transform group-hover:scale-105">
                                {initials}
                            </div>
                        )}
                        <span className="hidden text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground md:block">
                            {profile?.nome || "Usuário"}
                        </span>
                    </button>

                    <button
                        onClick={signOut}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 shadow-sm"
                        title="Sair"
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Sair</span>
                    </button>
                </div>
            </div>

            {/* Modal de Busca Global invisível até acionado */}
            <BuscaGlobal />
        </header>
    );
}
