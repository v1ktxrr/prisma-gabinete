"use client";

import { useEffect, useState, useRef } from "react";
import {
    X, Loader2, Users, Banknote, MapPin, Briefcase, Handshake,
    CheckCircle2, AlertCircle, Edit2, Trash2, Paperclip
} from "lucide-react";
import { COMPROVANTES_BUCKET, supabase, uploadComprovantes } from "@/lib/supabase";
import { DatePicker } from "@/components/ui/date-time-picker";

/* ============================================================
   Tipos
   ============================================================ */
export type Categoria = "atendimento" | "reuniao" | "visita" | "representacao" | "participacao";

export interface Registro {
    id: string;
    data_evento: string;
    categoria: Categoria;
    descricao_resolucao: string;
    valor_gasto: number;
    comprovantes_urls?: string[] | null;
    criado_em: string;
    user_id?: string;
}

export interface RegistroComUsuario extends Registro {
    perfis_usuarios?: {
        nome: string;
        cargo: string;
    };
}

/* ============================================================
   Helpers de UI
   ============================================================ */
const CATEGORIAS: {
    value: Categoria;
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
} [] = [
    {
        value: "atendimento",
        label: "Atendimento",
        icon: Users,
        color: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200",
    },
    {
        value: "reuniao",
        label: "Reunião",
        icon: Briefcase,
        color: "text-violet-700",
        bg: "bg-violet-50",
        border: "border-violet-200",
    },
    {
        value: "visita",
        label: "Visita",
        icon: MapPin,
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
    },
    {
        value: "representacao",
        label: "Representação",
        icon: Handshake,
        color: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
    },
    {
        value: "participacao",
        label: "Participação",
        icon: CheckCircle2,
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
    },
];

function getCatMeta(value: Categoria) {
    return CATEGORIAS.find((c) => c.value === value) ?? CATEGORIAS[0];
}

function formatarData(iso: string) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

export function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function hojeISO() {
    return new Date().toISOString().split("T")[0];
}

export function saudacao(nome: string) {
    const hora = new Date().getHours();
    const prefix =
        hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    const primeiro = nome.split(" ")[0];
    return `${prefix}, ${primeiro}`;
}

/* ============================================================
   Toast simples (sem dependência externa)
   ============================================================ */
export interface ToastState {
    id: number;
    message: string;
    type: "success" | "error";
}

export function ToastContainer({ toasts, onRemove }: {
    toasts: ToastState[];
    onRemove: (id: number) => void;
}) {
    return (
        <div className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 duration-300 ${
                        t.type === "success"
                            ? "bg-white border-emerald-200 text-emerald-800"
                            : "bg-white border-red-200 text-red-800"
                    }`}
                >
                    {t.type === "success" ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <span className="flex-1 text-sm font-medium">{t.message}</span>
                    <button
                        onClick={() => onRemove(t.id)}
                        className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

/* ============================================================
   Card de Registro
   ============================================================ */
export function RegistroCard({
    registro,
    showUser = false,
    currentUserId,
    onEdit,
    onDelete
}: {
    registro: RegistroComUsuario;
    showUser?: boolean;
    currentUserId?: string;
    onEdit?: (registro: Registro) => void;
    onDelete?: (id: string) => Promise<void>;
}) {
    const cat = getCatMeta(registro.categoria);
    const Icon = cat.icon;
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletando, setDeletando] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [abrindoComprovante, setAbrindoComprovante] = useState<string | null>(null);
    const [erroComprovante, setErroComprovante] = useState<string | null>(null);

    const isOwner = currentUserId && registro.user_id === currentUserId;
    const comprovantes = registro.comprovantes_urls ?? [];

    const handleAbrirComprovante = async (caminhoArquivo: string) => {
        if (!caminhoArquivo || abrindoComprovante) {
            return;
        }

        setAbrindoComprovante(caminhoArquivo);
        setErroComprovante(null);

        try {
            const { data, error } = await supabase.storage
                .from(COMPROVANTES_BUCKET)
                .createSignedUrl(caminhoArquivo, 300);

            if (error || !data?.signedUrl) {
                throw error ?? new Error("Não consegui gerar o link.");
            }

            window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        } catch {
            setErroComprovante("Não consegui abrir o comprovante.");
        } finally {
            setAbrindoComprovante(null);
        }
    };

    return (
        <div className="group flex flex-col sm:flex-row items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-350 hover:-translate-y-0.5 print-break-inside-avoid print-border-clean print:bg-transparent print:border-transparent">
            {/* Ícone da categoria */}
            <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${cat.bg} ${cat.border} print:bg-transparent`}
            >
                <Icon className={`h-5 w-5 ${cat.color}`} />
            </div>

            {/* Conteúdo */}
            <div className="min-w-0 flex-1 w-full">
                {/* Top Row: Categoria, Assessor e Data */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold ${cat.bg} ${cat.border} ${cat.color}`}
                        >
                            {cat.label}
                        </span>
                        {showUser && registro.perfis_usuarios && (
                            <span className="text-[10px] sm:text-xs font-medium text-slate-650 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/60">
                                {registro.perfis_usuarios.nome.split(" ")[0]}
                            </span>
                        )}
                    </div>
                    <span className="shrink-0 text-[10px] sm:text-xs font-semibold text-slate-400 tabular-nums">
                        {formatarData(registro.data_evento)}
                    </span>
                </div>

                {/* Descrição */}
                <p className="text-xs sm:text-sm leading-relaxed text-slate-700 break-words line-clamp-4">
                    {registro.descricao_resolucao || (
                        <span className="italic text-slate-400">Sem descrição</span>
                    )}
                </p>

                {erroComprovante && (
                    <p className="mt-2 text-xs font-medium text-red-650">
                        {erroComprovante}
                    </p>
                )}

                {/* Footer Row: Anexos e Ações */}
                {(comprovantes.length > 0 || isOwner) && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Anexos */}
                        {comprovantes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                {comprovantes.map((caminhoArquivo, index) => (
                                    <button
                                        key={caminhoArquivo}
                                        type="button"
                                        onClick={() => void handleAbrirComprovante(caminhoArquivo)}
                                        disabled={abrindoComprovante !== null}
                                        className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-60 h-11 sm:h-9"
                                        title={`Abrir anexo ${index + 1}`}
                                    >
                                        {abrindoComprovante === caminhoArquivo ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Paperclip className="h-3.5 w-3.5 text-slate-450" />
                                        )}
                                        <span>{`Anexo ${index + 1}`}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Ações do Dono */}
                        {isOwner && (
                            <div className="flex items-center gap-1.5 ml-auto w-full sm:w-auto justify-end">
                                <button
                                    onClick={() => onEdit?.(registro)}
                                    className="flex flex-1 sm:flex-none h-11 sm:h-9 px-3 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-xs font-bold shrink-0"
                                    title="Editar"
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                    <span>Editar</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setDeleteError(null);
                                        setShowDeleteModal(true);
                                    }}
                                    className="flex flex-1 sm:flex-none h-11 sm:h-9 px-3 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-red-650 hover:bg-red-50/50 hover:border-red-200 transition-all text-xs font-bold shrink-0"
                                    title="Excluir"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Excluir</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deletando && setShowDeleteModal(false)} />
                    <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir registro?</h3>
                        <p className="text-sm text-slate-600 mb-6">
                            Essa ação não pode ser desfeita.
                        </p>
                        {deleteError && (
                            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {deleteError}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setDeleteError(null);
                                    setShowDeleteModal(false);
                                }}
                                disabled={deletando}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={async () => {
                                    setDeletando(true);
                                    setDeleteError(null);
                                    try {
                                        if (onDelete) {
                                            await onDelete(registro.id);
                                        }
                                        setShowDeleteModal(false);
                                    } catch {
                                        setDeleteError("Não consegui excluir o registro. Tente novamente.");
                                    } finally {
                                        setDeletando(false);
                                    }
                                }}
                                disabled={deletando}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                                {deletando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ============================================================
   Formulário de Novo Registro (Drawer/Modal)
   ============================================================ */
export interface FormularioProps {
    userId: string;
    onSuccess: (registro: Registro, isEdit?: boolean) => void;
    onClose: () => void;
    registroParaEditar?: Registro | null;
}

export function FormularioRegistro({ userId, onSuccess, onClose, registroParaEditar }: FormularioProps) {
    const TAMANHO_MAXIMO_COMPROVANTE = 5 * 1024 * 1024;
    const TIPOS_COMPROVANTE_ACEITOS = ["application/pdf"];
    const [categoria, setCategoria] = useState<Categoria | "">(registroParaEditar?.categoria || "");
    const [dataEvento, setDataEvento] = useState(registroParaEditar?.data_evento || hojeISO());
    const [descricao, setDescricao] = useState(registroParaEditar?.descricao_resolucao || "");
    const [files, setFiles] = useState<File[]>([]);
    const [salvando, setSalvando] = useState(false);
    const [erroForm, setErroForm] = useState<string | null>(null);
    const descricaoRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ultimoRegistroHidratadoRef = useRef<string>("novo");

    const limparInputArquivosSeNecessario = (proximosArquivos: File[]) => {
        if (proximosArquivos.length === 0 && fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        const chaveAtual = registroParaEditar?.id ?? "novo";

        if (ultimoRegistroHidratadoRef.current === chaveAtual) {
            return;
        }

        ultimoRegistroHidratadoRef.current = chaveAtual;
        setCategoria(registroParaEditar?.categoria || "");
        setDataEvento(registroParaEditar?.data_evento || hojeISO());
        setDescricao(registroParaEditar?.descricao_resolucao || "");
        setFiles([]);
        limparInputArquivosSeNecessario([]);
        setErroForm(null);
    }, [registroParaEditar]);

    const validarArquivo = (arquivo: File) => {
        if (arquivo.size > TAMANHO_MAXIMO_COMPROVANTE) {
            return "Cada comprovante pode ter até 5 MB.";
        }

        if (
            !arquivo.type.startsWith("image/") &&
            !TIPOS_COMPROVANTE_ACEITOS.includes(arquivo.type)
        ) {
            return "Envie uma imagem ou um PDF.";
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoria) {
            setErroForm("Selecione uma categoria.");
            return;
        }
        if (!descricao.trim()) {
            setErroForm("Descreva o que foi feito.");
            return;
        }
        for (const file of files) {
            const erroArquivo = validarArquivo(file);

            if (erroArquivo) {
                setErroForm(erroArquivo);
                return;
            }
        }

        setSalvando(true);
        setErroForm(null);

        const payload = {
            user_id: userId,
            data_evento: dataEvento,
            categoria,
            descricao_resolucao: descricao.trim(),
            valor_gasto: 0,
        };

        if (registroParaEditar) {
            const { data, error } = await supabase
                .from("relatorios_agenda")
                .update(payload)
                .eq("id", registroParaEditar.id)
                .eq("user_id", userId)
                .select()
                .single();

            if (error) {
                setSalvando(false);
                setErroForm("Não consegui atualizar. Tente novamente.");
                return;
            }

            setSalvando(false);
            onSuccess(data as Registro, true);
        } else {
            const { data, error } = await supabase
                .from("relatorios_agenda")
                .insert(payload)
                .select()
                .single();

            if (error) {
                setSalvando(false);
                setErroForm("Não consegui salvar. Tente novamente.");
                return;
            }

            let registroCriado = data as Registro;

            if (files.length > 0) {
                let caminhosComprovantes: string[] = [];

                try {
                    caminhosComprovantes = await uploadComprovantes(files, registroCriado.id);
                    const { data: registroAtualizado, error: erroAtualizacaoComprovante } = await supabase
                        .from("relatorios_agenda")
                        .update({ comprovantes_urls: caminhosComprovantes })
                        .eq("id", registroCriado.id)
                        .eq("user_id", userId)
                        .select()
                        .single();

                    if (erroAtualizacaoComprovante) {
                        throw erroAtualizacaoComprovante;
                    }

                    registroCriado = registroAtualizado as Registro;
                } catch (error) {
                    if (
                        caminhosComprovantes.length === 0 &&
                        error &&
                        typeof error === "object" &&
                        "uploadedPaths" in error &&
                        Array.isArray(error.uploadedPaths)
                    ) {
                        caminhosComprovantes = error.uploadedPaths as string[];
                    }

                    if (caminhosComprovantes.length > 0) {
                        await supabase.storage
                            .from(COMPROVANTES_BUCKET)
                            .remove(caminhosComprovantes);
                    }

                    setSalvando(false);
                    setErroForm("Registro criado, mas não consegui enviar os comprovantes.");
                    return;
                }
            }

            setSalvando(false);
            onSuccess(registroCriado, false);
        }
    };

    return (
        /* Overlay */
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Novo registro de prestação de contas"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Painel */}
            <div className="relative z-10 w-full max-w-lg animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
                <div className="rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">

                    {/* Handle (mobile) */}
                    <div className="flex justify-center pt-3 pb-1 sm:hidden">
                        <div className="h-1.5 w-10 rounded-full bg-slate-200" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
                        <div>
                            <h2 className="text-base font-bold text-foreground">
                                {registroParaEditar ? "Editar registro" : "Novo registro"}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Prestação de contas</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
                            aria-label="Fechar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5 max-h-[80vh] overflow-y-auto">

                        <div>
                            <label className="mb-2.5 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                                Categoria <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIAS.map((cat) => {
                                    const Icon = cat.icon;
                                    const selected = categoria === cat.value;
                                    return (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => {
                                                setCategoria(cat.value);
                                                setErroForm(null);
                                                if (window.innerWidth > 640) {
                                                    setTimeout(() => descricaoRef.current?.focus(), 50);
                                                }
                                            }}
                                            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-xs sm:text-sm font-bold transition-all active:scale-[0.97] h-12 ${
                                                selected
                                                    ? `${cat.bg} ${cat.border} ${cat.color} shadow-xs`
                                                    : "border-slate-200 bg-slate-50/30 text-slate-500 hover:border-slate-350 hover:text-slate-700"
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 shrink-0 ${selected ? cat.color : ""}`} />
                                            <span className="leading-tight">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="data-evento"
                                className="mb-2 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500"
                            >
                                Data do evento <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                id="data-evento"
                                value={dataEvento}
                                max={hojeISO()}
                                onChange={(val) => setDataEvento(val)}
                                required
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="descricao"
                                className="mb-2 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500"
                            >
                                O que foi feito? <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="descricao"
                                ref={descricaoRef}
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Descreva brevemente o atendimento, reunião ou visita..."
                                rows={3}
                                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                required
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="comprovante"
                                className="mb-2 block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500"
                            >
                                Comprovante
                            </label>
                            <input
                                ref={fileInputRef}
                                id="comprovante"
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                    const arquivosSelecionados = Array.from(e.target.files ?? []);

                                    if (arquivosSelecionados.length === 0) {
                                        return;
                                    }

                                    for (const arquivo of arquivosSelecionados) {
                                        const erroArquivo = validarArquivo(arquivo);

                                        if (erroArquivo) {
                                            e.target.value = "";
                                            setErroForm(erroArquivo);
                                            return;
                                        }
                                    }

                                    setFiles((prev) => {
                                        const mapaArquivos = new Map(
                                            prev.map((file) => [
                                                `${file.name}-${file.size}-${file.lastModified}`,
                                                file,
                                            ])
                                        );

                                        arquivosSelecionados.forEach((arquivo) => {
                                            mapaArquivos.set(
                                                `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`,
                                                arquivo
                                            );
                                        });

                                        return Array.from(mapaArquivos.values());
                                    });
                                    e.target.value = "";
                                    setErroForm(null);
                                }}
                                className="hidden"
                            />

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-5 px-4 text-center text-slate-500 transition-all hover:border-slate-350 hover:bg-slate-50 hover:text-slate-700 active:scale-99 h-20"
                            >
                                <Paperclip className="h-5 w-5 text-slate-400" />
                                <div>
                                    <span className="text-xs font-bold block">Anexar fotos ou PDFs</span>
                                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Clique para selecionar comprovantes</span>
                                </div>
                            </button>

                            {files.length > 0 && (
                                <div className="mt-2 space-y-2">
                                    {files.map((file, index) => (
                                        <div
                                            key={`${file.name}-${file.size}-${file.lastModified}`}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 h-10 shadow-2xs"
                                        >
                                            <span className="truncate text-xs font-semibold text-slate-600">
                                                {`${index + 1}. ${file.name}`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFiles((prev) => {
                                                        const proximosArquivos = prev.filter((_, fileIndex) => fileIndex !== index);
                                                        limparInputArquivosSeNecessario(proximosArquivos);
                                                        return proximosArquivos;
                                                    });
                                                }}
                                                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-655 transition-colors"
                                                aria-label={`Remover comprovante ${file.name}`}
                                                title="Remover arquivo"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="mt-2 text-[10px] sm:text-xs text-slate-400 leading-normal">
                                Aceita imagens e PDF, com limite de 5 MB por arquivo. Você pode selecionar múltiplos arquivos.
                            </p>
                            {registroParaEditar?.comprovantes_urls && registroParaEditar.comprovantes_urls.length > 0 && (
                                <p className="mt-1.5 text-[10px] sm:text-xs text-amber-600 font-medium">
                                    Este registro já possui comprovantes salvos. O upload nesta tela vale apenas para novos registros.
                                </p>
                            )}
                        </div>

                        {erroForm && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {erroForm}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98] h-12"
                            >
                                Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={salvando}
                                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-sm shadow-primary/25 transition-all hover:bg-primary-hover hover:shadow-md hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-60 h-12"
                            >
                                {salvando ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        {registroParaEditar ? "Salvar alterações" : "Salvar registro"}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
