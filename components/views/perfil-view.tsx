"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
    User,
    Image as ImageIcon,
    Loader2,
    Save,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    X,
    Mail,
    Shield,
    Briefcase,
    Info,
    UserPlus,
    Users
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/page-header";
import { useAppStore } from "@/lib/store";
import { usePermissions } from "@/hooks/usePermissions";
import UserFormModal, { UserFormValues } from "@/components/admin/user-form-modal";
import { ToastContainer, ToastState } from "@/components/agenda-shared";

type PerfilFormProps = {
    userId: string;
    initialNome: string;
    initialAvatarUrl: string;
    onSaved: () => Promise<void>;
};

function PerfilForm({ userId, initialNome, initialAvatarUrl, onSaved }: PerfilFormProps) {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [currentNome, setCurrentNome] = useState(initialNome);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState(initialAvatarUrl);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setSaving(true);

        try {
            // Update public.profiles
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ nome: currentNome, avatar_url: currentAvatarUrl })
                .eq("id", userId);

            if (profileError) throw profileError;

            // Update public.perfis_usuarios
            const { error: perfisError } = await supabase
                .from("perfis_usuarios")
                .update({ nome: currentNome })
                .eq("id", userId);

            if (perfisError) throw perfisError;

            setMessage({ type: "success", text: "Perfil atualizado com sucesso no gabinete!" });
            await onSaved();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Não consegui atualizar o perfil.";
            setMessage({ type: "error", text: msg });
        } finally {
            setSaving(false);
        }
    };

    const initials = currentNome
        ? currentNome
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?";

    return (
        <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Preview */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-2 ring-slate-200 transition-all duration-300 hover:scale-[1.02] mx-auto sm:mx-0">
                    {currentAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={currentAvatarUrl}
                            alt="Avatar"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary to-blue-600 text-2xl font-extrabold text-white tracking-wider">
                            {initials}
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        URL da Foto de Perfil
                    </label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <ImageIcon className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="url"
                            value={currentAvatarUrl}
                            onChange={(e) => setCurrentAvatarUrl(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                            placeholder="https://exemplo.com/minha-foto.jpg"
                        />
                        {currentAvatarUrl && (
                            <button
                                type="button"
                                onClick={() => setCurrentAvatarUrl("")}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                title="Limpar URL"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <span className="mt-1 block text-[10px] text-slate-400">
                        Insira a URL de uma foto hospedada online (ex: GitHub, LinkedIn).
                    </span>
                </div>
            </div>

            {/* Nome */}
            <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Nome Completo *
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        required
                        value={currentNome}
                        onChange={(e) => setCurrentNome(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        placeholder="Nome completo para identificação no sistema"
                    />
                </div>
            </div>

            {/* Mensagens */}
            {message && (
                <div
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
                        message.type === "success"
                            ? "border-emerald-100 bg-emerald-50/60 text-emerald-800"
                            : "border-rose-100 bg-rose-50/60 text-rose-800"
                    }`}
                >
                    {message.type === "success" ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                    )}
                    <div className="flex-1">
                        <p className="font-semibold text-xs">{message.type === "success" ? "Sucesso" : "Ocorreu um erro"}</p>
                        <p className="mt-0.5 text-xs opacity-90">{message.text}</p>
                    </div>
                </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Salvar perfil
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

function CabinetDetails({ email, cargo, unidadeId }: { email?: string; cargo?: string; unidadeId?: string }) {
    const formatCargo = (c?: string) => {
        switch (c) {
            case "chefia":
                return "Chefia";
            case "comunicacao":
                return "Comunicação";
            case "assessoria":
                return "Assessoria";
            case "secretaria":
                return "Secretaria";
            default:
                return c || "Não informado";
        }
    };

    const getCargoBadgeClass = (c?: string) => {
        switch (c) {
            case "chefia":
                return "bg-primary/10 text-primary border-primary/20";
            case "comunicacao":
                return "bg-indigo-50 text-indigo-700 border-indigo-100";
            case "assessoria":
                return "bg-slate-50 text-slate-700 border-slate-200";
            case "secretaria":
                return "bg-amber-50 text-amber-700 border-amber-200";
            default:
                return "bg-slate-50 text-slate-400 border-slate-100";
        }
    };

    const formatUnidade = (u?: string) => {
        switch (u) {
            case "CG":
                return "Sede Central (CG)";
            case "DD":
                return "Sede Regional (DD)";
            default:
                return u || "Não informada";
        }
    };

    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 flex flex-col justify-between">
            <div>
                <div className="mb-6 border-b border-slate-100 pb-4">
                    <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                        <Briefcase className="h-5 w-5 text-primary" />
                        Dados do Gabinete
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Informações institucionais da sua conta.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* E-mail */}
                    <div>
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            <Mail className="h-3.5 w-3.5" />
                            E-mail de acesso
                        </span>
                        <span className="block text-sm font-medium text-slate-900 break-all select-all">
                            {email || "Não informado"}
                        </span>
                    </div>

                    {/* Cargo */}
                    <div>
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            <Shield className="h-3.5 w-3.5" />
                            Cargo / Função
                        </span>
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${getCargoBadgeClass(cargo)}`}>
                            {formatCargo(cargo)}
                        </span>
                    </div>

                    {/* Unidade */}
                    <div>
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            <User className="h-3.5 w-3.5" />
                            Unidade Organizacional
                        </span>
                        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatUnidade(unidadeId)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Alert */}
            <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-normal">
                    Esses dados são administrados pelo gabinete para fins de auditoria e segurança. Para solicitar alterações de cargo ou unidade, fale com a chefia.
                </p>
            </div>
        </div>
    );
}

export default function PerfilView() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth();
    const { setView } = useAppStore();
    const { hasModule } = usePermissions();

    const [modalConviteAberto, setModalConviteAberto] = useState(false);
    const [criandoUsuario, setCriandoUsuario] = useState(false);
    const [toasts, setToasts] = useState<ToastState[]>([]);

    const podeConvidar =
        profile?.cargo === "chefia" ||
        profile?.cargo === "super_admin" ||
        hasModule("usuarios_gerenciar");

    const addToast = (message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

    const handleCriarUsuario = async (values: UserFormValues) => {
        setCriandoUsuario(true);
        addToast("Enviando convite por e-mail...", "success");

        try {
            const response = await fetch("/api/admin/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome: values.nome,
                    email: values.email,
                    cargo: values.cargo,
                    unidade_id: values.unidade_id,
                    modulos_acesso: values.modulos_acesso,
                }),
            });

            const payload = (await response.json()) as { error?: string; success?: boolean };

            if (!response.ok || !payload.success) {
                throw new Error(payload.error ?? "Não consegui enviar o convite.");
            }

            addToast("Convite enviado com sucesso!", "success");
            setModalConviteAberto(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro inesperado ao enviar convite.";
            addToast(message, "error");
        } finally {
            setCriandoUsuario(false);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
                <Link
                    href="/dashboard"
                    className="group mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-505 transition-all hover:text-slate-900 cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Voltar ao painel
                </Link>

                <PageHeader
                    preTitle="Configurações da Conta"
                    title="Meu perfil"
                    description="Ajuste os dados de exibição usados no gabinete."
                />

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
                        {/* Coluna da Esquerda (Área de Ação) */}
                        <div className="lg:col-span-7 flex flex-col gap-6">
                            {/* Formulário de Edição */}
                            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                                <PerfilForm
                                    key={profile?.id ?? user.id}
                                    userId={user.id}
                                    initialNome={profile?.nome || ""}
                                    initialAvatarUrl={profile?.avatar_url || ""}
                                    onSaved={refreshProfile}
                                />
                            </div>

                            {/* Equipe do Gabinete */}
                            {podeConvidar && (
                                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="mb-6 border-b border-slate-100 pb-4">
                                        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                                            <Users className="h-5 w-5 text-primary" />
                                            Equipe do Gabinete
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Gerencie os integrantes e acessos do gabinete.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setModalConviteAberto(true)}
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-98 cursor-pointer"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Convidar integrante
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Coluna da Direita (Área de Leitura) */}
                        <div className="lg:col-span-5">
                            <CabinetDetails
                                email={user.email}
                                cargo={profile?.cargo || undefined}
                                unidadeId={profile?.unidade_id || undefined}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {modalConviteAberto && (
                <UserFormModal
                    open={modalConviteAberto}
                    mode="create"
                    loading={criandoUsuario}
                    title="Convidar integrante"
                    description="Crie um acesso com unidade fixa e permissões modulares de agenda."
                    onClose={() => !criandoUsuario && setModalConviteAberto(false)}
                    onSubmit={handleCriarUsuario}
                />
            )}

            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
