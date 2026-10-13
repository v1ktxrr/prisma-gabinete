"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut, LayoutDashboard, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function AccessDeniedPage() {
    const router = useRouter();
    const { user, loading, signOut } = useAuth();

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push("/login");
        } catch (error) {
            console.error("Erro ao deslogar:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100 selection:bg-red-500/20">
            {/* Ambient background glows */}
            <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-red-900/10 blur-[150px]" />
            <div className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-900/10 blur-[150px]" />

            <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col items-center text-center">
                    {/* Shield icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-1 ring-red-500/20 animate-pulse">
                        <ShieldAlert className="h-8 w-8" />
                    </div>

                    <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-100">
                        Acesso Restrito
                    </h1>
                    
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                        A rota <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-red-400 font-mono">/deviktor-sys</code> é restrita exclusivamente a desenvolvedores credenciados. Seu perfil atual não possui privilégios de administrador de infraestrutura.
                    </p>

                    {user && (
                        <div className="mt-6 rounded-lg bg-slate-950/40 border border-slate-800 px-4 py-3 text-left w-full">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Usuário Logado</span>
                            <p className="text-sm font-medium text-slate-300 truncate mt-0.5">{user.email}</p>
                        </div>
                    )}

                    <div className="mt-8 flex flex-col gap-3 w-full">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-slate-700 active:scale-[0.98] border border-slate-700 cursor-pointer"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Ir para o Painel
                        </button>
                        
                        <button
                            onClick={handleSignOut}
                            className="flex items-center justify-center gap-2 rounded-lg bg-red-600/10 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-600 hover:text-white active:scale-[0.98] border border-red-500/20 cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            Sair e Trocar de Conta
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <p className="absolute bottom-6 text-center text-[11px] text-slate-600 font-medium">
                Prisma Security Protocol • GovTech
            </p>
        </div>
    );
}
