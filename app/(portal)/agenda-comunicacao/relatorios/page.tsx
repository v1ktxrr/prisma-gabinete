"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, FileText, Calendar, Link2, ArrowLeft, Printer, ExternalLink,
    Eye, Heart, MessageCircle, RefreshCw
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import PageHeader from "@/components/page-header";
import { ToastContainer, ToastState } from "@/components/agenda-shared";

import RelatorioComunicacaoPDF from "@/components/RelatorioComunicacaoPDF";

// Carregamento dinâmico do motor PDF no cliente (evita Hydration Mismatch)
const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((mod) => ({ default: mod.PDFDownloadLink })),
    { ssr: false }
);

interface TaskMetrics {
    likes?: number;
    comments?: number;
    views?: number;
    reach?: number;
    saves?: number;
    shares?: number;
    local_thumbnail_url?: string | null;
}

interface TaskRow {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    data_publicacao: string | null;
    data_inicio: string | null;
    created_at: string;
    created_by: string;
    post_url: string | null;
    link_final: string | null;
    unidade_id: string | null;
    tipo_agenda: string;
    metrics_snapshot: TaskMetrics | null;
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
    profiles?: {
        nome: string;
    } | null;
}

function formatarData(iso: string) {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatNumber(num: number) {
    if (num === undefined || num === null) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return num.toString();
}

function formatEixoLabel(val?: string | null) {
    if (!val) return "Não informado";
    const mapping: Record<string, string> = {
        saude: "Saúde",
        educacao: "Educação",
        seguranca: "Segurança",
        infraestrutura: "Infraestrutura",
        assistencia_social: "Assistência Social",
        institucional: "Institucional",
    };
    return mapping[val.toLowerCase()] || val;
}

function formatFormatoLabel(val?: string | null) {
    if (!val) return "Não informado";
    const mapping: Record<string, string> = {
        video: "Vídeo",
        card: "Card",
        cobertura: "Cobertura",
        foto: "Foto",
        texto: "Texto",
    };
    return mapping[val.toLowerCase()] || val;
}

const getTaskDate = (r: TaskRow) => {
    const rawDate = r.data_publicacao || r.data_inicio || r.created_at;
    if (!rawDate) return "";
    return rawDate.split("T")[0];
};

const getTaskLinks = (r: TaskRow) => {
    const linkStr = r.post_url || r.link_final || "";
    return linkStr.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
};

// Detect the platform/media type of the link for premium badges
function getLinkBadge(url: string) {
    const cleanUrl = url.trim().toLowerCase();
    if (cleanUrl.includes("instagram.com")) {
        return { label: "Instagram", bg: "bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100" };
    }
    if (cleanUrl.includes("facebook.com") || cleanUrl.includes("fb.watch")) {
        return { label: "Facebook", bg: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" };
    }
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
        return { label: "YouTube", bg: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" };
    }
    if (cleanUrl.includes("tiktok.com")) {
        return { label: "TikTok", bg: "bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100" };
    }
    return { label: "Link", bg: "bg-violet-50 border-violet-200 text-violet-755 hover:bg-violet-100" };
}

export default function RelatoriosComunicacaoPage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const { loading: permissionsLoading } = usePermissions();

    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [activeTab, setActiveTab] = useState<"individual" | "team" | "dashboard">("individual");
    
    // Datas iniciais para o filtro personalizado (inicia com o mês corrente)
    const initialDates = useMemo(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const toDateString = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        return {
            firstDay: toDateString(firstDay),
            today: toDateString(now)
        };
    }, []);

    const [filterPeriod, setFilterPeriod] = useState<"este_mes" | "mes_passado" | "personalizado">("este_mes");
    const [startDate, setStartDate] = useState<string>(initialDates.firstDay);
    const [endDate, setEndDate] = useState<string>(initialDates.today);
    const [searchTerm, setSearchTerm] = useState("");
    const [toasts, setToasts] = useState<ToastState[]>([]);
    const processedTaskIdsRef = useRef<Set<string>>(new Set());

    // Estados para sincronização manual de métricas
    const [syncingTasks, setSyncingTasks] = useState<Record<string, boolean>>({});
    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

    const isLoading = roleLoading || permissionsLoading;

    // Cálculo lógico dos intervalos de data (UTC-safe local timezone)
    const { dataInicio, dataFim } = useMemo(() => {
        const now = new Date();
        let start: Date;
        let end: Date;

        if (filterPeriod === "este_mes") {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            end = now;
        } else if (filterPeriod === "mes_passado") {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        } else {
            // personalizado
            if (startDate) {
                const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
                start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
            } else {
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            if (endDate) {
                const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
                end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
            } else {
                end = now;
            }
        }

        return {
            dataInicio: start.toISOString(),
            dataFim: end.toISOString()
        };
    }, [filterPeriod, startDate, endDate]);

    const formatarDataExibicao = useCallback((isoStr: string) => {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }, []);

    const formatarIntervaloExibicao = useCallback(() => {
        return `${formatarDataExibicao(dataInicio)} a ${formatarDataExibicao(dataFim)}`;
    }, [dataInicio, dataFim, formatarDataExibicao]);

    // Toast helpers
    const addToast = useCallback((message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // Guards
    useEffect(() => {
        if (!isLoading && !user) {
            router.replace("/login");
        }
    }, [isLoading, user, router]);

    useEffect(() => {
        if (!isLoading && user) {
            if (cargo !== "comunicacao" && cargo !== "chefia") {
                router.replace("/dashboard");
            }
        }
    }, [isLoading, user, cargo, router]);

    // Fetch team members names map
    const [teamProfiles, setTeamProfiles] = useState<Record<string, string>>({});
    
    useEffect(() => {
        supabase
            .from("perfis_usuarios")
            .select("id, nome")
            .then(({ data, error }) => {
                if (!error && data) {
                    const map: Record<string, string> = {};
                    data.forEach((p) => {
                        map[p.id] = p.nome;
                    });
                    setTeamProfiles(map);
                }
            });
    }, []);

    // Fetch published communication tasks (shared between CG & DD)
    const buscarTasks = useCallback(async (startStr: string, endStr: string) => {
        if (!user) return;
        setCarregando(true);
        processedTaskIdsRef.current.clear();
        try {
            const { data, error } = await supabase
                .from("tasks")
                .select(`
                    id, titulo, descricao, status, data_publicacao, data_inicio, created_at, created_by, post_url, link_final, unidade_id, tipo_agenda, metrics_snapshot,
                    captacao_by, edicao_by, texto_by, publicacao_by, formato_midia, eixo_tematico,
                    profiles:created_by (nome)
                `)
                .eq("tipo_agenda", "COMUNICACAO")
                .eq("status", "publicado")
                .eq("registro_status", "ativo")
                .gte("data_inicio", startStr)
                .lte("data_inicio", endStr)
                .order("data_inicio", { ascending: false })
                .order("created_at", { ascending: false });

            if (error) throw error;
            setTasks((data as unknown as TaskRow[]) ?? []);
        } catch (err) {
            console.error(err);
            addToast("Não foi possível carregar as publicações da agenda.", "error");
        } finally {
            setCarregando(false);
        }
    }, [user, addToast]);

    const sincronizarUmaTask = useCallback(async (taskId: string, postUrl: string) => {
        setSyncingTasks(prev => ({ ...prev, [taskId]: true }));
        try {
            const { data, error } = await supabase.functions.invoke("sync-instagram", {
                body: { task_id: taskId, post_url: postUrl }
            });
            if (error) throw error;
            if (data?.success && data?.metrics) {
                setTasks(prev =>
                    prev.map(item =>
                        item.id === taskId ? { ...item, metrics_snapshot: data.metrics } : item
                    )
                );
                addToast("Métricas atualizadas com sucesso!", "success");
            } else {
                throw new Error(data?.error || "Erro desconhecido");
            }
        } catch (err: any) {
            console.error(`Erro ao sincronizar task ${taskId}:`, err);
            addToast(`Falha ao sincronizar: ${err.message || "Erro na Edge Function"}`, "error");
        } finally {
            setSyncingTasks(prev => {
                const copy = { ...prev };
                delete copy[taskId];
                return copy;
            });
        }
    }, [addToast]);


    useEffect(() => {
        if (user && (cargo === "comunicacao" || cargo === "chefia")) {
            buscarTasks(dataInicio, dataFim);
        }
    }, [user, cargo, buscarTasks, dataInicio, dataFim]);

    // Worker automático de sincronização de métricas em background
    useEffect(() => {
        if (tasks.length === 0) return;

        // Filtra pautas que possuem link do Instagram e que ainda não têm métricas ou não foram processadas nesta carga
        const toSync = tasks.filter((t) => {
            const url = t.post_url || t.link_final || "";
            const isInsta = url.includes("instagram.com");
            const alreadyProcessed = processedTaskIdsRef.current.has(t.id);
            const hasMetrics = t.metrics_snapshot && typeof t.metrics_snapshot.likes === 'number';
            
            return isInsta && !alreadyProcessed && !hasMetrics;
        });

        if (toSync.length === 0) return;

        // Marca como processado imediatamente para evitar múltiplas execuções concorrentes
        toSync.forEach(t => processedTaskIdsRef.current.add(t.id));

        const runSync = async () => {
            for (const t of toSync) {
                const url = t.post_url || t.link_final || "";
                try {
                    const { data, error } = await supabase.functions.invoke("sync-instagram", {
                        body: { task_id: t.id, post_url: url }
                    });
                    if (!error && data?.success && data?.metrics) {
                        setTasks((prev) =>
                            prev.map((item) =>
                                item.id === t.id ? { ...item, metrics_snapshot: data.metrics } : item
                            )
                        );
                    }
                } catch (err) {
                    console.error(`Falha na sincronização automática da pauta ${t.id}:`, err);
                }
            }
        };

        runSync();
    }, [tasks]);

    // Memoized data for Donut Chart (Desempenho Temático)
    const dataEixos = useMemo(() => {
        const counts: Record<string, number> = {};
        let total = 0;

        tasks.forEach(t => {
            const eixo = t.eixo_tematico || "outros";
            counts[eixo] = (counts[eixo] || 0) + 1;
            total++;
        });

        const eixoLabels: Record<string, { label: string; color: string }> = {
            saude: { label: "Saúde", color: "#ef4444" },          // Red
            educacao: { label: "Educação", color: "#3b82f6" },      // Blue
            seguranca: { label: "Segurança", color: "#f59e0b" },     // Amber
            infraestrutura: { label: "Infraestrutura", color: "#10b981" }, // Emerald
            assistencia_social: { label: "Assistência Social", color: "#8b5cf6" }, // Violet
            institucional: { label: "Institucional", color: "#ec4899" }, // Pink
            outros: { label: "Sem Eixo / Outros", color: "#64748b" }, // Slate
        };

        return Object.entries(counts).map(([eixo, count]) => {
            const config = eixoLabels[eixo] || eixoLabels.outros;
            return {
                key: eixo,
                label: config.label,
                count,
                color: config.color,
                percentage: total > 0 ? (count / total) * 100 : 0
            };
        }).sort((a, b) => b.count - a.count);
    }, [tasks]);

    // Donut SVG helper parameters
    const donutSegments = useMemo(() => {
        let accumulatedPercentage = 0;
        return dataEixos.map((item) => {
            const offset = 100 - accumulatedPercentage + 25; // 25 is to start at 12 o'clock
            accumulatedPercentage += item.percentage;
            return {
                ...item,
                strokeDasharray: `${item.percentage} ${100 - item.percentage}`,
                strokeDashoffset: offset % 100
            };
        });
    }, [dataEixos]);

    // Memoized data for Stacked Bar Chart (Matriz de Produtividade)
    const dataProdutividade = useMemo(() => {
        const counts: Record<string, {
            nome: string;
            captacao: number;
            edicao: number;
            texto: number;
            publicacao: number;
            total: number;
        }> = {};

        tasks.forEach(t => {
            const roles = [
                { id: t.captacao_by, key: "captacao" },
                { id: t.edicao_by, key: "edicao" },
                { id: t.texto_by, key: "texto" },
                { id: t.publicacao_by, key: "publicacao" }
            ] as const;

            roles.forEach(({ id, key }) => {
                if (id) {
                    const nome = teamProfiles[id] || "Membro";
                    if (!counts[id]) {
                        counts[id] = { nome, captacao: 0, edicao: 0, texto: 0, publicacao: 0, total: 0 };
                    }
                    counts[id][key]++;
                    counts[id].total++;
                }
            });
        });

        return Object.values(counts).sort((a, b) => b.total - a.total);
    }, [tasks, teamProfiles]);

    const maxTotal = useMemo(() => {
        const max = Math.max(...dataProdutividade.map(item => item.total), 0);
        return max > 0 ? max : 5;
    }, [dataProdutividade]);

    // Filter and search logic
    const tasksProcessadas = useMemo(() => {
        return tasks
            .filter((t) => {
                const query = searchTerm.toLowerCase().trim();
                const matchesSearch = !query || 
                    t.titulo.toLowerCase().includes(query) ||
                    (t.descricao || "").toLowerCase().includes(query) ||
                    (t.profiles?.nome || "").toLowerCase().includes(query);

                const matchesTab = 
                    activeTab === "team" || 
                    activeTab === "dashboard" || 
                    (user?.id && (
                        t.captacao_by === user.id ||
                        t.edicao_by === user.id ||
                        t.texto_by === user.id ||
                        t.publicacao_by === user.id
                    ));

                return matchesSearch && matchesTab;
            });
    }, [tasks, searchTerm, activeTab, user?.id]);

    // KPIs consolidados para exportação PDF
    const totalKpis = useMemo(() => {
        let views = 0;
        let likes = 0;
        let comments = 0;
        
        const linksVistos = new Set<string>();
        
        tasksProcessadas.forEach((t) => {
            const url = t.post_url || t.link_final || "";
            const key = url.trim().toLowerCase();
            const metrics = t.metrics_snapshot;
            
            if (metrics) {
                const v = metrics.views || 0;
                const l = metrics.likes || 0;
                const c = metrics.comments || 0;
                
                if (!key || !linksVistos.has(key)) {
                    if (key) linksVistos.add(key);
                    views += v;
                    likes += l;
                    comments += c;
                }
            }
        });
        
        return { views, likes, comments };
    }, [tasksProcessadas]);

    const sincronizarTodasVisiveis = useCallback(async () => {
        const postsInstagram = tasksProcessadas.filter(t => {
            const url = t.post_url || t.link_final || "";
            return url.includes("instagram.com");
        });

        if (postsInstagram.length === 0) {
            addToast("Nenhuma publicação do Instagram visível para atualizar.", "error");
            return;
        }

        setIsSyncingAll(true);
        setSyncProgress({ current: 0, total: postsInstagram.length });

        let index = 1;
        for (const t of postsInstagram) {
            setSyncProgress({ current: index, total: postsInstagram.length });
            setSyncingTasks(prev => ({ ...prev, [t.id]: true }));
            const url = t.post_url || t.link_final || "";
            try {
                const { data, error } = await supabase.functions.invoke("sync-instagram", {
                    body: { task_id: t.id, post_url: url }
                });
                if (!error && data?.success && data?.metrics) {
                    setTasks(prev =>
                        prev.map(item =>
                            item.id === t.id ? { ...item, metrics_snapshot: data.metrics } : item
                        )
                    );
                }
            } catch (err) {
                console.error(`Falha na sincronização em lote da pauta ${t.id}:`, err);
            } finally {
                setSyncingTasks(prev => {
                    const copy = { ...prev };
                    delete copy[t.id];
                    return copy;
                });
            }
            index++;
        }

        setIsSyncingAll(false);
        addToast("Sincronização em lote finalizada!", "success");
    }, [tasksProcessadas, addToast]);

    const handleExportPDF = () => {
        window.print();
    };

    const formatarLabelFiltro = () => {
        if (filterPeriod === "este_mes") return "Este mês";
        if (filterPeriod === "mes_passado") return "Mês passado";
        if (filterPeriod === "personalizado") return "Personalizado";
        return "";
    };

    if (isLoading || !user || (cargo !== "comunicacao" && cargo !== "chefia")) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,243,255,0.45),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] print:bg-white print:text-black">
            
            {/* 1. PRINT STYLE */}
            <style type="text/css" media="print">
                {`
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                body {
                    background: white !important;
                    color: black !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }
                tr { page-break-inside: avoid; }
                `}
            </style>

            {/* ========== WEB INTERFACE (print:hidden) ========== */}
            <div className="print:hidden">
                <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
                    
                    {/* Back link */}
                    <div className="mb-4">
                        <Link
                            href="/agenda-comunicacao"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-850 transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Voltar para Atividades
                        </Link>
                    </div>

                    {/* Page Header */}
                    <PageHeader
                        preTitle="Relatórios da Equipe"
                        title="Relatórios de Comunicação"
                        description="Painel de Prestação de Contas Automatizado. Acompanhe as publicações concluídas na Agenda de Comunicação de ambas as unidades (CG e DD)."
                        badges={
                            <span className="inline-flex items-center rounded-full bg-violet-50 border border-violet-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-750">
                                Módulo de Mídia
                            </span>
                        }
                    >
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={isSyncingAll || tasksProcessadas.length === 0}
                                onClick={sincronizarTodasVisiveis}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 px-4 py-2.5 text-xs font-bold transition-all active:scale-[0.98] shadow-2xs cursor-pointer h-10 disabled:opacity-55 disabled:scale-100 disabled:pointer-events-none"
                            >
                                <RefreshCw className={`h-4 w-4 text-violet-605 ${isSyncingAll ? "animate-spin" : ""}`} />
                                <span>
                                    {isSyncingAll
                                        ? `Atualizando ${syncProgress.current} de ${syncProgress.total}...`
                                        : "Atualizar Métricas Visíveis"}
                                </span>
                            </button>
                            {tasksProcessadas.length > 0 ? (
                                <PDFDownloadLink
                                    document={
                                        <RelatorioComunicacaoPDF
                                            tasks={tasksProcessadas}
                                            periodo={formatarIntervaloExibicao()}
                                            colaborador={profile?.nome || "Membro do Gabinete"}
                                            unidade={profile?.unidade_id ? `Unidade ${profile.unidade_id}` : "Geral"}
                                            totalKpis={totalKpis}
                                            teamProfiles={teamProfiles}
                                        />
                                    }
                                    fileName={`Relatorio_Comunicacao_${new Date().toISOString().split('T')[0]}.pdf`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    {({ blob, url, loading: pdfLoading, error }) => (
                                        <button
                                            type="button"
                                            disabled={pdfLoading}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-250 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98] shadow-2xs cursor-pointer h-10 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {pdfLoading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                                    <span>Preparando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Printer className="h-4 w-4 text-slate-500" />
                                                    <span>Exportar PDF</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </PDFDownloadLink>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-250 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 opacity-50 cursor-not-allowed h-10"
                                >
                                    <Printer className="h-4 w-4 text-slate-500" />
                                    <span>Exportar PDF</span>
                                </button>
                            )}
                        </div>
                    </PageHeader>

                    {/* TABS DE VISÃO DE DADOS */}
                    <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab("individual")}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                    activeTab === "individual"
                                        ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                Minhas Postagens
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("team")}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                    activeTab === "team"
                                        ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                Postagens da Equipe
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("dashboard")}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer ${
                                    activeTab === "dashboard"
                                        ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                Dashboard Estratégico
                            </button>
                        </div>

                        {/* FILTROS RÁPIDOS POR PERÍODO & BUSCA */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Busca Textual */}
                            {activeTab !== "dashboard" && (
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar pauta..."
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 w-full sm:w-48 h-8.5"
                                />
                            )}

                            {/* Filtros de período */}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={filterPeriod}
                                    onChange={(e) => setFilterPeriod(e.target.value as any)}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 cursor-pointer h-8.5 shadow-2xs"
                                >
                                    <option value="este_mes">Este Mês</option>
                                    <option value="mes_passado">Mês Passado</option>
                                    <option value="personalizado">Período Personalizado</option>
                                </select>

                                {filterPeriod === "personalizado" && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">De</span>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 h-8.5 shadow-2xs"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Até</span>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 h-8.5 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="mt-6">
                        {carregando ? (
                            <div className="flex justify-center items-center py-24 rounded-3xl border border-slate-200 bg-white shadow-xs">
                                <Loader2 className="h-8 w-8 animate-spin text-violet-650" />
                            </div>
                        ) : activeTab === "dashboard" ? (
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Chart 1: Donut (Desempenho Temático) */}
                                <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
                                    <div className="relative h-44 w-44 shrink-0 mx-auto">
                                        <svg viewBox="0 0 42 42" className="h-full w-full transform -rotate-90">
                                            {dataEixos.length === 0 ? (
                                                <circle
                                                    cx="21"
                                                    cy="21"
                                                    r="15.91549430918954"
                                                    fill="transparent"
                                                    stroke="#e2e8f0"
                                                    strokeWidth="4"
                                                />
                                            ) : (
                                                donutSegments.map((seg) => (
                                                    <circle
                                                        key={seg.key}
                                                        cx="21"
                                                        cy="21"
                                                        r="15.91549430918954"
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth="4.5"
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        className="transition-all duration-300 hover:stroke-[5.5] cursor-pointer"
                                                    >
                                                        <title>{seg.label}: {seg.count} ({seg.percentage.toFixed(1)}%)</title>
                                                    </circle>
                                                ))
                                            )}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-2xl font-black text-slate-800">
                                                {tasks.length}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Publicações</span>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 w-full space-y-2">
                                        <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-3">Desempenho Temático</h4>
                                        {dataEixos.length === 0 ? (
                                            <p className="text-xs text-slate-405">Nenhuma postagem no período.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {dataEixos.map((item) => (
                                                    <div key={item.key} className="flex items-center gap-2 text-xs">
                                                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="font-semibold text-slate-700 truncate max-w-[130px]">{item.label}</span>
                                                        <span className="ml-auto font-bold text-slate-900">{item.count}</span>
                                                        <span className="text-slate-400 text-[10px]">({item.percentage.toFixed(0)}%)</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Chart 2: Stacked Bar (Matriz de Produtividade) */}
                                <div className="flex flex-col p-6 bg-white border border-slate-200 rounded-2xl shadow-xs h-96">
                                    <h4 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-4">Matriz de Produtividade</h4>
                                    {dataProdutividade.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                                            Nenhuma entrega registrada no período.
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col justify-between min-h-0">
                                            {/* Chart Area */}
                                            <div className="flex-1 flex items-end gap-6 md:gap-10 px-4 border-b border-slate-200 pb-2 overflow-x-auto min-h-0">
                                                {dataProdutividade.map((item, idx) => {
                                                    const pctCaptacao = (item.captacao / maxTotal) * 85;
                                                    const pctEdicao = (item.edicao / maxTotal) * 85;
                                                    const pctTexto = (item.texto / maxTotal) * 85;
                                                    const pctPublicacao = (item.publicacao / maxTotal) * 85;

                                                    return (
                                                        <div key={idx} className="flex flex-col items-center flex-1 min-w-[50px] group relative h-full justify-end">
                                                            {/* Stacked Bar container */}
                                                            <div className="w-8 md:w-10 rounded-t-md overflow-hidden flex flex-col justify-end h-full max-h-[85%] transition-all duration-300 group-hover:scale-x-105">
                                                                {/* Publicação (Pink/Rose) */}
                                                                {item.publicacao > 0 && (
                                                                    <div
                                                                        style={{ height: `${pctPublicacao}%` }}
                                                                        className="bg-pink-500 hover:opacity-90 transition-opacity"
                                                                        title={`Publicação: ${item.publicacao}`}
                                                                    />
                                                                )}
                                                                {item.texto > 0 && (
                                                                    <div
                                                                        style={{ height: `${pctTexto}%` }}
                                                                        className="bg-amber-500 hover:opacity-90 transition-opacity"
                                                                        title={`Texto: ${item.texto}`}
                                                                    />
                                                                )}
                                                                {item.edicao > 0 && (
                                                                    <div
                                                                        style={{ height: `${pctEdicao}%` }}
                                                                        className="bg-indigo-500 hover:opacity-90 transition-opacity"
                                                                        title={`Edição: ${item.edicao}`}
                                                                    />
                                                                )}
                                                                {item.captacao > 0 && (
                                                                    <div
                                                                        style={{ height: `${pctCaptacao}%` }}
                                                                        className="bg-teal-500 hover:opacity-90 transition-opacity"
                                                                        title={`Captação: ${item.captacao}`}
                                                                    />
                                                                )}
                                                            </div>

                                                            {/* Floating Tooltip on Hover */}
                                                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-md z-30 w-32 pointer-events-none">
                                                                <span className="font-bold border-b border-white/10 pb-1 mb-1">{item.nome}</span>
                                                                <span className="flex justify-between">📷 Captação: <strong>{item.captacao}</strong></span>
                                                                <span className="flex justify-between">🎨 Edição: <strong>{item.edicao}</strong></span>
                                                                <span className="flex justify-between">✍️ Texto: <strong>{item.texto}</strong></span>
                                                                <span className="flex justify-between">🌐 Publicação: <strong>{item.publicacao}</strong></span>
                                                                <span className="flex justify-between border-t border-white/10 pt-1 mt-1 font-bold">Total: <strong>{item.total}</strong></span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Labels under the chart */}
                                            <div className="flex items-start gap-6 md:gap-10 px-4 pt-2 overflow-x-auto min-h-[40px]">
                                                {dataProdutividade.map((item, idx) => (
                                                    <div key={idx} className="flex flex-col items-center flex-1 min-w-[50px] text-center">
                                                        <span className="text-[10px] font-bold text-slate-650 truncate max-w-[64px]" title={item.nome}>
                                                            {item.nome.split(" ")[0]}
                                                        </span>
                                                        <span className="text-[9px] font-extrabold text-slate-400 mt-0.5">{item.total}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Legend */}
                                    <div className="flex flex-wrap gap-4 justify-center items-center mt-3 pt-3 border-t border-slate-100 text-[11px]">
                                        <div className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-xs bg-teal-500" />
                                            <span className="font-medium text-slate-650">Captação</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-xs bg-indigo-500" />
                                            <span className="font-medium text-slate-650">Edição</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                                            <span className="font-medium text-slate-655">Texto</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="h-2.5 w-2.5 rounded-xs bg-pink-500" />
                                            <span className="font-medium text-slate-650">Publicação</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : tasksProcessadas.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 border border-violet-100 text-violet-500 shadow-2xs">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <h3 className="mt-4 text-sm font-extrabold text-slate-900">
                                    Nenhuma publicação encontrada
                                </h3>
                                <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                    {searchTerm || filterPeriod !== "este_mes"
                                        ? "Tente alterar os filtros ou a busca para exibir outros resultados."
                                        : "Não há publicações concluídas registradas na agenda de comunicação para esta visão."}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {tasksProcessadas.map((r) => {
                                    const taskDate = getTaskDate(r);
                                    const postUrl = r.post_url || r.link_final || "#";
                                    const thumbnail = r.metrics_snapshot?.local_thumbnail_url;
                                    const metrics = r.metrics_snapshot;
                                    
                                    const userContribs = [];
                                    if (user?.id) {
                                        if (r.captacao_by === user.id) {
                                            userContribs.push({ label: "📸 Captação", bg: "bg-teal-600 text-white border border-teal-500 shadow-xs" });
                                        }
                                        if (r.edicao_by === user.id) {
                                            userContribs.push({ label: "✂️ Edição", bg: "bg-indigo-600 text-white border border-indigo-500 shadow-xs" });
                                        }
                                        if (r.texto_by === user.id) {
                                            userContribs.push({ label: "✍️ Texto", bg: "bg-amber-600 text-white border border-amber-500 shadow-xs" });
                                        }
                                        if (r.publicacao_by === user.id) {
                                            userContribs.push({ label: "🚀 Publicação", bg: "bg-pink-600 text-white border border-pink-500 shadow-xs" });
                                        }
                                    }

                                    return (
                                        <a
                                            key={r.id}
                                            href={postUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white h-full shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-slate-200 cursor-pointer"
                                        >
                                            {/* Superior Half (4:5 Ratio) - Image / Capa */}
                                            <div className="relative w-full aspect-[4/5] overflow-hidden bg-slate-105 border-b border-slate-100 shrink-0">
                                                {thumbnail ? (
                                                    <img
                                                        src={thumbnail}
                                                        alt={r.titulo}
                                                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                                                        style={{ contentVisibility: 'auto' }}
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-violet-600 via-indigo-950 to-slate-900 transition-opacity duration-300 group-hover:opacity-95" />
                                                )}

                                                {/* Vignette Overlay subtle inside the image */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                                                {/* Minhas Contribuições (Somente se houver alguma) - absolute positioned over image */}
                                                {userContribs.length > 0 && (
                                                    <div className="absolute top-2.5 left-2.5 z-10 flex flex-wrap gap-1 max-w-[calc(100%-20px)]">
                                                        {userContribs.map((c, index) => (
                                                            <span
                                                                key={index}
                                                                className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-xs ${c.bg}`}
                                                            >
                                                                {c.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Inferior Half - Content Sólido */}
                                            <div className="flex flex-col flex-grow p-4 bg-white justify-between">
                                                
                                                {/* Metadata: Date and Creator */}
                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    <span>{formatarData(taskDate)}</span>
                                                    {activeTab === "team" && (
                                                        <span className="text-violet-600 truncate max-w-[120px]" title={r.profiles?.nome || "Equipe"}>
                                                            👤 {r.profiles?.nome ? r.profiles.nome.split(" ")[0] : "Equipe"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Title and Description */}
                                                <div className="flex-1 flex flex-col justify-center my-2.5">
                                                    <h3 className="font-extrabold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-violet-600 transition-colors">
                                                        {r.titulo}
                                                    </h3>
                                                    {r.descricao && (
                                                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-1">
                                                            {r.descricao}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Formato e Eixo Badges */}
                                                {(r.formato_midia || r.eixo_tematico) && (
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {r.formato_midia && (
                                                            <span className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                                                                🎬 {formatFormatoLabel(r.formato_midia)}
                                                            </span>
                                                        )}
                                                        {r.eixo_tematico && (
                                                            <span className="inline-flex items-center rounded-md bg-violet-50 border border-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600">
                                                                🎯 {formatEixoLabel(r.eixo_tematico)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Bottom section (footer): Metrics horizontal bar */}
                                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-slate-500">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1" title="Visualizações">
                                                            <Eye className="h-3.5 w-3.5 opacity-80" />
                                                            <span className="text-xs font-bold text-slate-700">{formatNumber(metrics?.views || 0)}</span>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1" title="Curtidas">
                                                            <Heart className="h-3.5 w-3.5 text-rose-500 opacity-90" />
                                                            <span className="text-xs font-bold text-slate-700">{formatNumber(metrics?.likes || 0)}</span>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-1" title="Comentários">
                                                            <MessageCircle className="h-3.5 w-3.5 opacity-80" />
                                                            <span className="text-xs font-bold text-slate-700">{formatNumber(metrics?.comments || 0)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Botão de Sincronização Individual */}
                                                    {(r.post_url || r.link_final) && (
                                                        <button
                                                            type="button"
                                                            disabled={syncingTasks[r.id]}
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                await sincronizarUmaTask(r.id, r.post_url || r.link_final || "");
                                                            }}
                                                            className="p-1 rounded bg-slate-50 border border-slate-200/60 hover:bg-slate-100 active:scale-95 transition-all text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none cursor-pointer"
                                                            title="Atualizar métricas desta publicação"
                                                        >
                                                            <RefreshCw className={`h-3 w-3 ${syncingTasks[r.id] ? "animate-spin" : ""}`} />
                                                        </button>
                                                    )}
                                                </div>

                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* ========== PRINT TIMBRADO LAYOUT (WINDOW.PRINT() ONLY) ========== */}
            <div className="hidden print:block font-sans text-slate-900 bg-white min-h-screen relative p-0">
                {/* Background Timbrado */}
                <div className="fixed top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
                    <img
                        src="/timbrado-relatorio.png"
                        alt="Timbrado Oficial"
                        className="w-full h-auto object-cover block"
                        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                    />
                </div>

                {/* Printable Table Wrapper */}
                <table className="w-full border-collapse bg-transparent">
                    <thead>
                        <tr>
                            <td className="p-0 border-none align-top">
                                <div style={{ height: "42mm" }} />
                            </td>
                        </tr>
                    </thead>

                    <tfoot>
                        <tr>
                            <td className="p-0 border-none align-bottom">
                                <div className="h-[20mm] flex items-center justify-between text-[8px] text-slate-400 uppercase tracking-widest px-[15mm] border-t border-slate-100">
                                    <span>PRISMA GABINETE VIRTUAL - ATIVIDADES DE MÍDIA</span>
                                    <span>PÁGINA 1</span>
                                </div>
                            </td>
                        </tr>
                    </tfoot>

                    <tbody>
                        <tr>
                            <td className="p-0 border-none px-[15mm]">
                                <div className="py-4">
                                    
                                    {/* Document Header */}
                                    <header className="mb-6 border-b-2 border-slate-200 pb-4">
                                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                            Relatório Operacional de Comunicação
                                        </h1>
                                        <div className="mt-3 grid grid-cols-3 gap-4 text-xs font-semibold text-slate-655">
                                            <div>
                                                <p><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Unidade do Gabinete</span> Unidade {profile?.unidade_id || "CG"}</p>
                                                <p className="mt-1.5"><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Visão de Dados</span> {activeTab === "individual" ? "Minhas Postagens" : "Postagens da Equipe"}</p>
                                            </div>
                                            <div>
                                                <p><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Período do Relatório</span> {formatarIntervaloExibicao()}</p>
                                                <p className="mt-1.5"><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Tipo de Período</span> {formatarLabelFiltro()}</p>
                                            </div>
                                            <div>
                                                <p><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Gerado em</span> {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
                                                <p className="mt-1.5"><span className="text-slate-400 uppercase text-[9px] tracking-wide block font-bold">Responsável por Gerar</span> {profile?.nome || "Membro do Gabinete"}</p>
                                            </div>
                                        </div>
                                    </header>

                                    {/* Metrics Executive Box */}
                                    <section className="mb-6 grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                            <span className="text-slate-400 uppercase text-[9px] tracking-widest font-bold block">Total de Lançamentos</span>
                                            <span className="text-2xl font-black text-slate-800">{tasksProcessadas.length}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                            <span className="text-slate-400 uppercase text-[9px] tracking-widest font-bold block">Intervalo de Datas</span>
                                            <span className="text-sm font-black text-slate-800">{formatarIntervaloExibicao()}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                            <span className="text-slate-400 uppercase text-[9px] tracking-widest font-bold block">Filtro de Período</span>
                                            <span className="text-sm font-black text-slate-800">{formatarLabelFiltro()}</span>
                                        </div>
                                    </section>

                                    {/* Print List Table */}
                                    <section>
                                        <table className="w-full border-collapse text-left text-[11px] text-slate-800 border border-slate-350">
                                            <thead>
                                                <tr className="bg-slate-100 border-b border-slate-350 text-[10px] font-bold text-slate-700">
                                                    <th className="px-3 py-2 border-r border-slate-350 w-24">Data</th>
                                                    <th className="px-3 py-2 border-r border-slate-350">Título / Pauta</th>
                                                    <th className="px-3 py-2 border-r border-slate-350 w-28">Eixo / Formato</th>
                                                    <th className="px-3 py-2 border-r border-slate-350 w-44">Link</th>
                                                    <th className="px-3 py-2 border-r border-slate-350 w-16 text-center">Views</th>
                                                    <th className="px-3 py-2 border-r border-slate-350 w-16 text-center">Likes</th>
                                                    <th className="px-3 py-2 w-16 text-center">Comentários</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-300">
                                                {tasksProcessadas.map((r) => {
                                                    const taskDate = getTaskDate(r);
                                                    const links = getTaskLinks(r);
                                                    const primaryLink = links[0] || "";
                                                    const metrics = r.metrics_snapshot;
                                                    
                                                    return (
                                                        <tr key={r.id} className="border-b border-slate-200">
                                                            <td className="px-3 py-2 border-r border-slate-300 font-semibold whitespace-nowrap">
                                                                {formatarData(taskDate)}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-slate-300">
                                                                <div className="font-bold text-slate-900 leading-tight">{r.titulo}</div>
                                                                {r.descricao && (
                                                                    <div className="text-[9px] text-slate-500 mt-1 leading-normal whitespace-pre-line">
                                                                        {r.descricao}
                                                                    </div>
                                                                )}
                                                                {(activeTab === "team" || activeTab === "dashboard") && (
                                                                    <div className="text-[9px] text-violet-755 font-bold mt-1">
                                                                        Autor: {r.profiles?.nome || "Membro da Equipe"}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-slate-300 text-[9px] font-semibold uppercase tracking-wider">
                                                                <div className="text-slate-900">{r.eixo_tematico ? formatEixoLabel(r.eixo_tematico) : "Sem Eixo"}</div>
                                                                <div className="text-slate-500 font-normal mt-0.5">{r.formato_midia ? formatFormatoLabel(r.formato_midia) : "Sem Formato"}</div>
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-slate-300 font-medium text-slate-700 truncate max-w-[180px] break-all">
                                                                {primaryLink ? (
                                                                    <span className="underline">{primaryLink}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Sem referências</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-slate-300 text-center font-bold">
                                                                {formatNumber(metrics?.views || 0)}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-slate-300 text-center font-bold">
                                                                {formatNumber(metrics?.likes || 0)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold">
                                                                {formatNumber(metrics?.comments || 0)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </section>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </div>
    );
}
