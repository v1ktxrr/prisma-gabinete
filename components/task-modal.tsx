"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Loader2, Save, Clock, CheckCircle, ImagePlus, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import MunicipioAutocomplete from "@/components/ui/municipio-autocomplete";
import MunicipioMultiSelect from "@/components/ui/municipio-multiselect";
import CRMAlertBanner from "@/components/ui/crm-alert-banner";

/* ============================================================
   Tipos
   ============================================================ */
const TASK_STATUSES = [
    { value: "pendente", label: "Pendente", icon: Clock },
    { value: "publicado", label: "Publicado", icon: CheckCircle },
] as const;

const EVENT_TYPES = [
    { value: "agenda_oficial", label: "🔴 Agenda Oficial" },
    { value: "aniversario_cidade", label: "🔵 Aniversário da Cidade" },
    { value: "data_comemorativa", label: "🟣 Data Comemorativa" },
    { value: "diversos", label: "🟡 Diversos" },
] as const;

const COMMS_EVENT_TYPES = [
    { value: "agenda_oficial", label: "🌸 Pauta Oficial" },
    { value: "aniversario_cidade", label: "🟢 Eventos MS" },
    { value: "data_comemorativa", label: "🟣 Data Comemorativa" },
    { value: "diversos", label: "🟠 Diversos / Outros" },
] as const;

const ACTIVITY_TYPES = [
    { value: "captacao", label: "Captação" },
    { value: "edicao", label: "Edição" },
    { value: "texto", label: "Texto" },
    { value: "publicacao", label: "Publicação" },
] as const;

const TEMAS = [
    { value: "Saúde", label: "Saúde" },
    { value: "Educação", label: "Educação" },
    { value: "Infraestrutura", label: "Infraestrutura" },
    { value: "Segurança", label: "Segurança" },
    { value: "Social", label: "Social" },
    { value: "Economia/Desenvolvimento", label: "Economia/Desenvolvimento" },
    { value: "Cultura", label: "Cultura" },
    { value: "Esporte", label: "Esporte" },
    { value: "Institucional", label: "Institucional" },
] as const;

export interface TaskFormData {
    id?: string;
    staticEventId?: string;
    titulo: string;
    descricao: string;
    status: string;
    event_type: string;
    data_inicio: string;
    post_url?: string;
    tema?: string;
    tipo_agenda?: "GLOBAL" | "COMUNICACAO";
    municipio_id?: string | null;
    municipio_ids?: string[] | null;
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
    atendimento_id?: string | null;
}

interface ProfileOption {
    id: string;
    nome: string;
    cargo: string | null;
}

interface TaskModalProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    initialData?: TaskFormData;
    userId: string;
    userName?: string | null;
    isAdmin?: boolean;
    onUpdateStore?: () => Promise<void>;
    canEdit?: boolean;
    canCheckIn?: boolean;
    canViewBriefing?: boolean;
    tipoAgenda?: "GLOBAL" | "COMUNICACAO";
    onStaticEventConverted?: (staticId: string) => void;
}

interface TaskPayload {
    titulo: string;
    descricao: string | null;
    status: string;
    event_type: string;
    tema: string | null;
    tipo_agenda: "GLOBAL" | "COMUNICACAO";
    data_inicio: string | null;
    data_fim: string | null;
    post_url: string | null;
    registro_status: "ativo";
    unidade_id?: "CG" | "DD";
    municipio_id?: string | null;
    municipio_ids?: string[] | null;
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
    atendimento_id?: string | null;
}

/* ============================================================
   Helpers
   ============================================================ */
function toLocalDatetime(iso: string | undefined): string {
    if (!iso) return "";

    // Se for uma data simples "YYYY-MM-DD" do FullCalendar, assume 09h local
    if (iso.length === 10) {
        return `${iso}T09:00`;
    }

    // Tenta converter para objeto Date.
    // Replace " " com "T" caso venha do v_calendario antigo
    const d = new Date(iso.replace(" ", "T"));
    if (isNaN(d.getTime())) return "";

    // Para datetime-local local format: YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, "0");

    // IMPORTANTE: FullCalendar fornece startStr com timezone.
    // Ao usar new Date(iso), 'd' já está no timezone local se a string for ISO completa.
    // Se for "2026-03-09T08:47", a maioria dos browsers assume local.
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEMA_TO_EIXO_MAP: Record<string, string> = {
    "Saúde": "saude",
    "Educação": "educacao",
    "Segurança": "seguranca",
    "Infraestrutura": "infraestrutura",
    "Social": "assistencia_social",
    "Institucional": "institucional",
};

const EIXO_TO_TEMA_MAP: Record<string, string> = {
    saude: "Saúde",
    educacao: "Educação",
    seguranca: "Segurança",
    infraestrutura: "Infraestrutura",
    assistencia_social: "Social",
    institucional: "Institucional",
};

function getInitialFormState(initialData?: TaskFormData) {
    return {
        titulo: initialData?.titulo || "",
        descricao: initialData?.descricao || "",
        status: initialData?.status || "pendente",
        eventType: initialData?.event_type || "agenda_oficial",
        tema: initialData?.tema || "",
        dataInicio: toLocalDatetime(initialData?.data_inicio),
        postUrl: initialData?.post_url || "",
        municipioId: initialData?.municipio_id || "",
        municipioIds: initialData?.municipio_ids || [],
        captacaoBy: initialData?.captacao_by || "",
        edicaoBy: initialData?.edicao_by || "",
        textoBy: initialData?.texto_by || "",
        publicacaoBy: initialData?.publicacao_by || "",
        formatoMidia: initialData?.formato_midia || "",
        eixoTematico: initialData?.eixo_tematico || (initialData?.tema ? TEMA_TO_EIXO_MAP[initialData.tema] || "" : "") || "",
        atendimentoId: initialData?.atendimento_id || "",
    };
}


const STEPS = [
    { key: "captacao", label: "📷 Captação", actionLabel: "Assumir Captação" },
    { key: "edicao", label: "🎨 Edição", actionLabel: "Assumir Edição" },
    { key: "texto", label: "✍️ Texto", actionLabel: "Assumir Texto" },
    { key: "publicacao", label: "🌐 Publicação", actionLabel: "Assumir Publicação" },
] as const;
const FALLBACK_FORMATOS = [
    { chave: "video", nome: "Vídeo" },
    { chave: "card", nome: "Card" },
    { chave: "cobertura", nome: "Cobertura" },
    { chave: "foto", nome: "Foto" },
    { chave: "texto", nome: "Texto" },
];

const FALLBACK_EIXOS = [
    { chave: "saude", nome: "Saúde" },
    { chave: "educacao", nome: "Educação" },
    { chave: "seguranca", nome: "Segurança" },
    { chave: "infraestrutura", nome: "Infraestrutura" },
    { chave: "assistencia_social", nome: "Assistência Social" },
    { chave: "institucional", nome: "Institucional" },
];

/* ============================================================
   Component
   ============================================================ */
export default function TaskModal({
    open,
    onClose,
    onSaved,
    initialData,
    userId,
    userName,
    onUpdateStore,
    canEdit = true,
    canCheckIn = false,
    canViewBriefing = false,
    tipoAgenda,
    onStaticEventConverted,
}: TaskModalProps) {
    const { unidadeId, profile } = usePermissions();
    const isEdit = Boolean(initialData?.id);
    const overlayRef = useRef<HTMLDivElement>(null);
    const initialFormState = getInitialFormState(initialData);

    const [titulo, setTitulo] = useState(initialFormState.titulo);
    const [descricao, setDescricao] = useState(initialFormState.descricao);
    const [status, setStatus] = useState(initialFormState.status);
    const [eventType, setEventType] = useState(initialFormState.eventType);
    const [tema, setTema] = useState(initialFormState.tema);
    const [dataInicio, setDataInicio] = useState(initialFormState.dataInicio);
    const [postUrl, setPostUrl] = useState(initialFormState.postUrl);
    const [municipioId, setMunicipioId] = useState<string | null>(initialFormState.municipioId || null);
    const [municipioIds, setMunicipioIds] = useState<string[]>(initialFormState.municipioIds || []);
    const [atendimentoId, setAtendimentoId] = useState(initialFormState.atendimentoId);
    const [atendimentos, setAtendimentos] = useState<{ id: string; titulo: string; data: string }[]>([]);

    const [captacaoBy, setCaptacaoBy] = useState(initialFormState.captacaoBy);
    const [edicaoBy, setEdicaoBy] = useState(initialFormState.edicaoBy);
    const [textoBy, setTextoBy] = useState(initialFormState.textoBy);
    const [publicacaoBy, setPublicacaoBy] = useState(initialFormState.publicacaoBy);
    const [formatoMidia, setFormatoMidia] = useState(initialFormState.formatoMidia);
    const [eixoTematico, setEixoTematico] = useState(initialFormState.eixoTematico);

    const [equipe, setEquipe] = useState<ProfileOption[]>([]);

    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [showMoreOptions, setShowMoreOptions] = useState(false);

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Photo upload states
    const [manualPhoto, setManualPhoto] = useState<File | null>(null);
    const [manualPhotoPreview, setManualPhotoPreview] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const effectiveTipoAgenda = initialData?.tipo_agenda ?? tipoAgenda ?? "COMUNICACAO";

    // Custom Toast State
    const [metaToast, setMetaToast] = useState<{ show: boolean, message: string, type: 'info' | 'error' }>({ show: false, message: '', type: 'info' });

    const showToast = (message: string, type: 'info' | 'error' = 'info') => {
        setMetaToast({ show: true, message, type });
        setTimeout(() => setMetaToast(prev => ({ ...prev, show: false })), 4000);
    };    const [eixosDynamic, setEixosDynamic] = useState<{ chave: string; nome: string }[]>([]);
    const [formatosDynamic, setFormatosDynamic] = useState<{ chave: string; nome: string }[]>([]);

    useEffect(() => {
        const fetchDomains = async () => {
            try {
                const [eixosRes, formatosRes] = await Promise.all([
                    supabase.from("eixos_tematicos").select("chave, nome").order("nome", { ascending: true }),
                    supabase.from("formatos_midia").select("chave, nome").order("nome", { ascending: true })
                ]);
                if (eixosRes.data && eixosRes.data.length > 0) {
                    setEixosDynamic(eixosRes.data);
                }
                if (formatosRes.data && formatosRes.data.length > 0) {
                    setFormatosDynamic(formatosRes.data);
                }
            } catch (err) {
                console.error("Erro ao buscar domínios dinâmicos, usando fallbacks:", err);
            }
        };
        fetchDomains();
    }, []);

    const eixos = eixosDynamic.length > 0 ? eixosDynamic : FALLBACK_EIXOS;
    const formatos = formatosDynamic.length > 0 ? formatosDynamic : FALLBACK_FORMATOS;

    const getUserNameById = (id: string | null | undefined) => {
        if (!id) return "";
        if (id === userId && userName) return userName;
        const found = equipe.find((item) => item.id === id);
        return found ? found.nome : "Carregando...";
    };

    const handleClaimStep = async (step: "captacao" | "edicao" | "texto" | "publicacao") => {
        if (!initialData?.id) return;
        try {
            const columnName = `${step}_by`;
            const { error: updateErr } = await supabase
                .from("tasks")
                .update({ [columnName]: userId })
                .eq("id", initialData.id);

            if (updateErr) throw updateErr;

            // Atualizar estado local
            if (step === "captacao") setCaptacaoBy(userId);
            else if (step === "edicao") setEdicaoBy(userId);
            else if (step === "texto") setTextoBy(userId);
            else if (step === "publicacao") setPublicacaoBy(userId);

            showToast("Você assumiu esta etapa!", "info");
            
            // Atualizar o store local do calendário/visualização
            if (onUpdateStore) await onUpdateStore();
        } catch (err: any) {
            console.error("Erro ao assumir etapa:", err);
            showToast("Não foi possível assumir esta etapa.", "error");
        }
    };

    const handleUnclaimStep = async (step: "captacao" | "edicao" | "texto" | "publicacao") => {
        if (!initialData?.id) return;
        try {
            const columnName = `${step}_by`;
            const { error: updateErr } = await supabase
                .from("tasks")
                .update({ [columnName]: null })
                .eq("id", initialData.id);

            if (updateErr) throw updateErr;

            // Atualizar estado local
            if (step === "captacao") setCaptacaoBy("");
            else if (step === "edicao") setEdicaoBy("");
            else if (step === "texto") setTextoBy("");
            else if (step === "publicacao") setPublicacaoBy("");

            showToast("Etapa liberada!", "info");

            // Atualizar o store local do calendário/visualização
            if (onUpdateStore) await onUpdateStore();
        } catch (err: any) {
            console.error("Erro ao liberar etapa:", err);
            showToast("Não foi possível liberar esta etapa.", "error");
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        // Carrega equipe para atribuição múltipla
        supabase
            .from("perfis_usuarios")
            .select("id, nome, cargo")
            .order("nome", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) {
                    setEquipe(data as ProfileOption[]);
                }
            });

        // Carrega atendimentos da mesma unidade
        if (unidadeId) {
            supabase
                .from("atendimentos")
                .select("id, titulo, data")
                .eq("unidade_id", unidadeId)
                .neq("status", "arquivado")
                .order("titulo", { ascending: true })
                .then(({ data, error }) => {
                    if (!error && data) {
                        setAtendimentos(data);
                    }
                });
        }

        if (initialData?.id) {
            supabase
                .from("task_assignments")
                .select("activity_type, user_id")
                .eq("task_id", initialData.id)
                .eq("user_id", userId)
                .then(({ data }) => {
                    if (data) {
                        setSelectedActivities([...new Set(data.map((item) => item.activity_type as string))]);
                    }
                });
        }
    }, [open, initialData, userId, unidadeId]);

    const toggleActivity = (activityType: string) => {
        setSelectedActivities((prev) =>
            prev.includes(activityType)
                ? prev.filter((item) => item !== activityType)
                : [...prev, activityType]
        );
    };

    // Close on overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titulo.trim()) return;

        if (!canEdit) {
            setError("Ações de salvar estão desativadas enquanto estiver offline ou carregando.");
            return;
        }

        if (effectiveTipoAgenda === "GLOBAL" && !unidadeId) {
            setError("Não consegui identificar a unidade do usuário.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            let resolvedAtendimentoId = atendimentoId || null;
            if (atendimentoId === "new") {
                const { data: newAt, error: newAtError } = await supabase
                    .from("atendimentos")
                    .insert({
                        titulo: `Atendimento: ${titulo.trim()}`,
                        status: "aberto",
                        unidade_id: unidadeId ?? "CG",
                        data: dataInicio ? new Date(dataInicio).toISOString() : new Date().toISOString()
                    })
                    .select("id")
                    .single();
                if (newAtError) throw newAtError;
                resolvedAtendimentoId = newAt.id;
            }

            const payload: TaskPayload = {
                titulo: titulo.trim(),
                descricao: descricao.trim() || null,
                status,
                event_type: eventType,
                tema: (effectiveTipoAgenda === "COMUNICACAO"
                    ? (eixoTematico ? (EIXO_TO_TEMA_MAP[eixoTematico] || eixoTematico) : null)
                    : tema) || null,
                tipo_agenda: effectiveTipoAgenda,
                data_inicio: dataInicio ? dataInicio : null,
                data_fim: dataInicio ? dataInicio : null,
                post_url: status === 'publicado' ? (postUrl.trim() || null) : null,
                registro_status: "ativo",
                ...(effectiveTipoAgenda === "GLOBAL" && unidadeId ? { unidade_id: unidadeId } : {}),
                municipio_id: effectiveTipoAgenda === "COMUNICACAO" ? (municipioIds[0] || null) : (municipioId || null),
                municipio_ids: effectiveTipoAgenda === "COMUNICACAO" ? (municipioIds || []) : (municipioId ? [municipioId] : []),
                captacao_by: captacaoBy || null,
                edicao_by: edicaoBy || null,
                texto_by: textoBy || null,
                publicacao_by: publicacaoBy || null,
                formato_midia: formatoMidia || null,
                eixo_tematico: eixoTematico || null,
                atendimento_id: resolvedAtendimentoId,
            };

            let currentTaskId = initialData?.id;
            const isRealEdit = isEdit && currentTaskId && UUID_REGEX.test(currentTaskId);

            if (isRealEdit && currentTaskId) {
                const { error: updateErr } = await supabase
                    .from("tasks")
                    .update(payload)
                    .eq("id", currentTaskId);
                if (updateErr) throw updateErr;

                // Update assignments: delete existing and insert new ones
                const { error: delAssignErr } = await supabase.from("task_assignments").delete().eq("task_id", currentTaskId);
                if (delAssignErr) console.error("Erro ao limpar responsáveis (ignorado):", delAssignErr);
            } else {
                const { data: inserted, error: insertErr } = await supabase
                    .from("tasks")
                    .insert({ ...payload, created_by: userId })
                    .select("id")
                    .single();
                if (insertErr) throw insertErr;
                currentTaskId = inserted.id;

                if (initialData?.staticEventId && onStaticEventConverted) {
                    onStaticEventConverted(initialData.staticEventId);
                }
            }

            // Insert new assignments (name-based, plain text)
            if (currentTaskId && selectedActivities.length > 0) {
                const { error: assignErr } = await supabase
                    .from("task_assignments")
                    .insert(selectedActivities.map(activityType => ({
                        name: userName || null,
                        user_id: userId,
                        activity_type: activityType,
                        task_id: currentTaskId,
                    })));
                if (assignErr) throw assignErr;
            }

            onSaved();
            onClose(); // Close the modal first

            // Trigger Meta Insights fetch asynchronously if status is 'publicado' and postUrl is present
            if (status === 'publicado' && postUrl && currentTaskId) {
                showToast("Buscando insights...", 'info');
                // Fire and forget (don't await) to prevent blocking the UI
                supabase.functions.invoke('sync-instagram', {
                    body: { task_id: currentTaskId, post_url: postUrl }
                }).then(async () => {
                    // Refresh the store again after insights are back to show new numbers
                    if (onUpdateStore) await onUpdateStore();
                    showToast("Insights prontos.", 'info');
                }).catch(err => {
                    console.error("Failed to trigger background insights job:", err);
                    showToast("Não consegui buscar os insights do Meta.", 'error');
                });
            } else if (onUpdateStore) {
                // If not triggered insights, just update the local store with basic changes
                await onUpdateStore();
            }

            // Upload manual photo if provided (no post_url scenario)
            if (status === 'publicado' && manualPhoto && currentTaskId && !postUrl.trim()) {
                setUploadingPhoto(true);
                try {
                    const ext = manualPhoto.name.split('.').pop() || 'jpg';
                    const fileName = `manual_${currentTaskId}.${ext}`;

                    const { error: uploadErr } = await supabase.storage
                        .from('thumbnails')
                        .upload(fileName, manualPhoto, { upsert: true, contentType: manualPhoto.type });

                    if (!uploadErr) {
                        const { data: urlData } = supabase.storage
                            .from('thumbnails')
                            .getPublicUrl(fileName);

                        if (urlData?.publicUrl) {
                            await supabase
                                .from('tasks')
                                .update({
                                    metrics_snapshot: {
                                        local_thumbnail_url: urlData.publicUrl,
                                        views: 0, likes: 0, comments: 0
                                    }
                                })
                                .eq('id', currentTaskId);

                            if (onUpdateStore) await onUpdateStore();
                            showToast("Foto salva.", 'info');
                        }
                    } else {
                        console.error("Upload error:", uploadErr);
                        showToast("Não consegui enviar a foto.", 'error');
                    }
                } catch (photoErr) {
                    console.error("Photo upload failed:", photoErr);
                    showToast("Erro ao processar a foto.", 'error');
                } finally {
                    setUploadingPhoto(false);
                }
            }

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Não consegui salvar.";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData?.id) return;

        setDeleting(true);
        setError(null);

        try {
            // Delete assignments first to avoid Foreign Key constraint errors
            const { error: assignErr } = await supabase.from("task_assignments").delete().eq("task_id", initialData.id);
            if (assignErr) throw assignErr;

            const { data: deleted, error: deleteErr } = await supabase
                .from("tasks")
                .delete()
                .eq("id", initialData.id)
                .select();
            if (deleteErr) throw deleteErr;
            if (deleted && deleted.length === 0) {
                throw new Error("Pauta não encontrada ou já excluída.");
            }

            onSaved();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Não consegui excluir.";
            setError(message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            {/* Custom Tailwind Toast in Portal-like behavior (fixed) */}
            {metaToast.show && (
                <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] bg-card ${
                        metaToast.type === 'error'
                            ? 'border-red-500/30 text-red-500'
                            : effectiveTipoAgenda === "GLOBAL"
                                ? 'border-primary/30 text-primary'
                                : 'border-violet-500/30 text-violet-500'
                        }`}>
                        {metaToast.type === 'info' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        <span className="text-sm font-medium">{metaToast.message}</span>
                    </div>
                </div>
            )}

            {open && (
                <div
                    ref={overlayRef}
                    onClick={handleOverlayClick}
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:items-center"
                >
                    <div
                        className={`w-full max-w-lg max-h-[85dvh] md:max-h-[90vh] flex flex-col transform border border-border bg-card shadow-xl transition-all duration-300 rounded-t-3xl md:rounded-[2rem] overflow-hidden ${open
                            ? "translate-y-0 opacity-100 scale-100"
                            : "translate-y-full opacity-0 md:translate-y-8 md:scale-95"
                            }`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-border px-6 py-5 shrink-0">
                            <h3 className="font-display text-lg font-bold text-foreground">
                                {isEdit ? "Editar pauta" : "Nova pauta"}
                            </h3>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {(canCheckIn || canViewBriefing) && (
                            <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3 shrink-0">
                                {canCheckIn && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedActivities.includes("captacao")) {
                                                setSelectedActivities((prev) => [...prev, "captacao"]);
                                            }
                                            showToast("Check-in pronto para este evento.", "info");
                                        }}
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100"
                                    >
                                        Registrar presença
                                    </button>
                                )}
                                {canViewBriefing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const descricaoField = document.getElementById("task-modal-descricao");
                                            descricaoField?.scrollIntoView({ behavior: "smooth", block: "center" });
                                            showToast("Briefing tático disponível neste evento.", "info");
                                        }}
                                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100"
                                    >
                                        Briefing tático
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            {/* Scrollable content container */}
                            <div className="space-y-4 px-5 py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            {/* Título */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                    Título *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    disabled={!canEdit}
                                    className={`w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-4 ${
                                        effectiveTipoAgenda === "GLOBAL"
                                            ? "focus:border-primary/50 focus:ring-primary/10"
                                            : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                    }`}
                                    placeholder="Ex: Cobertura do evento municipal"
                                    autoFocus
                                />
                            </div>

                            {/* Município */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                    {effectiveTipoAgenda === "COMUNICACAO" ? "Municípios Cobertos" : "Município"}
                                </label>
                                {effectiveTipoAgenda === "COMUNICACAO" ? (
                                    <MunicipioMultiSelect
                                        values={municipioIds}
                                        onChange={(ids) => setMunicipioIds(ids)}
                                        placeholder="Selecione os municípios associados..."
                                        disabled={!canEdit}
                                    />
                                ) : (
                                    <MunicipioAutocomplete
                                        value={municipioId}
                                        onChange={(id) => setMunicipioId(id)}
                                        placeholder="Selecione o município associado (opcional)..."
                                        disabled={!canEdit}
                                    />
                                )}
                                <CRMAlertBanner
                                    municipioId={effectiveTipoAgenda === "COMUNICACAO" ? (municipioIds[0] || null) : municipioId}
                                    className="mt-3"
                                />
                            </div>

                            {/* Atendimento Vinculado */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                    Vincular a Atendimento
                                </label>
                                <select
                                    value={atendimentoId}
                                    onChange={(e) => setAtendimentoId(e.target.value)}
                                    disabled={!canEdit}
                                    className={`w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-4 cursor-pointer ${
                                        effectiveTipoAgenda === "GLOBAL"
                                            ? "focus:border-primary/50 focus:ring-primary/10"
                                            : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                    }`}
                                >
                                    <option value="">Nenhum atendimento vinculado</option>
                                    <option value="new">✨ Gerar Novo Atendimento Automaticamente</option>
                                    {atendimentos.map((at) => (
                                        <option key={at.id} value={at.id}>
                                            {at.titulo} ({new Date(at.data).toLocaleDateString("pt-BR")})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {effectiveTipoAgenda === "COMUNICACAO" ? (
                                <>
                                    {/* Grid de Status, Tipo e Data */}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {/* Status */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Status
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground">
                                                    {status === "pendente" && <Clock className="h-4 w-4" />}
                                                    {status === "publicado" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                </span>
                                                <select
                                                    value={status}
                                                    onChange={(e) => setStatus(e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-full appearance-none rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:ring-4 focus:border-violet-500/50 focus:ring-violet-500/10"
                                                >
                                                    {TASK_STATUSES.map((s) => (
                                                        <option key={s.value} value={s.value} className="bg-card">
                                                            {s.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Tipo */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Tipo
                                            </label>
                                            <select
                                                value={eventType}
                                                onChange={(e) => setEventType(e.target.value)}
                                                disabled={!canEdit}
                                                className="w-full appearance-none rounded-xl border border-border bg-background py-3 px-4 text-sm text-foreground outline-none transition-all focus:ring-4 focus:border-violet-500/50 focus:ring-violet-500/10"
                                            >
                                                {COMMS_EVENT_TYPES.map((e) => (
                                                    <option key={e.value} value={e.value} className="bg-card">
                                                        {e.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Data e Horário */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Data e Horário
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={dataInicio}
                                                onChange={(e) => setDataInicio(e.target.value)}
                                                disabled={!canEdit}
                                                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-4 focus:border-violet-500/50 focus:ring-violet-500/10"
                                            />
                                        </div>
                                    </div>

                                    {/* Observer: Visível quando Status é "Publicado" */}
                                    {status === "publicado" && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
                                            {/* Link da publicação (agora opcional) */}
                                            <div>
                                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                                                    Link da publicação <span className="font-normal normal-case opacity-70">(opcional)</span>
                                                </label>
                                                <input
                                                    type="url"
                                                    value={postUrl}
                                                    onChange={(e) => setPostUrl(e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-full rounded-xl border border-green-500 bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-green-600 focus:ring-4 focus:ring-green-500/20"
                                                    placeholder="https://instagram.com/p/..."
                                                />
                                            </div>

                                            {/* Separador OU */}
                                            {!postUrl.trim() && (
                                                <>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-px flex-1 bg-border" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ou envie uma foto</span>
                                                        <div className="h-px flex-1 bg-border" />
                                                    </div>

                                                    {/* Upload de foto manual */}
                                                    <div>
                                                        <input
                                                            ref={photoInputRef}
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/webp"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setManualPhoto(file);
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setManualPhotoPreview(reader.result as string);
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />

                                                        {manualPhotoPreview ? (
                                                            <div className="relative group">
                                                                <img
                                                                    src={manualPhotoPreview}
                                                                    alt="Preview"
                                                                    className="w-full max-h-48 object-contain rounded-xl border border-border bg-background"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setManualPhoto(null);
                                                                        setManualPhotoPreview(null);
                                                                        if (photoInputRef.current) photoInputRef.current.value = '';
                                                                    }}
                                                                    className="absolute top-2 right-2 rounded-full bg-red-500/90 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                onClick={() => photoInputRef.current?.click()}
                                                                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-6 text-muted-foreground transition-all hover:border-violet-500/40 hover:bg-violet-50 hover:text-violet-600"
                                                            >
                                                                {uploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                                                <span className="text-sm font-medium">
                                                                    {uploadingPhoto ? "Enviando foto..." : "Enviar foto da agenda"}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Fluxo de Produção (Híbrido) */}
                                    {!isEdit ? (
                                        // 1. ESTADO DE CRIAÇÃO (Nova Pauta)
                                        <div className="rounded-2xl border border-border bg-slate-50/50 p-4 space-y-3">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                                Quais etapas você executou nesta pauta?
                                            </label>
                                            <div className="flex flex-wrap gap-2.5">
                                                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer hover:bg-slate-50 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={captacaoBy === userId}
                                                        onChange={(e) => setCaptacaoBy(e.target.checked ? userId : "")}
                                                        disabled={!canEdit}
                                                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                                                    />
                                                    <span>📷 Captação</span>
                                                </label>
                                                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer hover:bg-slate-50 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={edicaoBy === userId}
                                                        onChange={(e) => setEdicaoBy(e.target.checked ? userId : "")}
                                                        disabled={!canEdit}
                                                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                                                    />
                                                    <span>🎨 Edição</span>
                                                </label>
                                                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer hover:bg-slate-50 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={textoBy === userId}
                                                        onChange={(e) => setTextoBy(e.target.checked ? userId : "")}
                                                        disabled={!canEdit}
                                                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                                                    />
                                                    <span>✍️ Texto</span>
                                                </label>
                                                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer hover:bg-slate-50 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={publicacaoBy === userId}
                                                        onChange={(e) => setPublicacaoBy(e.target.checked ? userId : "")}
                                                        disabled={!canEdit}
                                                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                                                    />
                                                    <span>🌐 Publicação</span>
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        // 2. ESTADO DE EDIÇÃO (Pauta Existente - Claim System)
                                        <div className="rounded-2xl border border-border bg-slate-50/50 p-4 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-border pb-2">
                                                Fluxo de Produção
                                            </h4>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {STEPS.map((step) => {
                                                    const responsibleId =
                                                        step.key === "captacao" ? captacaoBy :
                                                        step.key === "edicao" ? edicaoBy :
                                                        step.key === "texto" ? textoBy :
                                                        publicacaoBy;

                                                    const handleClaim = () => handleClaimStep(step.key);
                                                    const handleUnclaim = () => handleUnclaimStep(step.key);
                                                    const nameOfResponsible = getUserNameById(responsibleId);

                                                    return (
                                                        <div key={step.key} className="flex flex-col justify-between rounded-xl border border-border bg-background p-3 shadow-sm min-h-[82px]">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                    {step.label}
                                                                </span>
                                                                {responsibleId && (
                                                                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                                        <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                                                                        Feito
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {responsibleId ? (
                                                                <div className="flex items-center justify-between gap-2 mt-1">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
                                                                            {nameOfResponsible ? nameOfResponsible.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : ""}
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-foreground truncate">
                                                                            {nameOfResponsible}
                                                                        </span>
                                                                    </div>

                                                                    {(responsibleId === userId || profile?.cargo === "chefia") && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleUnclaim}
                                                                            className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider pl-1.5 shrink-0"
                                                                        >
                                                                            Remover
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={!canEdit}
                                                                    onClick={handleClaim}
                                                                    className="w-full mt-1 flex h-8 items-center justify-center rounded-lg border border-dashed border-violet-200 bg-violet-50/20 text-xs font-semibold text-violet-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {step.actionLabel}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Classificação Estratégica */}
                                    <div className="rounded-2xl border border-border bg-slate-50/50 p-4 space-y-4">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-border pb-2">
                                            Classificação Estratégica
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Formato de Mídia */}
                                            <div>
                                                <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                                    Formato de Mídia
                                                </label>
                                                <select
                                                    value={formatoMidia}
                                                    onChange={(e) => setFormatoMidia(e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-full rounded-lg border border-border bg-background py-1.5 px-2 text-xs outline-none focus:border-violet-500/50">
                                                    <option value="">Selecione...</option>
                                                    {formatos.map((f) => (
                                                        <option key={f.chave} value={f.chave}>
                                                            {f.nome}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Eixo Temático */}
                                            <div>
                                                <label className="mb-1 block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                                    Eixo Temático
                                                </label>
                                                <select
                                                    value={eixoTematico}
                                                    onChange={(e) => setEixoTematico(e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-full rounded-lg border border-border bg-background py-1.5 px-2 text-xs outline-none focus:border-violet-500/50"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {eixos.map((e) => (
                                                        <option key={e.chave} value={e.chave}>
                                                            {e.nome}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Descrição */}
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                            Descrição
                                        </label>
                                        <textarea
                                            id="task-modal-descricao"
                                            value={descricao}
                                            onChange={(e) => setDescricao(e.target.value)}
                                            rows={3}
                                            disabled={!canEdit}
                                            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-4 focus:border-violet-500/50 focus:ring-violet-500/10"
                                            placeholder="Detalhes da pauta..."
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Status & Event Type Row */}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {/* Status */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Status
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-foreground">
                                                    {status === "pendente" && <Clock className="h-4 w-4" />}
                                                    {status === "publicado" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                </span>
                                                <select
                                                    value={status}
                                                    onChange={(e) => setStatus(e.target.value)}
                                                    disabled={!canEdit}
                                                    className={`w-full appearance-none rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-all focus:ring-4 ${
                                                        effectiveTipoAgenda === "GLOBAL"
                                                            ? "focus:border-primary/50 focus:ring-primary/10"
                                                            : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                                    }`}
                                                >
                                                    {TASK_STATUSES.map((s) => (
                                                        <option key={s.value} value={s.value} className="bg-card">
                                                            {s.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Tipo de Evento */}
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Tipo
                                            </label>
                                            <select
                                                value={eventType}
                                                onChange={(e) => setEventType(e.target.value)}
                                                disabled={!canEdit}
                                                className={`w-full appearance-none rounded-xl border border-border bg-background py-3 px-4 text-sm text-foreground outline-none transition-all focus:ring-4 ${
                                                    effectiveTipoAgenda === "GLOBAL"
                                                        ? "focus:border-primary/50 focus:ring-primary/10"
                                                        : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                                }`}
                                            >
                                                {(effectiveTipoAgenda === "GLOBAL" ? EVENT_TYPES : COMMS_EVENT_TYPES).map((e) => (
                                                    <option key={e.value} value={e.value} className="bg-card">
                                                        {e.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Tema da Pauta (Novo Campo) */}
                                    <div>
                                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Tag className="w-3.5 h-3.5" />
                                            Tema
                                        </label>
                                        <select
                                            value={tema}
                                            onChange={(e) => setTema(e.target.value)}
                                            disabled={!canEdit}
                                            className={`w-full appearance-none rounded-xl border border-border bg-background py-3 px-4 text-sm text-foreground outline-none transition-all focus:ring-4 ${
                                                effectiveTipoAgenda === "GLOBAL"
                                                    ? "focus:border-primary/50 focus:ring-primary/10"
                                                    : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                            }`}
                                        >
                                            <option value="">Selecione um tema (Opcional)</option>
                                            {TEMAS.map((t) => (
                                                <option key={t.value} value={t.value} className="bg-card">
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Observer: Visível quando Status é "Publicado" */}
                                    {status === "publicado" && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
                                            {/* Link da publicação (agora opcional) */}
                                            <div>
                                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                                                    Link da publicação <span className="font-normal normal-case opacity-70">(opcional)</span>
                                                </label>
                                                <input
                                                    type="url"
                                                    value={postUrl}
                                                    onChange={(e) => setPostUrl(e.target.value)}
                                                    disabled={!canEdit}
                                                    className="w-full rounded-xl border border-green-500 bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-green-600 focus:ring-4 focus:ring-green-500/20"
                                                    placeholder="https://instagram.com/p/..."
                                                />
                                            </div>

                                            {/* Separador OU */}
                                            {!postUrl.trim() && (
                                                <>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-px flex-1 bg-border" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ou envie uma foto</span>
                                                        <div className="h-px flex-1 bg-border" />
                                                    </div>

                                                    {/* Upload de foto manual */}
                                                    <div>
                                                        <input
                                                            ref={photoInputRef}
                                                            type="file"
                                                            accept="image/png,image/jpeg,image/webp"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setManualPhoto(file);
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setManualPhotoPreview(reader.result as string);
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />

                                                        {manualPhotoPreview ? (
                                                            <div className="relative group">
                                                                <img
                                                                    src={manualPhotoPreview}
                                                                    alt="Preview"
                                                                    className="w-full max-h-48 object-contain rounded-xl border border-border bg-background"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setManualPhoto(null);
                                                                        setManualPhotoPreview(null);
                                                                        if (photoInputRef.current) photoInputRef.current.value = '';
                                                                    }}
                                                                    className="absolute top-2 right-2 rounded-full bg-red-500/90 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                onClick={() => photoInputRef.current?.click()}
                                                                className={`flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-6 text-muted-foreground transition-all ${
                                                                    effectiveTipoAgenda === "GLOBAL"
                                                                        ? "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                                                        : "hover:border-violet-500/40 hover:bg-violet-50 hover:text-violet-600"
                                                                }`}
                                                            >
                                                                {uploadingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                                                <span className="text-sm font-medium">
                                                                    {uploadingPhoto ? "Enviando foto..." : "Enviar foto da agenda"}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Dates row */}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                                Data e Horário
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={dataInicio}
                                                onChange={(e) => setDataInicio(e.target.value)}
                                                disabled={!canEdit}
                                                className={`w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-all focus:ring-4 ${
                                                    effectiveTipoAgenda === "GLOBAL"
                                                        ? "focus:border-primary/50 focus:ring-primary/10"
                                                        : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                                }`}
                                            />
                                        </div>
                                    </div>

                                    {/* Atividades */}
                                    <div className="rounded-xl border border-border bg-background/50 p-4">
                                        <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Atividades <span className="ml-1 text-[10px] font-normal normal-case opacity-70">(Opcional)</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {ACTIVITY_TYPES.filter(act => {
                                                if (eventType === "aniversario_cidade" || eventType === "data_comemorativa") {
                                                    return act.value === "publicacao";
                                                }
                                                return true;
                                            }).map((act) => {
                                                const isSelected = selectedActivities.includes(act.value);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={act.value}
                                                        onClick={() => toggleActivity(act.value)}
                                                        disabled={!canEdit}
                                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-all active:scale-95 ${isSelected
                                                            ? effectiveTipoAgenda === "GLOBAL"
                                                                ? "border border-primary/30 bg-primary/10 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                                                : "border border-violet-300 bg-violet-100/50 text-violet-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                                            : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                                                            }`}
                                                    >
                                                        {act.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Descrição */}
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                            Descrição
                                        </label>
                                        <textarea
                                            id="task-modal-descricao"
                                            value={descricao}
                                            onChange={(e) => setDescricao(e.target.value)}
                                            rows={3}
                                            disabled={!canEdit}
                                            className={`w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:ring-4 ${
                                                effectiveTipoAgenda === "GLOBAL"
                                                    ? "focus:border-primary/50 focus:ring-primary/10"
                                                    : "focus:border-violet-500/50 focus:ring-violet-500/10"
                                            }`}
                                            placeholder="Detalhes da pauta..."
                                        />
                                    </div>
                                </>
                            )}
                            </div>

                            {/* Fixed Footer */}
                            <div className="border-t border-border px-6 py-4 bg-slate-50/50 shrink-0 space-y-3">
                                {/* Error */}
                                {error && (
                                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                                        {error}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-3 w-full">
                                    {isEdit && canEdit && (
                                        confirmDelete ? (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                <span className="text-xs font-semibold text-red-500">Excluir pauta?</span>
                                                <button
                                                    type="button"
                                                    onClick={handleDelete}
                                                    disabled={deleting}
                                                    className="flex h-8 items-center justify-center rounded-lg bg-red-500/10 px-4 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
                                                >
                                                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Excluir"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDelete(false)}
                                                    disabled={deleting}
                                                    className="flex h-8 items-center justify-center rounded-lg bg-muted px-4 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-50"
                                                >
                                                    Voltar
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDelete(true)}
                                                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 transition-all hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Excluir
                                            </button>
                                        )
                                    )}

                                    <div className="ml-auto flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                                        >
                                            Cancelar
                                        </button>
                                        {canEdit && (
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                                                    effectiveTipoAgenda === "GLOBAL"
                                                        ? "bg-primary hover:bg-primary-hover text-primary-foreground"
                                                        : "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 text-white hover:opacity-95 shadow-md shadow-violet-500/25 border border-violet-500/10"
                                                }`}
                                            >
                                                {saving ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Save className="h-3.5 w-3.5" />
                                                )}
                                                Salvar pauta
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
