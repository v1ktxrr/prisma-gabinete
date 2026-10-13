"use client";

import { useEffect, useRef, useState } from "react";
import {
    CalendarRange,
    Loader2,
    MapPin,
    Save,
    Type,
    X,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import type { TipoAgenda } from "@/lib/types";

export type AgendaEventFormData = {
    id?: string;
    titulo: string;
    local: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    tipo_agenda?: TipoAgenda;
};

type CreateEventModalProps = {
    open: boolean;
    onClose: () => void;
    onSaved: (message: string) => Promise<void> | void;
    initialData?: AgendaEventFormData;
    canEdit?: boolean;
    tipoAgenda?: TipoAgenda;
};

function toLocalDatetime(iso: string | undefined): string {
    if (!iso) return "";

    if (iso.length === 10) {
        return `${iso}T09:00`;
    }

    const date = new Date(iso.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";

    const pad = (value: number) => value.toString().padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateEventModal({
    open,
    onClose,
    onSaved,
    initialData,
    canEdit = true,
    tipoAgenda = "GLOBAL",
}: CreateEventModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const { unidadeId } = usePermissions();
    const isEdit = Boolean(initialData?.id);

    const [titulo, setTitulo] = useState(initialData?.titulo || "");
    const [local, setLocal] = useState(initialData?.local || "");
    const [descricao, setDescricao] = useState(initialData?.descricao || "");
    const [dataInicio, setDataInicio] = useState(toLocalDatetime(initialData?.data_inicio));
    const [dataFim, setDataFim] = useState(toLocalDatetime(initialData?.data_fim));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        if (open) {
            window.addEventListener("keydown", onKeyDown);
        }

        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === overlayRef.current) {
            onClose();
        }
    };

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!titulo.trim()) {
            setError("Informe o título do evento.");
            return;
        }

        if (!dataInicio) {
            setError("Informe a data e a hora de início.");
            return;
        }

        if (!unidadeId) {
            setError("Não consegui identificar a unidade do usuário.");
            return;
        }

        setSaving(true);
        setError(null);

        const payload = {
            id: initialData?.id,
            titulo: titulo.trim(),
            local: local.trim() || null,
            descricao: descricao.trim() || null,
            data_inicio: dataInicio,
            data_fim: dataFim || dataInicio,
            unidade_id: unidadeId,
            tipo_agenda: tipoAgenda,
        };

        try {
            const response = await fetch("/api/pre-agenda/upsert", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responsePayload = (await response.json()) as { error?: string; success?: boolean };
            if (!response.ok || !responsePayload.success) {
                throw new Error(responsePayload.error || "Não consegui salvar o evento.");
            }

            await onSaved(isEdit ? "Evento atualizado." : "Evento criado.");
            onClose();
        } catch (saveError) {
            const message =
                saveError instanceof Error
                    ? saveError.message
                    : "Não consegui salvar o evento.";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm md:items-center md:p-4"
        >
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] md:rounded-[28px]">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Agenda global
                        </p>
                        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                            {isEdit ? "Editar evento" : "Novo evento"}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Formulário direto para criar compromissos no calendário oficial.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto bg-slate-50 px-5 py-5 md:px-6">
                    <div className="space-y-5">
                        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <label className="block">
                                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                    <Type className="h-3.5 w-3.5" />
                                    Título do evento
                                </span>
                                <input
                                    type="text"
                                    value={titulo}
                                    onChange={(event) => setTitulo(event.target.value)}
                                    disabled={!canEdit || saving}
                                    required
                                    autoFocus
                                    placeholder="Ex: Reunião com lideranças municipais"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </label>
                        </section>

                        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Local
                                    </span>
                                    <div className="relative">
                                        <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={local}
                                            onChange={(event) => setLocal(event.target.value)}
                                            disabled={!canEdit || saving}
                                            placeholder="Endereço, ponto de referência ou link do mapa"
                                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-850 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </div>
                                </label>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                    <CalendarRange className="h-3.5 w-3.5" />
                                    Data e Hora
                                </div>
                                <div className="grid gap-3">
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-slate-500">Início</span>
                                        <input
                                            type="datetime-local"
                                            value={dataInicio}
                                            onChange={(event) => setDataInicio(event.target.value)}
                                            disabled={!canEdit || saving}
                                            required
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-805 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </label>

                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-semibold text-slate-500">Fim</span>
                                        <input
                                            type="datetime-local"
                                            value={dataFim}
                                            onChange={(event) => setDataFim(event.target.value)}
                                            disabled={!canEdit || saving}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-805 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </label>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <label className="block">
                                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Descrição
                                </span>
                                <textarea
                                    value={descricao}
                                    onChange={(event) => setDescricao(event.target.value)}
                                    disabled={!canEdit || saving}
                                    rows={7}
                                    placeholder="Observacoes gerais sobre o evento, participantes esperados, contexto e orientacoes."
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-805 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </label>
                        </section>

                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-550 transition-all hover:bg-white hover:text-slate-800 active:scale-95 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        {canEdit && (
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? "Salvando..." : "Salvar evento"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
