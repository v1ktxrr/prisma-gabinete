"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, Loader2, LogOut, ClipboardList, FileDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import {
    Registro,
    RegistroCard,
    FormularioRegistro,
    ToastContainer,
    ToastState
} from "@/components/agenda-shared";

export default function AgendaPage() {
    const { user, profile, loading: authLoading, signOut } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const router = useRouter();

    const [registros, setRegistros] = useState<Registro[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [modalAberto, setModalAberto] = useState(false);
    const [registroParaEditar, setRegistroParaEditar] = useState<Registro | null>(null);
    const [toasts, setToasts] = useState<ToastState[]>([]);

    const isLoading = authLoading || roleLoading;

    /* ---- Toast helpers ---- */
    const addToast = (message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };

    const removeToast = (id: number) =>
        setToasts((prev) => prev.filter((t) => t.id !== id));

    /* ---- Guards ---- */
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!isLoading && cargo && cargo !== "assessoria" && cargo !== "chefia") {
            if (cargo === "comunicacao") router.replace("/");
            if (cargo === "secretaria") router.replace("/dashboard");
        }
    }, [isLoading, cargo, router]);

    /* ---- Busca registros do usuário ---- */
    const buscarRegistros = useCallback(async () => {
        if (!user) return;
        setCarregando(true);
        const { data, error } = await supabase
            .from("relatorios_agenda")
            .select("id, user_id, data_evento, categoria, descricao_resolucao, valor_gasto, comprovantes_urls, criado_em")
            .eq("user_id", user.id)
            .order("data_evento", { ascending: false })
            .order("criado_em", { ascending: false })
            .limit(50);

        if (error) {
            addToast("Não consegui carregar os registros.", "error");
        }
        setRegistros((data as Registro[]) ?? []);
        setCarregando(false);
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const timeoutId = window.setTimeout(() => {
            void buscarRegistros();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [user, buscarRegistros]);

    /* ---- Callback de sucesso ---- */
    const handleSucesso = (novo: Registro, isEdit?: boolean) => {
        setModalAberto(false);
        setRegistroParaEditar(null);
        if (isEdit) {
            setRegistros((prev) => prev.map(r => r.id === novo.id ? novo : r));
            addToast("Registro atualizado.", "success");
        } else {
            setRegistros((prev) => [novo, ...prev]);
            addToast("Registro salvo.", "success");
        }
    };

    /* ---- Loading inicial ---- */
    if (isLoading || !user || (cargo !== "assessoria" && cargo !== "chefia")) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 print:bg-transparent">
            {/* 1. CSS NATIVO DE IMPRESSÃO */}
            <style type="text/css" media="print">
                {`
                @page {
                    size: A4;
                    margin: 0;
                }
                body {
                    margin: 0;
                    background-color: transparent !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                `}
            </style>

            {/* ========== TIMBRADO COMO BACKGROUND (Z-INDEX: -1) ========== */}
            <div className="hidden print:block fixed top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
                <img
                    src="/timbrado-relatorio.png"
                    alt="Timbrado Governo"
                    className="w-full h-auto object-cover block"
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                />
            </div>

            {/* TABELA MESTRA QUE CORRIGE QUEBRA DE PÁGINAS E ESPAÇAMENTOS */}
            <table className="w-full mx-auto border-collapse font-sans bg-transparent">
                <thead>
                    <tr>
                        <td className="p-0 border-none align-top">
                            <div className="hidden print:block" style={{ height: '40mm' }} />
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-0 border-none print:px-[15mm]">
                            {/* CABEÇALHO SÓ DE IMPRESSÃO */}
                            <div className="hidden print:block text-center pb-4 border-b-2 border-slate-200 mb-6 mt-4">
                                <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-800">
                                    Relatório de Atividades
                                </h1>
                                <p className="text-sm font-semibold mt-1 text-slate-700">
                                    Responsável: {profile?.nome ?? "Assessor"}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
                                </p>
                            </div>

                            {/* CORPO PRINCIPAL (WEB E PRINT) */}
                            <main className="mx-auto max-w-3xl px-4 py-8 print:py-0 print:px-0">
                                {/* ─── Page Header (WEB) ─── */}
                                <div className="border border-slate-200/80 bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm mb-6 p-6 md:p-8 print:hidden">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-650">
                                                    Minha Agenda
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                                    Meus Registros
                                                </span>
                                            </div>
                                            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                                                Meus Registros
                                            </h1>
                                            <p className="mt-2 max-w-xl text-xs sm:text-sm text-slate-500 leading-relaxed">
                                                Histórico de prestações de contas e atividades de campo.
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center w-full md:w-auto shrink-0 mt-4 md:mt-0">
                                            <button
                                                onClick={() => window.print()}
                                                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-[0.98] h-10 sm:h-9"
                                            >
                                                <FileDown className="h-4 w-4" />
                                                <span>Exportar PDF</span>
                                            </button>
                                            <button
                                                onClick={() => setModalAberto(true)}
                                                id="btn-novo-registro"
                                                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-md hover:shadow-primary/40 active:scale-[0.98] h-10 sm:h-9"
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span>Novo registro</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {!carregando && (
                                    <div className="mb-4 flex items-center justify-between px-2 print:hidden">
                                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            Histórico de registros
                                        </h2>
                                        <span className="text-xs text-slate-500">
                                            {registros.length}{" "}
                                            {registros.length === 1 ? "registro" : "registros"}
                                        </span>
                                    </div>
                                )}

                                {carregando && (
                                    <div className="space-y-3 print:hidden">
                                        {[1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className="h-28 rounded-[20px] bg-slate-100 animate-pulse border border-slate-200/60"
                                            />
                                        ))}
                                    </div>
                                )}

                                {!carregando && registros.length > 0 && (
                                    <div className="space-y-3">
                                        {registros.map((r) => (
                                            <RegistroCard
                                                key={r.id}
                                                registro={r}
                                                currentUserId={user?.id}
                                                onEdit={(registro) => {
                                                    setRegistroParaEditar(registro);
                                                    setModalAberto(true);
                                                }}
                                                onDelete={async (id) => {
                                                    const { error } = await supabase
                                                        .from("relatorios_agenda")
                                                        .delete()
                                                        .eq("id", id)
                                                        .eq("user_id", user.id);

                                                    if (error) {
                                                        throw error;
                                                    }

                                                    setRegistros(prev => prev.filter(item => item.id !== id));
                                                    addToast("Registro excluído.", "success");
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {!carregando && registros.length === 0 && (
                                    <div className="mt-6 flex flex-col items-center gap-6 text-center border border-slate-200/80 bg-white/80 backdrop-blur-xl p-8 sm:p-12 rounded-3xl shadow-sm print:hidden">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400">
                                            <ClipboardList className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-lg font-bold text-slate-900">Nenhum registro encontrado</p>
                                            <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed mx-auto">
                                                Você ainda não possui prestações de contas ou atividades de campo registradas. Clique abaixo para iniciar.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setModalAberto(true)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-md active:scale-[0.98] w-full sm:w-auto h-12"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span>Criar primeiro registro</span>
                                        </button>
                                    </div>
                                )}

                                <div className="h-24 print:hidden" />
                            </main>
                        </td>
                    </tr>
                </tbody>
            </table>

            {modalAberto && (
                <FormularioRegistro
                    userId={user.id}
                    onSuccess={handleSucesso}
                    onClose={() => {
                        setModalAberto(false);
                        setRegistroParaEditar(null);
                    }}
                    registroParaEditar={registroParaEditar}
                />
            )}

            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
