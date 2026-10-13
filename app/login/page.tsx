"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && user) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // Limpeza preventiva: destrói qualquer sessão residual/corrompida
        await supabase.auth.signOut();

        try {
            const cleanEmail = email.trim().toLowerCase();
            if (isSignUp) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email: cleanEmail,
                    password,
                    options: {
                        data: {
                            full_name: cleanEmail.split("@")[0],
                            cargo: "assessoria",
                            unidade_id: "CG",
                            modulos_acesso: ["agenda_global_ver"],
                        },
                    },
                });
                if (signUpError) throw signUpError;
                setSuccess("Conta criada. Verifique seu e-mail.");
                setIsSignUp(false);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
                if (signInError) throw signInError;
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Erro ao autenticar.");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full">
            {/* ─── Esquerda: Formulário ─── */}
            <div className="flex w-full flex-col justify-center bg-white px-6 lg:w-1/2 lg:px-16 xl:px-24">
                <div className="mx-auto w-full max-w-sm">
                    {/* Logo */}
                    <div className="mb-12">
                        <Image
                            src="/icone-prisma.png"
                            alt="Prisma by GovTech"
                            width={48}
                            height={48}
                            className="h-12 w-12 object-contain"
                            priority
                        />
                    </div>

                    {/* Título */}
                    <div className="mb-10">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                            Acesso restrito
                        </h1>
                        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
                            Entre com seu e-mail institucional e senha.
                        </p>
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                                E-mail Institucional
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    placeholder="seu.nome@gov.br"
                                />
                            </div>
                        </div>

                        {/* Senha */}
                        <div>
                            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Alertas */}
                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                                {success}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-md hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    {isSignUp ? "Solicitar acesso" : "Entrar"}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <p className="mt-10 text-center text-sm text-slate-500">
                            {isSignUp ? "Já tem acesso?" : "Ainda não tem acesso?"}{" "}
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }}
                            className="font-semibold text-primary hover:text-primary-hover hover:underline underline-offset-2"
                        >
                            {isSignUp ? "Entrar" : "Solicitar acesso"}
                        </button>
                    </p>

                    {/* Micro-rodapé */}
                    <p className="mt-16 text-center text-[11px] text-slate-400">
                        <span className="font-medium">Prisma</span> by GovTech
                    </p>
                </div>
            </div>

            {/* ─── Direita: Hero Institucional ─── */}
            <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center bg-gradient-to-br from-primary via-primary-hover to-[#0b2875]">
                {/* Elementos decorativos sutis */}
                <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />

                {/* Conteúdo Central */}
                <div className="relative z-10 flex flex-col items-center px-12">
                    {/* Logo com interação no hover */}
                    <Image
                        src="/logo-prisma.png"
                        alt="Prisma"
                        width={480}
                        height={160}
                        className="h-28 w-auto md:h-36 xl:h-48 object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.3)] hover:scale-110 hover:-rotate-6 hover:drop-shadow-[0_30px_60px_rgba(255,255,255,0.2)] transition-all duration-300 cursor-pointer"
                        style={{ filter: "brightness(0) invert(1)" }}
                        priority
                    />

                    {/* Texto de Autoridade */}
                    <div className="mt-16 text-center">
                        <h2 className="text-3xl font-bold leading-snug tracking-tight text-white xl:text-4xl">
                            Clareza absoluta para
                            <br />
                            <span className="font-semibold text-white/80">decisões estratégicas.</span>
                        </h2>
                    </div>
                </div>
            </div>
        </div>
    );
}
