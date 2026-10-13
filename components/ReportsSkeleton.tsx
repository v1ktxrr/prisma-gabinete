"use client";

import { useEffect, useState } from "react";

const PROCESSING_MESSAGES = [
    "Processando integrações de dados...",
    "Consolidando métricas de alcance...",
    "Validando dados do Meta e GA4...",
    "Cruzando indicadores de engajamento...",
    "Gerando inteligência de dados...",
    "Sincronizando métricas de desempenho...",
];

export default function ReportsSkeleton() {
    const [msgIndex, setMsgIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col gap-10 bg-background p-2 md:p-4 animate-in fade-in duration-500">

            {/* Mensagem de Status Rotativa */}
            <div className="flex items-center justify-center gap-3 py-2">
                <div className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
                </div>
                <p className="text-sm font-medium text-slate-500 transition-all duration-500">
                    {PROCESSING_MESSAGES[msgIndex]}
                </p>
            </div>

            {/* ===== NÍVEL ESTRATÉGICO — KPI Cards Skeleton ===== */}
            <section>
                <div className="h-4 w-40 rounded skeleton-shimmer mb-5"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    {/* Estrela Guia (Visualizações) — Card Dominante */}
                    <div className="md:col-span-2 rounded-2xl border border-slate-200/60 bg-white p-7">
                        <div className="h-3 w-24 rounded skeleton-shimmer mb-4"></div>
                        <div className="h-14 w-48 rounded-lg skeleton-shimmer mb-3"></div>
                        <div className="h-3 w-32 rounded skeleton-shimmer"></div>
                    </div>
                    {/* Curtidas — Card Secundário */}
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6">
                        <div className="h-3 w-16 rounded skeleton-shimmer mb-4"></div>
                        <div className="h-10 w-28 rounded-lg skeleton-shimmer mb-3"></div>
                        <div className="h-3 w-20 rounded skeleton-shimmer"></div>
                    </div>
                    {/* Comentários — Card Secundário */}
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6">
                        <div className="h-3 w-20 rounded skeleton-shimmer mb-4"></div>
                        <div className="h-10 w-24 rounded-lg skeleton-shimmer mb-3"></div>
                        <div className="h-3 w-20 rounded skeleton-shimmer"></div>
                    </div>
                </div>
            </section>

            {/* ===== Filtro Skeleton ===== */}
            <div className="flex items-center gap-4 py-1">
                <div className="h-9 w-48 rounded-lg skeleton-shimmer"></div>
                <div className="h-5 w-px bg-slate-200"></div>
                <div className="h-9 w-32 rounded-lg skeleton-shimmer"></div>
            </div>

            {/* ===== NÍVEL TÁTICO — Timeline + Produtividade ===== */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Timeline de Entregas Skeleton */}
                <section className="lg:col-span-2">
                    <div className="h-5 w-52 rounded skeleton-shimmer mb-5"></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
                                {/* Thumbnail Skeleton */}
                                <div className="aspect-[9/16] w-full skeleton-shimmer"></div>
                                <div className="p-5">
                                    <div className="h-4 w-3/4 rounded skeleton-shimmer mb-3"></div>
                                    <div className="h-3 w-1/2 rounded skeleton-shimmer mb-4"></div>
                                    <div className="flex gap-4 mt-4">
                                        <div className="h-4 w-12 rounded skeleton-shimmer"></div>
                                        <div className="h-4 w-12 rounded skeleton-shimmer"></div>
                                        <div className="h-4 w-12 rounded skeleton-shimmer"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Produtividade Skeleton */}
                <section className="lg:col-span-1">
                    <div className="h-5 w-32 rounded skeleton-shimmer mb-5"></div>
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3 mb-5 last:mb-0">
                                <div className="h-10 w-10 rounded-full skeleton-shimmer shrink-0"></div>
                                <div className="flex-1">
                                    <div className="h-4 w-28 rounded skeleton-shimmer mb-2"></div>
                                    <div className="h-3 w-20 rounded skeleton-shimmer"></div>
                                </div>
                                <div className="h-10 w-10 rounded-full skeleton-shimmer shrink-0"></div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* ===== NÍVEL OPERACIONAL — BI Cards Skeleton ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Termômetro Skeleton */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div className="h-5 w-44 rounded skeleton-shimmer"></div>
                        <div className="h-6 w-28 rounded-full skeleton-shimmer"></div>
                    </div>
                    <div className="h-6 w-32 rounded skeleton-shimmer mb-2"></div>
                    <div className="h-3 w-40 rounded skeleton-shimmer mb-4"></div>
                    <div className="h-3 w-full rounded-full skeleton-shimmer"></div>
                </div>

                {/* Eixo Temático Skeleton */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-5">
                    <div className="h-5 w-48 rounded skeleton-shimmer mb-6"></div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 mb-4 last:mb-0">
                            <div className="h-4 w-24 rounded skeleton-shimmer shrink-0"></div>
                            <div className="flex-1 h-2.5 rounded-full skeleton-shimmer"></div>
                            <div className="h-4 w-10 rounded skeleton-shimmer shrink-0"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
