"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import AppSidebar from "@/components/app-sidebar";
import { Menu, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function AuthenticatedShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { profile, loading: authLoading } = useAuth();
    const isLoginRoute = pathname === "/login";
    const isPrintRoute = pathname.endsWith("/print") || pathname.includes("/print/");

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [prevPathname, setPrevPathname] = useState(pathname);
    
    // Configs do Sistema
    const [broadcast, setBroadcast] = useState<{ativo: boolean, mensagem: string, tipo: string} | null>(null);
    const [isSuspended, setIsSuspended] = useState(false);
    const [configsLoading, setConfigsLoading] = useState(true);

    // Reset mobile open state when navigating
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setIsMobileOpen(false);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        const saved = localStorage.getItem("prisma-sidebar-collapsed");
        if (saved === "true") {
            setIsCollapsed(true);
        }

        // Fetch global configs
        const fetchConfigs = async () => {
            try {
                // To avoid dealing with cookies manually here, we use fetch to our own API 
                // or use supabase anon client. But let's just use anon client since it's public.
                const { createBrowserClient } = await import('@supabase/ssr');
                const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                
                const { data: config } = await supabase
                    .from('configuracoes_sistema')
                    .select('valor')
                    .eq('chave', 'broadcast_banner')
                    .single();
                
                if (config?.valor) setBroadcast(config.valor);

                // Check unit status if profile exists
                if (profile?.unidade_id) {
                    const { data: unidade } = await supabase
                        .from('unidades')
                        .select('status')
                        .eq('id', profile.unidade_id)
                        .single();
                    
                    if (unidade?.status === 'suspenso') {
                        setIsSuspended(true);
                    }
                }
            } catch (e) {
                console.error("Erro ao checar configurações globais:", e);
            } finally {
                setConfigsLoading(false);
            }
        };

        if (!authLoading) {
            fetchConfigs();
        }
    }, [profile?.unidade_id, authLoading]);

    const toggleCollapse = () => {
        const nextState = !isCollapsed;
        setIsCollapsed(nextState);
        localStorage.setItem("prisma-sidebar-collapsed", String(nextState));
    };

    if (isLoginRoute) {
        return <>{children}</>;
    }

    if (configsLoading && !isLoginRoute && profile) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>;
    }

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md w-full">
                    <h1 className="text-xl font-bold text-red-500 mb-2">Acesso Suspenso</h1>
                    <p className="text-sm text-slate-400 mb-6">
                        O gabinete/unidade '{profile?.unidade_id}' encontra-se com acesso suspenso no sistema Prisma. 
                        Entre em contato com o suporte ou com a sua chefia para mais detalhes.
                    </p>
                    <Link href="/login" onClick={() => localStorage.clear()} className="inline-block bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        Voltar para Login
                    </Link>
                </div>
            </div>
        );
    }

    if (isPrintRoute) {
        return <>{children}</>;
    }

    const initials = profile?.nome
        ? profile.nome
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?";

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950 flex flex-col lg:flex-row">
            {broadcast?.ativo && (
                <div className={`fixed top-0 left-0 right-0 z-50 text-center text-xs font-bold px-4 py-2 text-white shadow-md
                    ${broadcast.tipo === 'warning' ? 'bg-amber-600' : broadcast.tipo === 'error' ? 'bg-red-600' : 'bg-violet-600'}
                `}>
                    {broadcast.mensagem}
                </div>
            )}
            
            {/* Mobile Header */}
            <header className={`sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white/85 backdrop-blur-md px-4 shadow-xs lg:hidden ${broadcast?.ativo ? 'mt-8' : ''}`}>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsMobileOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
                        aria-label="Abrir menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-transparent">
                            <img src="/icone-prisma.png" alt="Prisma" className="h-7 w-7 object-contain" />
                        </div>
                        <span className="font-display text-sm font-extrabold tracking-tight text-slate-950">
                            Prisma
                        </span>
                    </div>
                </div>

                <Link href="/profile" className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-50 transition-all cursor-pointer">
                    {profile?.avatar_url ? (
                        <img
                            src={profile.avatar_url}
                            alt={profile.nome || "Usuário"}
                            className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                    ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {initials}
                        </div>
                    )}
                </Link>
            </header>

            {/* Backdrop Blur Overlay for Mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-45 bg-slate-950/20 backdrop-blur-xs transition-opacity duration-300 lg:hidden cursor-pointer"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* AppSidebar */}
            <div className={`${broadcast?.ativo ? 'lg:pt-8' : ''}`}>
                <AppSidebar
                    isCollapsed={mounted ? isCollapsed : false}
                    onToggleCollapse={toggleCollapse}
                    isMobileOpen={isMobileOpen}
                    onCloseMobile={() => setIsMobileOpen(false)}
                />
            </div>

            {/* Main Content Area */}
            <div className={`min-w-0 flex-1 flex flex-col ${broadcast?.ativo ? 'pt-8 lg:pt-8' : ''}`}>
                <div className="flex-1">
                    {children}
                </div>
                <footer className="w-full border-t border-slate-200 bg-white py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    © 2026 - Prisma App
                </footer>
            </div>
        </div>
    );
}
