"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
    Terminal,
    Database,
    Cpu,
    Activity,
    Loader2,
    LogOut,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import { ToastContainer, ToastState } from "@/components/agenda-shared";
import { DevUsersTab } from "@/components/deviktor/dev-users-tab";
import { DevConfigsTab } from "@/components/deviktor/dev-configs-tab";
import { DevUnidadesTab } from "@/components/deviktor/dev-unidades-tab";
import { DevStorageTab } from "@/components/deviktor/dev-storage-tab";
import { DevHealthTab } from "@/components/deviktor/dev-health-tab";
import { DevDomainsTab } from "@/components/deviktor/dev-domains-tab";
import { DevTriggersTab } from "@/components/deviktor/dev-triggers-tab";
import { DevLogsTab, DevLogsTabRef } from "@/components/deviktor/dev-logs-tab";

export default function DevCockpitPage() {
    const { user, loading: authLoading, signOut } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"dominios" | "gatilhos" | "logs" | "usuarios" | "configs" | "unidades" | "storage" | "health">("usuarios");
    const [toasts, setToasts] = useState<ToastState[]>([]);
    const logsTabRef = useRef<DevLogsTabRef>(null);

    // MFA States
    const [mfaVerified, setMfaVerified] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(true);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [factorId, setFactorId] = useState("");
    const [qrCode, setQrCode] = useState("");
    const [secretCode, setSecretCode] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [verifyingCode, setVerifyingCode] = useState(false);

    const addToast = (message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };

    const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

    const checkBackendMfaReq = async () => {
        try {
            const res = await fetch("/api/deviktor-sys/health");
            if (res.status === 403) {
                const data = await res.json().catch(() => ({}));
                if (data.error === "MFA_REQUIRED") {
                    return true;
                }
            }
            if (res.ok) {
                return false; // Bypass or already elevated
            }
        } catch (e) {
            console.error("Erro checkBackendMfaReq:", e);
        }
        return true; // Default safe option
    };

    const checkMfaStatus = async () => {
        setMfaLoading(true);
        try {
            const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalError) throw aalError;

            if (aalData?.currentLevel === "aal2") {
                setMfaVerified(true);
                setMfaLoading(false);
                return;
            }

            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (factorsError) throw factorsError;

            const verifiedFactors = factors?.all?.filter(f => f.status === "verified") || [];
            if (verifiedFactors.length > 0) {
                setIsEnrolled(true);
                setFactorId(verifiedFactors[0].id);
            } else {
                setIsEnrolled(false);
                const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
                if (enrollError) throw enrollError;

                setFactorId(enrollData.id);
                if (enrollData.totp?.qr_code) {
                    setQrCode(enrollData.totp.qr_code);
                }
                if (enrollData.totp?.secret) {
                    setSecretCode(enrollData.totp.secret);
                }
            }
        } catch (err: any) {
            addToast("Erro ao carregar MFA: " + err.message, "error");
        } finally {
            setMfaLoading(false);
        }
    };

    const handleMfaVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaCode || mfaCode.length < 6) {
            addToast("Digite o código de 6 dígitos.", "error");
            return;
        }

        setVerifyingCode(true);
        try {
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
            if (challengeError) throw challengeError;

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challengeData.id,
                code: mfaCode,
            });
            if (verifyError) throw verifyError;

            addToast("MFA verificado e privilégios elevados com sucesso!", "success");
            setMfaVerified(true);
        } catch (err: any) {
            addToast("Falha na validação do MFA: " + err.message, "error");
        } finally {
            setVerifyingCode(false);
        }
    };

    // Client auth guards
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.replace("/login");
            } else {
                checkBackendMfaReq().then((req) => {
                    if (!req) {
                        setMfaVerified(true);
                        setMfaLoading(false);
                    } else {
                        checkMfaStatus();
                    }
                });
            }
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mr-2" />
                <span>Validando credenciais de root...</span>
            </div>
        );
    }

    if (mfaLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-450">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500 mr-2" />
                <span>Verificando autenticação multifator (MFA)...</span>
            </div>
        );
    }

    if (!mfaVerified) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 p-4">
                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
                    <div className="flex flex-col items-center text-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-950 border border-violet-800 text-violet-400 shadow-md">
                            <Terminal className="h-6 w-6" />
                        </div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mt-2">
                            Elevação de Privilégios (MFA)
                        </h2>
                        <p className="text-xs text-slate-450 mt-0.5">
                            O Cockpit exige autenticação multifator AAL2.
                        </p>
                    </div>

                    <form onSubmit={handleMfaVerify} className="space-y-4">
                        {!isEnrolled ? (
                            <div className="space-y-4 text-center">
                                <p className="text-[11px] text-slate-350 leading-relaxed">
                                    Nenhum dispositivo de MFA cadastrado. Escaneie o QR Code abaixo com seu app autenticador:
                                </p>
                                {qrCode ? (
                                    <div className="bg-white p-3 rounded-xl inline-block mx-auto border-4 border-slate-700">
                                        <img src={qrCode} alt="QR Code MFA" className="h-40 w-40" />
                                    </div>
                                ) : (
                                    <div className="h-40 w-40 bg-slate-950 rounded-xl flex items-center justify-center border border-slate-800 text-slate-500 mx-auto font-mono text-[10px]">
                                        Gerando QR Code...
                                    </div>
                                )}
                                {secretCode && (
                                    <div className="text-[9px] text-slate-500 font-mono select-all">
                                        Chave: {secretCode}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-355 text-center leading-relaxed">
                                Digite o código de 6 dígitos gerado no seu aplicativo autenticador.
                            </p>
                        )}

                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wide">Código TOTP</label>
                            <input
                                type="text"
                                maxLength={6}
                                placeholder="000000"
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                                className="w-full text-center tracking-[0.4em] text-lg font-mono rounded-lg border border-slate-800 bg-slate-950 py-2.5 px-3 text-white outline-none focus:border-violet-500/50"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={verifyingCode}
                            className="w-full inline-flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-500/20"
                        >
                            {verifyingCode ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                            <span>Autenticar & Elevar</span>
                        </button>
                    </form>

                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-4 text-xs">
                        <button
                            onClick={() => signOut().then(() => router.replace("/login"))}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            Sair da Conta
                        </button>
                        <Link href="/dashboard" className="text-violet-400 hover:underline">
                            Voltar ao Portal
                        </Link>
                    </div>
                </div>
                <ToastContainer toasts={toasts} onRemove={removeToast} />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
                <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-sans">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20 font-black">
                            <Terminal className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="font-display font-black tracking-tight text-white text-lg">
                                Cockpit de Root
                            </h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                Infraestrutura & Mantenedores
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-xs font-mono border border-slate-700">
                            {user.email}
                        </span>
                        <button
                            onClick={() => signOut().then(() => router.replace("/login"))}
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-sans"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8 flex flex-col gap-6">
                {/* Tab Navigation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-px overflow-x-auto hide-scrollbar">
                    <div className="flex gap-2 min-w-max font-sans">
                        <button
                            onClick={() => setActiveTab("usuarios")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "usuarios"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Database className="h-4 w-4" />
                            Usuários
                        </button>
                        <button
                            onClick={() => setActiveTab("unidades")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "unidades"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Database className="h-4 w-4" />
                            Unidades
                        </button>
                        <button
                            onClick={() => setActiveTab("configs")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "configs"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Activity className="h-4 w-4" />
                            Configurações
                        </button>
                        <button
                            onClick={() => setActiveTab("storage")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "storage"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Database className="h-4 w-4" />
                            Storage
                        </button>
                        <button
                            onClick={() => setActiveTab("health")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "health"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Activity className="h-4 w-4" />
                            Health
                        </button>
                        <button
                            onClick={() => setActiveTab("dominios")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "dominios"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Database className="h-4 w-4" />
                            Domínios
                        </button>
                        <button
                            onClick={() => setActiveTab("gatilhos")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "gatilhos"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Cpu className="h-4 w-4" />
                            Infra Triggers
                        </button>
                        <button
                            onClick={() => setActiveTab("logs")}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === "logs"
                                    ? "border-violet-500 text-violet-400"
                                    : "border-transparent text-slate-500 hover:text-slate-350"
                            }`}
                        >
                            <Activity className="h-4 w-4" />
                            Logs de Sistema
                        </button>
                    </div>
                    
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-1.5 text-xs font-bold transition-all font-sans"
                    >
                        <span>Voltar ao Portal</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 animate-in fade-in duration-200 mt-4">
                    {/* TAB USUARIOS */}
                    {activeTab === "usuarios" && (
                        <DevUsersTab addToast={addToast} />
                    )}

                    {/* TAB UNIDADES */}
                    {activeTab === "unidades" && (
                        <DevUnidadesTab addToast={addToast} />
                    )}

                    {/* TAB CONFIGS */}
                    {activeTab === "configs" && (
                        <DevConfigsTab addToast={addToast} />
                    )}

                    {/* TAB STORAGE */}
                    {activeTab === "storage" && (
                        <DevStorageTab addToast={addToast} />
                    )}

                    {/* TAB HEALTH */}
                    {activeTab === "health" && (
                        <DevHealthTab addToast={addToast} />
                    )}

                    {/* TAB DOMINIOS */}
                    {activeTab === "dominios" && (
                        <DevDomainsTab addToast={addToast} />
                    )}

                    {/* TAB GATILHOS */}
                    {activeTab === "gatilhos" && (
                        <DevTriggersTab addToast={addToast} onTriggerSuccess={() => logsTabRef.current?.refreshLogs()} />
                    )}

                    {/* TAB LOGS */}
                    {activeTab === "logs" && (
                        <DevLogsTab ref={logsTabRef} addToast={addToast} />
                    )}
                </div>
            </main>

            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
