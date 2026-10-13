"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import Datepicker from "react-tailwindcss-datepicker";
import Header from "@/components/header";
import { supabase } from "@/lib/supabase";
import { getMetaMetrics, getTopPosts, MetaMetrics, TopPost } from "@/lib/api-meta";
import { getGa4Metrics, Ga4Metrics } from "@/lib/api-ga4";
import {
    Download,
    Heart,
    Loader2,
    MessageCircle,
    Eye,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    RefreshCw
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useGerarDadosRelatorioPDF, RelatorioAdapterResult } from "@/hooks/useGerarDadosRelatorioPDF";
import RelatorioPDF from "@/components/RelatorioPDF";
import DesempenhoTematico from "@/components/DesempenhoTematico";
import TermometroTracao from "@/components/TermometroTracao";
import ReportsSkeleton from '../ReportsSkeleton';
import { CalendarioEvent, TaskMetrics } from "@/lib/types";

const GLOBAL_EVENT_TYPES = ["aniversario_cidade", "data_comemorativa"] as const;
const TIMBRADO_NATIVO = "/timbrado-relatorio.png";

interface TaskRow {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    event_type: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    post_url: string | null;
    metrics_snapshot?: TaskMetrics | null;
    tema: string | null;
    created_by?: string | null;
}

type DatepickerValue = {
    startDate?: string | Date | null;
    endDate?: string | Date | null;
} | null;

function formatDatepickerValue(value: string | Date | null | undefined) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    return value;
}

function mapTaskToCalendarEvent(task: TaskRow): CalendarioEvent {
    return {
        id: task.id,
        title: task.titulo,
        start: task.data_inicio,
        end: task.data_fim,
        status: task.status,
        event_type: task.event_type || undefined,
        descricao: task.descricao,
        post_url: task.post_url || undefined,
        metrics_snapshot: task.metrics_snapshot,
        tema: task.tema || undefined,
        created_by: task.created_by || undefined,
    };
}

export default function RelatoriosView() {
    const { user, loading: authLoading } = useAuth();
    const { isOfflineMode, eventsCache, setEventsCache, setLastSynced, setOfflineMode } = useAppStore();
    const reportRef = useRef<HTMLDivElement>(null);

    const [metaMetrics, setMetaMetrics] = useState<MetaMetrics | null>(null);
    const [ga4Metrics, setGa4Metrics] = useState<Ga4Metrics | null>(null);

    const [loading, setLoading] = useState(true);
    const { fetchDadosRelatorio, loadingPdfData } = useGerarDadosRelatorioPDF();
    const [pdfRenderData, setPdfRenderData] = useState<RelatorioAdapterResult | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('este_mes');
    const [dataInicio, setDataInicio] = useState<string>('');
    const [dataFim, setDataFim] = useState<string>('');

    // Sync individual post
    const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);

    const handleSyncPost = async (taskId: string, postUrl: string | undefined) => {
        if (!postUrl) {
            alert("Esta tarefa não possui URL do Instagram vinculada.");
            return;
        }
        setSyncingTaskId(taskId);
        try {
            const { error: invokeErr } = await supabase.functions.invoke('sync-instagram', {
                body: { task_id: taskId, post_url: postUrl }
            });
            if (invokeErr) throw invokeErr;
            await fetchReportData(); // Reloads exactly same UI with new metrics
        } catch (err) {
            console.error("Manual sync failed:", err);
            alert("Erro ao sincronizar. Verifique se a URL vinculada é pública.");
        } finally {
            setSyncingTaskId(null);
        }
    };

    const handleSyncAll = async () => {
        const posts = uniqueEventsForMetrics.filter(e => e.post_url);
        if (posts.length === 0) {
            alert("Não há posts com URL vinculada neste período.");
            return;
        }
        
        const confirmSync = window.confirm(`Atenção: Você está prestes a sincronizar manualmente ${posts.length} entregas agendadas do Instagram no Apify. Isso pode levar alguns minutos e consome capacidade da plataforma. Deseja continuar?`);
        if (!confirmSync) return;

        setIsSyncingAll(true);
        setSyncProgress(0);
        let successCount = 0;

        for (let i = 0; i < posts.length; i++) {
            const event = posts[i];
            try {
                setSyncingTaskId(event.id);
                const { error: invokeErr } = await supabase.functions.invoke('sync-instagram', {
                    body: { task_id: event.id, post_url: event.post_url }
                });
                if (invokeErr) throw invokeErr;
                successCount++;
            } catch (err) {
                console.error("Failed to sync", event.id);
            }
            setSyncProgress(Math.round(((i + 1) / posts.length) * 100));
        }

        setSyncingTaskId(null);
        setIsSyncingAll(false);
        await fetchReportData();
        alert(`Sincronização em massa concluída! ${successCount} de ${posts.length} posts atualizados com a última versão do Apify.`);
    };

    // Custom Select Dropdown State
    const [isPeriodoDropdownOpen, setIsPeriodoDropdownOpen] = useState(false);
    const periodoDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (periodoDropdownRef.current && !periodoDropdownRef.current.contains(e.target as Node)) {
                setIsPeriodoDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch all report data
    const fetchReportData = async () => {
        if (isOfflineMode) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch Mock APIs (Meta and GA4)
            const meta = await getMetaMetrics();
            const ga4 = await getGa4Metrics();

            setMetaMetrics(meta);
            setGa4Metrics(ga4);

            // 2. Fetch user-centric tasks plus global exceptions.
            const { data: tasksData, error: tasksError } = await supabase
                .from("tasks")
                .select("id, titulo, descricao, status, event_type, data_inicio, data_fim, post_url, metrics_snapshot, tema, created_by")
                .or(`created_by.eq.${user?.id},event_type.in.(${GLOBAL_EVENT_TYPES.join(",")})`)
                .order("data_inicio", { ascending: false })
                .limit(5000);

            if (!tasksError && tasksData) {
                setEventsCache((tasksData as TaskRow[]).map(mapTaskToCalendarEvent));
                setLastSynced(Date.now());
                setOfflineMode(false);
            }

        } catch (err) {
            console.error("Error fetching report data:", err);
        } finally {
            setLoading(false);
        }
    };

    const hasFetched = useRef(false);

    useEffect(() => {
        // QUEBRA DE LOOP:
        // Removido 'dataInicio' e 'dataFim' do array.
        // Como o React filtra os dados visualmente embaixo, refazer o fetch inteiro a cada clique travava tudo com 45s de espera.
        if (user && !hasFetched.current) {
            hasFetched.current = true;
            fetchReportData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Update dataInicio and dataFim based on periodoSelecionado
    useEffect(() => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (periodoSelecionado) {
            case 'este_mes':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'mes_passado':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'ultimos_7_dias':
                start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
                end = today;
                break;
            case 'este_ano':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
            case 'personalizado':
                return; // Let user specify via inputs
        }

        const pad = (n: number) => n.toString().padStart(2, '0');
        if (periodoSelecionado !== 'personalizado') {
            setDataInicio(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
            setDataFim(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`);
        }
    }, [periodoSelecionado]);

    // Export PDF Logic — Print via novo motor em React Components
    const handleExportPDF = async () => {
        if (!user) return;

        setIsGenerating(true);
        const dateRange = {
            startDate: dataInicio || null,
            endDate: dataFim || null
        };

        try {
            const result = await fetchDadosRelatorio(user.id, dateRange);
            if (result) {
                setPdfRenderData(result);

                // O React renderizará o container na DOM (em display invisível mas acessível a print)
                setTimeout(() => {
                    window.print();

                    // Finaliza e esconde após a janela de impressão se fechar
                    setTimeout(() => {
                        setIsGenerating(false);
                        setPdfRenderData(null);
                    }, 500);
                }, 400); // 400ms garantem que as img urls (thumnbails e timbrado) finalizem o render
            } else {
                alert("Não existem dados válidos para gerar o relatório.");
                setIsGenerating(false);
            }
        } catch (err) {
            console.error("Erro ao preparar PDF:", err);
            alert("Houve um erro ao processar os dados para PDF. Tente novamente.");
            setIsGenerating(false);
        }
    };

    // DESBLOQUEIO DE TELA (REMOVIDO): 
    // O early return que retornava a tela toda preta com Loader sumiu.
    // Agora o React desce imediatamente, desenha o layout 'casca' (Header e Título),
    // e mostra o loader APENAS no miolo dos cards, enquanto o banco carrega no background.

    // Date range filtering
    const publishedEvents = eventsCache
        .filter((e) => {
            if (e.status !== "publicado") return false;

            // Apply strict date filtering
            if (dataInicio && dataFim && e.start) {
                // Ensure correct comparison format (YYYY-MM-DD)
                const eventDate = new Date(e.start).toISOString().split('T')[0];
                if (eventDate < dataInicio || eventDate > dataFim) return false;
            }
            return true;
        })
        .sort((a, b) => new Date(b.start || 0).getTime() - new Date(a.start || 0).getTime());

    // Normalize URL to abstract shortcode or clean path for deduplication
    const getCleanedUrl = (url: string) => {
        if (!url) return '';
        try {
            const match = url.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
            if (match && match[1]) return match[1];
            return url.split('?')[0].replace(/\/$/, "");
        } catch {
            return url;
        }
    };

    // Calculate Real Metrics (Deduplicate multiple events with the same post_url)
    const uniqueEventsForMetrics = publishedEvents.reduce((acc, ev) => {
        if (ev.post_url) {
            const cleanUrl = getCleanedUrl(ev.post_url);
            if (!acc.some(a => a.post_url && getCleanedUrl(a.post_url) === cleanUrl)) {
                acc.push(ev);
            }
        } else {
            acc.push(ev);
        }
        return acc;
    }, [] as typeof publishedEvents);

    const realTotalViews = uniqueEventsForMetrics.reduce((acc, ev) => acc + (ev.metrics_snapshot?.views || 0), 0);
    const realTotalEngajamento = uniqueEventsForMetrics.reduce((acc, ev) => acc + (
        (ev.metrics_snapshot?.likes || 0) +
        (ev.metrics_snapshot?.comments || 0) +
        (ev.metrics_snapshot?.shares || 0) +
        (ev.metrics_snapshot?.saved || 0)
    ), 0);
    const realTotalCurtidas = uniqueEventsForMetrics.reduce((acc, ev) => acc + (ev.metrics_snapshot?.likes || 0), 0);
    const realTotalComentarios = uniqueEventsForMetrics.reduce((acc, ev) => acc + (ev.metrics_snapshot?.comments || 0), 0);

    // Helper to get Icon and Color based on event type
    const getEventTypeConfig = (type: string) => {
        switch (type) {
            case "agenda_oficial": return { label: "Agenda Oficial", color: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" };
            case "aniversario_cidade": return { label: "Aniversário da Cidade", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" };
            case "data_comemorativa": return { label: "Data Comemorativa", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" };
            default: return { label: "Diversos", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20" };
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        return num.toString();
    };

    return (
        <>
            <div className="flex min-h-screen flex-col bg-background print:hidden">
                <Header />

                <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
                    {/* Header Global c/ Export e Filtros */}
                    <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end w-full">
                        <div>
                            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
                                Painel Executivo
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">Monitoramento consolidado e performance institucional.</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {/* Filtro Global Elevado */}
                            <div className="relative" ref={periodoDropdownRef}>
                                <button
                                    onClick={() => setIsPeriodoDropdownOpen(!isPeriodoDropdownOpen)}
                                    className="flex items-center justify-between min-w-[180px] bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span>
                                            {periodoSelecionado === 'este_mes' && "Este Mês"}
                                            {periodoSelecionado === 'mes_passado' && "Mês Passado"}
                                            {periodoSelecionado === 'ultimos_7_dias' && "Últimos 7 Dias"}
                                            {periodoSelecionado === 'este_ano' && "Este Ano"}
                                            {periodoSelecionado === 'personalizado' && "Personalizado"}
                                        </span>
                                    </div>
                                    <ChevronDown className={`h-4 w-4 ml-2 text-slate-400 transition-transform ${isPeriodoDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isPeriodoDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-2 z-50 w-[200px] bg-white border border-slate-200 shadow-xl rounded-xl py-2">
                                        {[
                                            { value: 'este_mes', label: 'Este Mês' },
                                            { value: 'mes_passado', label: 'Mês Passado' },
                                            { value: 'ultimos_7_dias', label: 'Últimos 7 Dias' },
                                            { value: 'este_ano', label: 'Este Ano' },
                                            { value: 'personalizado', label: 'Personalizado' },
                                        ].map((op) => (
                                            <button
                                                key={op.value}
                                                onClick={() => {
                                                    setPeriodoSelecionado(op.value);
                                                    setIsPeriodoDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${periodoSelecionado === op.value
                                                    ? 'bg-slate-50 text-slate-900 font-bold'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {op.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSyncAll}
                                disabled={isSyncingAll || loading || isGenerating}
                                className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all shadow-sm active:scale-95 overflow-hidden ${isSyncingAll
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                title="Forçar Sincronização de Todos os Posts"
                            >
                                {isSyncingAll && (
                                    <div 
                                      className="absolute left-0 top-0 h-full bg-emerald-100 opacity-50 z-0 transition-all duration-300"
                                      style={{ width: `${syncProgress}%` }}
                                    />
                                )}
                                <RefreshCw className={`h-4 w-4 z-10 ${isSyncingAll ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline z-10">{isSyncingAll ? `Sincronizando ${syncProgress}%` : "Sincronizar Tudo"}</span>
                            </button>

                            <button
                                onClick={handleExportPDF}
                                disabled={isGenerating || loading || isOfflineMode || isSyncingAll}
                                className="group flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50"
                            >
                                {isGenerating || loadingPdfData ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                <span className={!isGenerating ? "hidden sm:inline" : ""}>{isGenerating ? "Processando..." : "Exportar PDF"}</span>
                            </button>
                        </div>
                    </div>

                    {periodoSelecionado === 'personalizado' && (
                        <div className="mb-6 animate-in fade-in zoom-in-95 duration-200 flex justify-end">
                            <Datepicker 
                                primaryColor={"blue"} 
                                useRange={false} 
                                value={{ startDate: dataInicio ? new Date(dataInicio) : null, endDate: dataFim ? new Date(dataFim) : null }} 
                                onChange={(newValue: DatepickerValue) => {
                                    setDataInicio(formatDatepickerValue(newValue?.startDate));
                                    setDataFim(formatDatepickerValue(newValue?.endDate));
                                }} 
                                displayFormat={"DD/MM/YYYY"} 
                                separator={"até"}
                                inputClassName="bg-white text-slate-800 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none w-full md:w-[260px]" 
                                containerClassName="relative w-full md:w-[260px]" 
                            />
                        </div>
                    )}

                    {isOfflineMode ? (
                        <div className="flex flex-col items-center justify-center py-24 rounded-3xl border border-slate-200 bg-white/50">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            <p className="mt-4 text-sm font-medium text-slate-500">Relatórios não disponíveis em modo offline.</p>
                        </div>
                    ) : (authLoading || loading) ? (
                        <ReportsSkeleton />
                    ) : (
                        <div ref={reportRef} className="flex flex-col gap-10">
                            {/* 1. Métrica Estrela (Padrão F) */}
                            <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between group">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <Eye className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Atenção Capturada</h3>
                                        </div>
                                        <div>
                                            <p className="font-display text-5xl sm:text-6xl font-black text-slate-900 tracking-tight leading-none group-hover:scale-105 origin-left transition-transform">
                                                {realTotalViews > 0 ? (realTotalViews >= 1000000 ? (realTotalViews / 1000000).toFixed(1) + 'M' : realTotalViews.toLocaleString("pt-BR")) : "-"}
                                            </p>
                                            <p className="text-sm font-medium text-slate-500 mt-3 border-t border-slate-100 pt-3">
                                                Alcance total e visualizações institucionais consolidadas
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white/50 border border-slate-100 rounded-2xl p-6 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-3 opacity-70">
                                            <Heart className="h-3.5 w-3.5 text-slate-500" />
                                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Endosso</h3>
                                        </div>
                                        <p className="text-3xl font-extrabold text-slate-700 tracking-tight">
                                            {realTotalCurtidas > 0 ? (realTotalCurtidas >= 1000000 ? (realTotalCurtidas / 1000000).toFixed(1) + 'M' : realTotalCurtidas.toLocaleString("pt-BR")) : "-"}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Reações (Curtidas)</p>
                                    </div>

                                    <div className="bg-white/50 border border-slate-100 rounded-2xl p-6 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-3 opacity-70">
                                            <MessageCircle className="h-3.5 w-3.5 text-slate-500" />
                                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repercussão</h3>
                                        </div>
                                        <p className="text-3xl font-extrabold text-slate-700 tracking-tight">
                                            {realTotalComentarios > 0 ? (realTotalComentarios >= 1000000 ? (realTotalComentarios / 1000000).toFixed(1) + 'M' : realTotalComentarios.toLocaleString("pt-BR")) : "-"}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 mt-1">Feedback direto</p>
                                    </div>
                                </div>
                            </section>

                            <div className="grid grid-cols-1 gap-8">
                                {/* 2. Entregas Oficiais Limpas */}
                                <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
                                    <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
                                        <h2 className="font-display text-xl font-bold text-slate-900 border-l-4 border-slate-800 pl-3">
                                            Entregas Oficiais
                                        </h2>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-bold uppercase tracking-wider border border-slate-200">{publishedEvents.length} no período</span>
                                    </div>

                                    {publishedEvents.length === 0 ? (
                                        <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                                            <p className="text-sm font-medium text-slate-400">Nenhuma entrega no período.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            {publishedEvents.map((event) => {
                                                const config = getEventTypeConfig(event.event_type || "");
                                                const metrics = event.metrics_snapshot;
                                                return (
                                                    <div key={event.id} className="group flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300">
                                                        <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-100">
                                                            {metrics?.local_thumbnail_url ? (
                                                                <img src={metrics.local_thumbnail_url} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                                                            )}
                                                        </div>
                                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                                            <h3 className="mb-3 line-clamp-2 font-display text-base font-bold text-slate-800 leading-snug">{event.title}</h3>
                                                            <div className="mt-2 flex flex-col gap-3">
                                                                <div className="flex items-center gap-4 text-slate-500">
                                                                    <div className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /><span className="text-xs font-semibold">{formatNumber(metrics?.likes || 0)}</span></div>
                                                                    <div className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /><span className="text-xs font-semibold">{formatNumber(metrics?.comments || 0)}</span></div>
                                                                    <div className="flex items-center gap-1 text-slate-700"><Eye className="h-3.5 w-3.5" /><span className="text-xs font-semibold">{formatNumber(metrics?.views || metrics?.reach || 0)}</span></div>
                                                                </div>
                                                                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                                                    <span className="text-xs font-medium text-slate-400">{new Date(event.start || new Date()).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        {event.post_url && (
                                                                            <button 
                                                                                onClick={(e) => { e.preventDefault(); handleSyncPost(event.id, event.post_url || undefined); }}
                                                                                disabled={syncingTaskId === event.id}
                                                                                className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50 print:hidden"
                                                                                title="Forçar Sincronização Urgente"
                                                                            >
                                                                                <RefreshCw className={`h-3.5 w-3.5 ${syncingTaskId === event.id ? 'animate-spin text-emerald-500' : ''}`} />
                                                                            </button>
                                                                        )}
                                                                        <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${config.color}`}>{config.label.split(' ')[0]}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                                <TermometroTracao totalViews={realTotalViews} periodoSelecionado={periodoSelecionado} />
                                <DesempenhoTematico entregas={uniqueEventsForMetrics} />
                            </div>

                            <div className="mt-6 text-center">
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                    Documento Confidencial — Gerado {new Date().toLocaleDateString("pt-BR")} — Executivo
                                </p>
                            </div>
                        </div >
                    )}
                </main >
            </div >

            {/* Camada Invisível de Impressão (Só funciona durante window.print) */}
            {pdfRenderData && (
                <div className="hidden print:block absolute inset-0 bg-white z-[9999] print:m-0 print:p-0">
                    {/* Aqui injetamos o motor se ele estiver "alimentado" */}
                    <div className="w-[210mm] min-h-[297mm] mx-auto relative overflow-hidden bg-white">
                        <div className="relative z-10 h-full">
                            <RelatorioPDF data={pdfRenderData} timbrado={TIMBRADO_NATIVO} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
