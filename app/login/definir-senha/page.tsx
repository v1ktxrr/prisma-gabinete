"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function DefinirSenhaPage() {
    const router = useRouter();
    
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const [verificando, setVerificando] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function checarSessao() {
            // Obter sessão atual
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                if (active) setVerificando(false);
                return;
            }

            // Se não houver sessão imediata, checar se a URL contém hash de acesso (redirecionamento do convite)
            const hash = typeof window !== "undefined" ? window.location.hash : "";
            const query = typeof window !== "undefined" ? window.location.search : "";
            const temToken = hash.includes("access_token") || query.includes("access_token");

            if (temToken) {
                // Escutar mudanças de estado para capturar quando a sessão carregar
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (session && active) {
                        setVerificando(false);
                        subscription.unsubscribe();
                    }
                });

                // Limite de tempo de 3 segundos
                const timeout = setTimeout(() => {
                    if (active) {
                        supabase.auth.getSession().then(({ data: { session } }) => {
                            if (!session) {
                                router.replace("/login");
                            } else {
                                setVerificando(false);
                            }
                        });
                    }
                }, 3000);

                return () => {
                    clearTimeout(timeout);
                    subscription.unsubscribe();
                };
            } else {
                // Sem sessão e sem token na URL
                router.replace("/login");
            }
        }

        checarSessao();

        return () => {
            active = false;
        };
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validação local
        if (password.length < 6) {
            setError("A senha deve ter no mínimo 6 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            setSuccess("Sua senha foi definida com sucesso! Bem-vindo ao Prisma.");
            
            // Redirecionamento após 2 segundos
            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);
        } catch (err: unknown) {
            console.error("[definir-senha] Erro ao atualizar senha:", err);
            setError(err instanceof Error ? err.message : "Erro ao atualizar senha.");
        } finally {
            setLoading(false);
        }
    };

    const isValido = password.length >= 6 && password === confirmPassword;

    if (verificando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-slate-500">Validando convite de segurança...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-100/50">
                {/* Logo e cabeçalho */}
                <div className="mb-8 flex flex-col items-center">
                    <Image
                        src="/icone-prisma.png"
                        alt="Prisma by GovTech"
                        width={48}
                        height={48}
                        className="h-12 w-12 object-contain"
                        priority
                    />
                    <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-800">
                        Definir sua senha
                    </h1>
                    <p className="mt-2 text-center text-[15px] leading-relaxed text-slate-500">
                        Insira sua nova senha institucional nos campos abaixo para ativar sua conta.
                    </p>
                </div>

                {/* Formulário */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Nova Senha */}
                    <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                            Nova Senha
                        </label>
                        <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                placeholder="••••••••"
                                disabled={loading || success !== null}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-[18px] w-[18px]" />
                                ) : (
                                    <Eye className="h-[18px] w-[18px]" />
                                )}
                            </button>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-400">No mínimo 6 caracteres.</p>
                    </div>

                    {/* Confirmar Nova Senha */}
                    <div>
                        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                            Confirmar Nova Senha
                        </label>
                        <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                placeholder="••••••••"
                                disabled={loading || success !== null}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff className="h-[18px] w-[18px]" />
                                ) : (
                                    <Eye className="h-[18px] w-[18px]" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Alertas */}
                    {error && (
                        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !isValido || success !== null}
                        className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-md hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none cursor-pointer"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Salvar Senha e Entrar"
                        )}
                    </button>
                </form>

                {/* Micro-rodapé */}
                <p className="mt-12 text-center text-[11px] text-slate-400">
                    <span className="font-medium">Prisma</span> by GovTech
                </p>
            </div>
        </div>
    );
}
