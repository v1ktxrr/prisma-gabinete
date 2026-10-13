"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CheckSquare, Loader2, Mail, ShieldCheck, User2, X, Lock } from "lucide-react";
import { MODULOS_ACESSO } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

type CargoConvite = "assessoria" | "secretaria" | "comunicacao" | "chefia" | "super_admin";
type UnidadeId = "CG" | "DD";

export type UserFormValues = {
    nome: string;
    email: string;
    senha: string;
    confirmarSenha: string;
    cargo: CargoConvite;
    unidade_id: UnidadeId;
    modulos_acesso: string[];
};

type UserFormModalProps = {
    open: boolean;
    mode?: "create" | "edit";
    title?: string;
    description?: string;
    loading?: boolean;
    initialValues?: Partial<UserFormValues>;
    onClose: () => void;
    onSubmit: (values: UserFormValues) => Promise<void>;
};

const FORM_DRAFT_KEY = "prisma:user-form-draft";

const MODULOS_PERMISSOES = [
    { value: "agenda_global_ver", label: "Visualizar agenda", slugs: ["agenda_global_ver"] },
    { value: "agenda_global_editar", label: "Gerenciar Agenda Oficial", slugs: ["agenda_global_editar"] },
    { value: "agenda_global_presenca", label: "Check-in", slugs: ["agenda_global_presenca"] },
    { value: "agenda_comunicacao", label: "Agenda da comunicação", slugs: ["agenda_comunicacao_ver", "agenda_comunicacao_editar"] },
    { value: "briefing_editar", label: "Gerenciar Briefings", slugs: ["briefing_editar"] },
    { value: "usuarios_gerenciar", label: "Gerenciar usuários", slugs: ["usuarios_gerenciar"] },
    { value: "visao_geral_auditoria", label: "Auditoria de assessores", slugs: ["visao_geral_auditoria"] },
    { value: "oficios_ver", label: "Visualizar ofícios", slugs: ["oficios_ver"] },
    { value: "oficios_tramitar", label: "Tramitar Ofícios", slugs: ["oficios_tramitar"] },
] as const;

const MODULOS_PERMITIDOS = new Set<string>(MODULOS_ACESSO);

const CARGO_TEMPLATES: Record<CargoConvite, string[]> = {
    assessoria: [],
    secretaria: ["agenda_global_editar", "briefing_editar"],
    comunicacao: [
        "agenda_global_editar",
        "briefing_editar",
        "agenda_comunicacao_ver",
        "agenda_comunicacao_editar"
    ],
    chefia: [
        "agenda_global_editar",
        "briefing_editar",
        "agenda_comunicacao_ver",
        "usuarios_gerenciar",
        "visao_geral_auditoria",
        "oficios_ver",
        "oficios_tramitar"
    ],
    super_admin: [
        "agenda_global_ver",
        "agenda_global_editar",
        "agenda_global_presenca",
        "agenda_comunicacao_ver",
        "agenda_comunicacao_editar",
        "briefing_editar",
        "usuarios_gerenciar",
        "visao_geral_auditoria",
        "oficios_ver",
        "oficios_tramitar"
    ]
};

const buildDefaultValues = (initialValues?: Partial<UserFormValues>, fallbackUnidade?: UnidadeId): UserFormValues => ({
    nome: initialValues?.nome ?? "",
    email: initialValues?.email ?? "",
    senha: initialValues?.senha ?? "",
    confirmarSenha: initialValues?.confirmarSenha ?? "",
    cargo: initialValues?.cargo ?? "assessoria",
    unidade_id: initialValues?.unidade_id ?? fallbackUnidade ?? "CG",
    modulos_acesso: initialValues?.modulos_acesso ?? CARGO_TEMPLATES[initialValues?.cargo ?? "assessoria"] ?? [],
});

export default function UserFormModal({
    open,
    mode = "create",
    title,
    description,
    loading = false,
    initialValues,
    onClose,
    onSubmit,
}: UserFormModalProps) {
    const { profile } = useAuth();
    const ehSuperAdmin = profile?.cargo === "super_admin";
    const userUnidade = (profile?.unidade_id as UnidadeId) || "CG";

    const [values, setValues] = useState<UserFormValues>(() => buildDefaultValues(initialValues, userUnidade));
    const [alterarSenha, setAlterarSenha] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Efeito para recarregar valores quando o modal é aberto ou inicializado
    useEffect(() => {
        if (open) {
            setValues(buildDefaultValues(initialValues, userUnidade));
            setAlterarSenha(false);
            setError(null);
        }
    }, [open, mode, initialValues, userUnidade]);

    const senhasCoincidem =
        !alterarSenha ||
        (values.senha.length > 0 &&
         values.confirmarSenha.length > 0 &&
         values.senha === values.confirmarSenha);

    const toggleModulo = (modulo: typeof MODULOS_PERMISSOES[number]) => {
        setValues((prev) => {
            const hasAll = modulo.slugs.every((slug) => prev.modulos_acesso.includes(slug));
            let newModulos: string[];
            if (hasAll) {
                newModulos = prev.modulos_acesso.filter((slug) => !(modulo.slugs as readonly string[]).includes(slug));
            } else {
                const toAdd = modulo.slugs.filter((slug) => !prev.modulos_acesso.includes(slug));
                newModulos = [...prev.modulos_acesso, ...toAdd];
            }
            return { ...prev, modulos_acesso: newModulos };
        });
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!values.nome.trim() || !values.email.trim()) {
            setError("Preencha nome e e-mail.");
            return;
        }

        if (alterarSenha && !senhasCoincidem) {
            setError("As senhas informadas não coincidem.");
            return;
        }

        if (values.cargo !== "assessoria" && values.modulos_acesso.length === 0) {
            setError("Selecione pelo menos um módulo de acesso.");
            return;
        }

        await onSubmit({
            ...values,
            nome: values.nome.trim(),
            email: values.email.trim().toLowerCase(),
            senha: alterarSenha ? values.senha.trim() : "",
            confirmarSenha: alterarSenha ? values.confirmarSenha.trim() : "",
            modulos_acesso: values.modulos_acesso.filter((modulo) => MODULOS_PERMITIDOS.has(modulo)),
            // Forçar unidade do administrador se não for super_admin
            unidade_id: ehSuperAdmin ? values.unidade_id : userUnidade,
        });
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            {title ?? (mode === "create" ? "Convidar Integrante" : "Editar Integrante")}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {description ?? "Defina unidade e módulos de acesso da equipe."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="rounded-xl p-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    {/* Nome & Email */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Nome
                            </span>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <User2 className="h-4 w-4" />
                                </div>
                                <input
                                    value={values.nome}
                                    onChange={(e) => setValues((prev) => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                                    placeholder="Nome completo"
                                    required
                                />
                            </div>
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Email
                            </span>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <input
                                    type="email"
                                    value={values.email}
                                    onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 disabled:opacity-60 disabled:cursor-not-allowed"
                                    placeholder="assessor@dominio.com"
                                    required
                                    disabled={mode === "edit"}
                                />
                            </div>
                        </label>
                    </div>

                    {/* Checkbox Alterar Senha (apenas em Edit) */}
                    {mode === "edit" && (
                        <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={alterarSenha}
                                onChange={(e) => {
                                    setAlterarSenha(e.target.checked);
                                    if (!e.target.checked) {
                                        setValues((prev) => ({ ...prev, senha: "", confirmarSenha: "" }));
                                    }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                            />
                            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                <Lock className="h-3.5 w-3.5" />
                                Definir Nova Senha de Acesso
                            </span>
                        </label>
                    )}

                    {/* Senha & Confirmar Senha */}
                    {alterarSenha && (
                        <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {mode === "create" ? "Senha" : "Nova Senha"}
                                </span>
                                <input
                                    type="password"
                                    value={values.senha}
                                    onChange={(e) => setValues((prev) => ({ ...prev, senha: e.target.value }))}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                                    placeholder="Min. 6 caracteres"
                                    required={mode === "create" || alterarSenha}
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Confirmar Senha
                                </span>
                                <input
                                    type="password"
                                    value={values.confirmarSenha}
                                    onChange={(e) => setValues((prev) => ({ ...prev, confirmarSenha: e.target.value }))}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                                    placeholder="Min. 6 caracteres"
                                    required={mode === "create" || alterarSenha}
                                />
                                {values.confirmarSenha.length > 0 && !senhasCoincidem && (
                                    <p className="mt-1.5 text-xs font-medium text-red-650">
                                        As senhas precisam ser iguais.
                                    </p>
                                )}
                            </label>
                        </div>
                    )}

                    {/* Cargo & Unidade */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Cargo
                            </span>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <select
                                    value={values.cargo}
                                    onChange={(e) => {
                                        const cargoSelecionado = e.target.value as CargoConvite;
                                        setValues((prev) => ({
                                            ...prev,
                                            cargo: cargoSelecionado,
                                            modulos_acesso: CARGO_TEMPLATES[cargoSelecionado] || []
                                        }));
                                    }}
                                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                                >
                                    <option value="assessoria">Assessoria</option>
                                    <option value="secretaria">Secretaria</option>
                                    <option value="comunicacao">Comunicação</option>
                                </select>
                            </div>
                        </label>

                        <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Unidade
                            </legend>
                            <div className="mt-2 flex gap-2">
                                {[
                                    { value: "CG" as const, label: "CG" },
                                    { value: "DD" as const, label: "DD" },
                                ].map((option) => {
                                    const disabledRadio = !ehSuperAdmin;
                                    const selected = values.unidade_id === option.value;
                                    return (
                                        <label
                                            key={option.value}
                                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                                selected
                                                    ? "border-primary bg-white text-primary shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                            } ${disabledRadio ? "opacity-60 cursor-not-allowed" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="unidade_id"
                                                value={option.value}
                                                checked={selected}
                                                disabled={disabledRadio}
                                                onChange={() => setValues((prev) => ({ ...prev, unidade_id: option.value }))}
                                                className="h-3.5 w-3.5 border-slate-300 text-primary focus:ring-primary/30 disabled:opacity-50"
                                            />
                                            <Building2 className="h-3.5 w-3.5" />
                                            <span>{option.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </div>

                    {/* Módulos */}
                    <section className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <CheckSquare className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Permissões</h4>
                                <p className="text-[11px] text-slate-500">Selecione os módulos de acesso da conta</p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {MODULOS_PERMISSOES.map((modulo) => {
                                const checked = modulo.slugs.every((slug) => values.modulos_acesso.includes(slug));

                                return (
                                    <label
                                        key={modulo.value}
                                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
                                            checked
                                                ? "border-primary/30 bg-primary/5 shadow-sm"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleModulo(modulo)}
                                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
                                        />
                                        <span className="text-sm font-semibold text-slate-700">{modulo.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-shake">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !senhasCoincidem}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            <span>{loading ? "Processando..." : mode === "create" ? "Enviar convite por e-mail" : "Salvar alterações"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
