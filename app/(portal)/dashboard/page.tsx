"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    CalendarCheck2,
    FileText,
    LayoutGrid,
    Loader2,
    Users,
    Wallet,
    ChevronRight,
    ClipboardPlus,
    Megaphone,
    ShieldCheck,
    Settings,
    User,
    Sparkles,
    MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import PoliticoHeatmap from "@/components/dashboard/politico-heatmap";

type DashboardStats = {
    meusRegistrosMes: number;
    eventosParticipados: number;
    totalDespesas: number;
    equipeAtiva: number;
    atendimentosUnidade: number;
    agendaHoje: number;
};

type Tone = "slate" | "emerald" | "amber" | "sky" | "indigo";

const ESTADO_INICIAL: DashboardStats = {
    meusRegistrosMes: 0,
    eventosParticipados: 0,
    totalDespesas: 0,
    equipeAtiva: 0,
    atendimentosUnidade: 0,
    agendaHoje: 0,
};

const toneStyles: Record<Tone, { iconBg: string; iconText: string; ring: string }> = {
    slate: {
        iconBg: "bg-slate-100/80",
        iconText: "text-slate-650",
        ring: "ring-slate-100",
    },
    emerald: {
        iconBg: "bg-emerald-55/80",
        iconText: "text-emerald-600",
        ring: "ring-emerald-100/60",
    },
    amber: {
        iconBg: "bg-amber-55/80",
        iconText: "text-amber-605",
        ring: "ring-amber-100/60",
    },
    sky: {
        iconBg: "bg-sky-55/80",
        iconText: "text-sky-600",
        ring: "ring-sky-100/60",
    },
    indigo: {
        iconBg: "bg-indigo-55/80",
        iconText: "text-indigo-600",
        ring: "ring-indigo-100/60",
    },
};

function toDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function MetricCard({
    label,
    value,
    icon: Icon,
    tone = "slate",
    loading = false,
}: {
    label: string;
    value: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
    tone?: Tone;
    loading?: boolean;
}) {
    const styles = toneStyles[tone];

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.01)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-350 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.01)]">
            {/* Subtle background decorative line on hover */}
            <div className="absolute inset-x-0 bottom-0 h-[2px] scale-x-0 bg-slate-900 transition-transform duration-300 group-hover:scale-x-100" />

            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        {label}
                    </p>
                    {loading ? (
                        <div className="mt-4 h-9 w-28 animate-pulse rounded-lg bg-slate-100 skeleton-shimmer" />
                    ) : (
                        <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 truncate">
                            {value}
                        </p>
                    )}
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ring-4 ring-offset-0 ${styles.ring} ${styles.iconBg} ${styles.iconText} group-hover:scale-105`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function EmptyAgenda() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
            {/* A subtle geometric background design */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] ring-1 ring-slate-150">
                <CalendarCheck2 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-sm font-extrabold text-slate-900">
                Nenhum compromisso oficial hoje
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                O painel está limpo. Use a Pré-Agenda caso precise planejar ou conferir o restante da semana.
            </p>
            <div className="mt-6 flex justify-center">
                <Link
                    href="/pre-agenda"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-350 hover:shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                    Acessar Agenda Completa
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { loading, hasModule, unidadeId } = usePermissions();
    const [stats, setStats] = useState<DashboardStats>(ESTADO_INICIAL);
    const [loadingStats, setLoadingStats] = useState(true);

    const [municipios, setMunicipios] = useState<any[]>([]);
    const [mapMetrics, setMapMetrics] = useState<Record<string, { count_agenda: number; count_comunicacao: number; ultima_visita: string | null }>>({});
    const [metricKey, setMetricKey] = useState<"count_agenda" | "count_comunicacao">("count_agenda");
    const [activeFilter, setActiveFilter] = useState<"none" | "sem_visita" | "baixa_comunicacao">("none");
    const [selectedMuni, setSelectedMuni] = useState<{ id: string; nome: string } | null>(null);

    const isChefia =
        profile?.cargo === "chefia" ||
        hasModule("usuarios_gerenciar") ||
        hasModule("agenda_global_editar");
    const canViewAgenda = hasModule("agenda_global_ver");

    useEffect(() => {
        if (!loading && !authLoading && !user) {
            router.replace("/login");
        }
    }, [authLoading, loading, router, user]);

    useEffect(() => {
        if (!user) return;

        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
        const inicioMesDia = toDateKey(inicioMes);
        const inicioHoje = new Date(now);
        inicioHoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date(inicioHoje);
        fimHoje.setDate(inicioHoje.getDate() + 1);

        const carregar = async () => {
            setLoadingStats(true);

            try {
                const [
                    meusRegistros,
                    participacoes,
                    relatoriosUnidade,
                    perfisUnidade,
                    agendaHoje,
                    municipiosList,
                    tasksForHeatmap,
                ] = await Promise.all([
                    supabase
                        .from("relatorios_agenda")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", user.id)
                        .gte("criado_em", inicioMes.toISOString()),
                    supabase
                        .from("task_assignments")
                        .select("task_id", { count: "exact", head: true })
                        .eq("user_id", user.id)
                        .eq("activity_type", "captacao"),
                    supabase
                        .from("relatorios_agenda")
                        .select("id, valor_gasto, categoria, perfis_usuarios!inner(unidade_id)")
                        .eq("perfis_usuarios.unidade_id", unidadeId ?? "CG")
                        .gte("data_evento", inicioMesDia),
                    supabase
                        .from("perfis_usuarios")
                        .select("id", { count: "exact", head: true })
                        .eq("unidade_id", unidadeId ?? "CG"),
                    supabase
                        .from("tasks")
                        .select("id", { count: "exact", head: true })
                        .eq("tipo_agenda", "GLOBAL")
                        .gte("data_inicio", inicioHoje.toISOString())
                        .lt("data_inicio", fimHoje.toISOString()),
                    supabase
                        .from("municipios")
                        .select("id, nome, codigo_ibge"),
                    supabase
                        .from("tasks")
                        .select("tipo_agenda, status, data_inicio, municipio_id, municipio_ids, unidade_id")
                        .eq("registro_status", "ativo")
                        .or(`tipo_agenda.eq.COMUNICACAO,and(tipo_agenda.eq.GLOBAL,unidade_id.eq.${unidadeId ?? "CG"})`),
                ]);

                const registrosUnidade = relatoriosUnidade.data ?? [];
                const totalDespesas = registrosUnidade.reduce(
                    (acc, item) => acc + Number(item.valor_gasto ?? 0),
                    0
                );
                const atendimentosUnidade = registrosUnidade.filter(
                    (item) => item.categoria === "atendimento"
                ).length;

                setStats({
                    meusRegistrosMes: meusRegistros.count ?? 0,
                    eventosParticipados: participacoes.count ?? 0,
                    totalDespesas,
                    equipeAtiva: perfisUnidade.count ?? 0,
                    atendimentosUnidade,
                    agendaHoje: agendaHoje.count ?? 0,
                });

                // Process heatmap data
                const munis = municipiosList.data || [];
                const tks = tasksForHeatmap.data || [];

                const initialMetrics: Record<string, { count_agenda: number; count_comunicacao: number; ultima_visita: string | null }> = {};
                munis.forEach((m: any) => {
                    initialMetrics[m.codigo_ibge] = {
                        count_agenda: 0,
                        count_comunicacao: 0,
                        ultima_visita: null
                    };
                });

                tks.forEach((t: any) => {
                    let cityIds: string[] = [];
                    if (t.tipo_agenda === 'COMUNICACAO' && Array.isArray(t.municipio_ids) && t.municipio_ids.length > 0) {
                        cityIds = t.municipio_ids;
                    } else if (t.municipio_id) {
                        cityIds = [t.municipio_id];
                    }

                    cityIds.forEach((cId) => {
                        const m = munis.find((x: any) => x.id === cId);
                        if (m && initialMetrics[m.codigo_ibge]) {
                            if (t.tipo_agenda === 'GLOBAL') {
                                initialMetrics[m.codigo_ibge].count_agenda++;
                                if (t.data_inicio) {
                                    const date = new Date(t.data_inicio);
                                    const currentLast = initialMetrics[m.codigo_ibge].ultima_visita;
                                    if (!currentLast || date > new Date(currentLast)) {
                                        initialMetrics[m.codigo_ibge].ultima_visita = t.data_inicio;
                                    }
                                }
                            } else if (t.tipo_agenda === 'COMUNICACAO' && t.status === 'publicado') {
                                initialMetrics[m.codigo_ibge].count_comunicacao++;
                            }
                        }
                    });
                });

                setMunicipios(munis);
                setMapMetrics(initialMetrics);
            } catch (error) {
                console.error("[Dashboard] Falha ao carregar indicadores:", error);
                setStats(ESTADO_INICIAL);
            } finally {
                setLoadingStats(false);
            }
        };

        void carregar();
    }, [unidadeId, user]);

    const saudacao = useMemo(() => {
        const hora = new Date().getHours();
        if (hora < 12) return "Bom dia";
        if (hora < 18) return "Boa tarde";
        return "Boa noite";
    }, []);

    const hojeLabel = useMemo(() => {
        return new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
        }).format(new Date());
    }, []);

    const primeiroNome = profile?.nome?.split(" ")[0] || "Chefe";

    // Primary CTA decision tree for the Welcome Hero Card
    const primaryCta = useMemo(() => {
        if (isChefia) {
            return {
                label: "Pré-Agenda",
                href: "/pre-agenda",
                icon: CalendarDays,
            };
        }
        if (profile?.cargo === "assessoria") {
            return {
                label: "Registrar Atividade",
                href: "/agenda",
                icon: ClipboardPlus,
            };
        }
        if (hasModule("briefing_editar") || hasModule("agenda_comunicacao_editar")) {
            return {
                label: "Novo Briefing",
                href: "/briefings",
                icon: FileText,
            };
        }
        return null;
    }, [isChefia, profile?.cargo, hasModule]);

    // Metric Cards configurations depending on user profile
    const metrics = isChefia
        ? [
            {
                label: "Agenda hoje",
                value: stats.agendaHoje,
                icon: CalendarDays,
                tone: (stats.agendaHoje > 0 ? "sky" : "slate") as Tone,
                visible: canViewAgenda,
            },
            {
                label: "Atendimentos no mês",
                value: stats.atendimentosUnidade,
                icon: LayoutGrid,
                tone: "indigo" as Tone,
                visible: true,
            },
            {
                label: "Despesas no mês",
                value: formatCurrency(stats.totalDespesas),
                icon: Wallet,
                tone: "amber" as Tone,
                visible: true,
            },
            {
                label: "Registros da Equipe",
                value: stats.equipeAtiva,
                icon: Users,
                tone: "slate" as Tone,
                visible: true,
            },
        ]
        : [
            {
                label: "Meus registros",
                value: stats.meusRegistrosMes,
                icon: FileText,
                tone: "slate" as Tone,
                visible: true,
            },
            {
                label: "Eventos participados",
                value: stats.eventosParticipados,
                icon: CalendarCheck2,
                tone: "emerald" as Tone,
                visible: true,
            },
            {
                label: "Agenda hoje",
                value: stats.agendaHoje,
                icon: CalendarDays,
                tone: (stats.agendaHoje > 0 ? "sky" : "slate") as Tone,
                visible: canViewAgenda,
            },
        ];

    // Quick Actions configurations
    const quickActions = useMemo(() => {
        const actions = [];

        if (canViewAgenda) {
            actions.push({
                label: "Pré-Agenda",
                description: "Visualizar e planejar compromissos",
                href: "/pre-agenda",
                icon: CalendarDays,
            });
        }

        if (hasModule("briefing_editar") || hasModule("agenda_comunicacao_editar") || hasModule("agenda_comunicacao_ver")) {
            actions.push({
                label: "Briefings",
                description: "Preparar documentos e subsídios",
                href: "/briefings",
                icon: FileText,
            });
        }

        if (hasModule("agenda_comunicacao_editar") || hasModule("agenda_comunicacao_ver")) {
            actions.push({
                label: "Comunicação",
                description: "Pautas editoriais e publicações de rede",
                href: "/agenda-comunicacao",
                icon: Megaphone,
            });
        }

        if (profile?.cargo === "assessoria") {
            actions.push({
                label: "Meus Registros",
                description: "Lançar novos registros em campo",
                href: "/agenda",
                icon: ClipboardPlus,
            });
        }

        if (profile?.cargo === "chefia") {
            actions.push({
                label: "Raio-X do Gabinete",
                description: "Auditoria e relatórios operacionais",
                href: "/visao-geral",
                icon: ShieldCheck,
            });
        }

        actions.push({
            label: "Configurações",
            description: profile?.cargo === "chefia" ? "Gerenciar perfil e permissões" : "Gerenciar meu perfil",
            href: "/profile",
            icon: Settings,
        });

        return actions;
    }, [canViewAgenda, hasModule, profile?.cargo]);

    const { highlightedMuniIds, filteredList } = useMemo(() => {
        const ids = new Set<string>();
        const list: Array<{ id: string; nome: string; val: number; extra?: string }> = [];

        Object.keys(mapMetrics).forEach(ibgeCode => {
            const metric = mapMetrics[ibgeCode];
            const name = municipios.find(m => m.codigo_ibge === ibgeCode)?.nome || `Município ${ibgeCode}`;
            
            let match = false;
            let val = 0;
            let extra = "";

            if (activeFilter === "sem_visita") {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                
                const neverVisited = metric.count_agenda === 0;
                const visitedLongAgo = metric.ultima_visita && new Date(metric.ultima_visita) < sixMonthsAgo;
                
                if (neverVisited || visitedLongAgo) {
                    match = true;
                    val = metric.count_agenda;
                    extra = metric.ultima_visita 
                        ? `Última: ${new Date(metric.ultima_visita).toLocaleDateString('pt-BR')}`
                        : "Nunca visitada";
                }
            } else if (activeFilter === "baixa_comunicacao") {
                if (metric.count_comunicacao === 0) {
                    match = true;
                    val = metric.count_agenda;
                    extra = `${metric.count_agenda} visitas`;
                }
            }

            if (match) {
                ids.add(ibgeCode);
                list.push({ id: ibgeCode, nome: name, val, extra });
            }
        });

        if (activeFilter === "sem_visita") {
            list.sort((a, b) => {
                const dateA = mapMetrics[a.id].ultima_visita;
                const dateB = mapMetrics[b.id].ultima_visita;
                if (!dateA && !dateB) return a.nome.localeCompare(b.nome);
                if (!dateA) return -1;
                if (!dateB) return 1;
                return new Date(dateA).getTime() - new Date(dateB).getTime();
            });
        } else {
            list.sort((a, b) => a.nome.localeCompare(b.nome));
        }

        return { highlightedMuniIds: ids, filteredList: list };
    }, [mapMetrics, activeFilter, municipios]);

    if (loading || authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-800" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-12">
            <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
                {/* Cabeçalho Principal (Welcome Hero) */}
                <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.01)] md:p-8">
                    {/* Linha azul Prisma na lateral esquerda */}
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#165cfb]" />

                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-2xl pl-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-450">
                                Painel Executivo
                            </p>
                            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                                {saudacao}, {primeiroNome}.
                            </h1>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500 max-w-xl">
                                Uma visão rápida e estruturada para abrir o dia: acompanhe a agenda oficial,
                                despesas consolidadas do gabinete e o fluxo de atendimentos ativos.
                            </p>
                            {primaryCta && (
                                <div className="mt-5">
                                    <Link
                                        href={primaryCta.href}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#165cfb] hover:bg-[#1554e2] text-white px-5 py-3 text-xs font-bold shadow-md shadow-blue-500/10 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#165cfb] focus:ring-offset-2"
                                    >
                                        <primaryCta.icon className="h-4 w-4" />
                                        {primaryCta.label}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Card do Dia (Hoje) */}
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-sm w-full lg:max-w-xs shrink-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-450">
                                Hoje
                            </p>
                            <p className="mt-1 font-display text-base font-extrabold capitalize text-slate-900">
                                {hojeLabel}
                            </p>
                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                                <span className="flex items-center gap-1.5 font-semibold">
                                    <Users className="h-3.5 w-3.5 text-slate-400" />
                                    {stats.equipeAtiva || 0} {stats.equipeAtiva === 1 ? "pessoa ativa" : "pessoas ativas"}
                                </span>
                                <span className="inline-flex rounded-full bg-slate-200/65 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                    {unidadeId ?? "CG"}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Grid de Métricas */}
                <section className={`mt-6 grid gap-4 sm:grid-cols-2 ${isChefia ? "lg:grid-cols-4" : "md:grid-cols-3"}`}>
                    {metrics
                        .filter((metric) => metric.visible)
                        .map((metric) => (
                            <MetricCard
                                key={metric.label}
                                label={metric.label}
                                value={metric.value}
                                icon={metric.icon}
                                tone={metric.tone}
                                loading={loadingStats}
                            />
                        ))}
                </section>

                {/* Seção de Ações Rápidas */}
                {quickActions.length > 0 && (
                    <section className="mt-8">
                        <div className="flex flex-col gap-1 mb-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                Rotinas Frequentes
                            </p>
                            <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                                Ações Rápidas
                            </h2>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {quickActions.map((action) => {
                                const Icon = action.icon;
                                return (
                                    <Link
                                        key={action.label}
                                        href={action.href}
                                        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-slate-350 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.01)] focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 active:scale-[0.98] cursor-pointer"
                                    >
                                        {/* Subtle hover indicator top border */}
                                        <div className="absolute inset-x-0 top-0 h-[2px] scale-x-0 bg-slate-950 transition-transform duration-300 group-hover:scale-x-100" />

                                        <div className="flex items-center justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 transition-colors duration-300 group-hover:bg-slate-950 group-hover:text-white group-hover:border-slate-950">
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-slate-900" />
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="text-sm font-extrabold text-slate-900">
                                                {action.label}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                                                {action.description}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Seção de Cobertura Geopolítica (Mapa de Calor) */}
                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.01)]">
                    <div className="flex flex-col gap-1 mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-450">
                            Presença e Cobertura Geopolítica
                        </p>
                        <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                            Mapa de Calor Político (Mato Grosso do Sul)
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-0.5">
                            Analise a atuação do gabinete no interior. Filtre por visitas presenciais ou cobertura de mídia e identifique prioridades estratégicas de agenda.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Mapa SVG */}
                        <div className="lg:col-span-7 flex justify-center w-full">
                            <PoliticoHeatmap
                                dataByMuni={mapMetrics}
                                metricKey={metricKey}
                                activeFilter={activeFilter}
                                highlightedMuniIds={highlightedMuniIds}
                                onSelectMuni={(id, nome) => {
                                    if (!id) {
                                        setSelectedMuni(null);
                                    } else {
                                        setSelectedMuni({ id, nome });
                                    }
                                }}
                            />
                        </div>

                        {/* Controles & Filtros Inteligentes */}
                        <div className="lg:col-span-5 flex flex-col gap-5">
                            {/* Seletor de Métrica */}
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">
                                    Modo de Visualização
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMetricKey("count_agenda");
                                            setActiveFilter("none");
                                        }}
                                        className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer border ${
                                            metricKey === "count_agenda"
                                                ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <CalendarDays className="h-4 w-4" />
                                        Visitas / Agendas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMetricKey("count_comunicacao");
                                            setActiveFilter("none");
                                        }}
                                        className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer border ${
                                            metricKey === "count_comunicacao"
                                                ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Megaphone className="h-4 w-4" />
                                        Posts de Mídia
                                    </button>
                                </div>
                            </div>

                            {/* Filtros Estratégicos */}
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">
                                    Filtros de Inteligência Geopolítica
                                </span>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilter(activeFilter === "sem_visita" ? "none" : "sem_visita")}
                                        className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border ${
                                            activeFilter === "sem_visita"
                                                ? "bg-amber-50 border-amber-300 text-amber-800 shadow-xs"
                                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span>Sem visitas há mais de 6 meses</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                            activeFilter === "sem_visita" ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500"
                                        }`}>
                                            {activeFilter === "sem_visita" ? filteredList.length : Object.values(mapMetrics).filter(m => {
                                                const sixAgo = new Date();
                                                sixAgo.setMonth(sixAgo.getMonth() - 6);
                                                return m.count_agenda === 0 || (m.ultima_visita && new Date(m.ultima_visita) < sixAgo);
                                            }).length}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveFilter(activeFilter === "baixa_comunicacao" ? "none" : "baixa_comunicacao")}
                                        className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border ${
                                            activeFilter === "baixa_comunicacao"
                                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs"
                                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span>Sem cobertura de comunicação</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                            activeFilter === "baixa_comunicacao" ? "bg-emerald-200 text-emerald-900" : "bg-slate-100 text-slate-500"
                                        }`}>
                                            {activeFilter === "baixa_comunicacao" ? filteredList.length : Object.values(mapMetrics).filter(m => m.count_comunicacao === 0).length}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Resultados dos Filtros */}
                            {activeFilter !== "none" ? (
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 max-h-[190px] overflow-y-auto">
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2.5">
                                        Municípios Identificados ({filteredList.length})
                                    </span>
                                    {filteredList.length === 0 ? (
                                        <p className="text-xs text-slate-450 italic p-2">Nenhum município pendente.</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredList.map(item => (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => setSelectedMuni({ id: item.id, nome: item.nome })}
                                                    className="py-2 flex items-center justify-between text-xs cursor-pointer group hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
                                                >
                                                    <span className="font-bold text-slate-800 group-hover:text-slate-900 truncate pr-3">{item.nome}</span>
                                                    <span className="text-[10px] font-extrabold text-slate-400 shrink-0 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5 uppercase tracking-wide">{item.extra}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Legenda & Detalhes da Seleção */
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                                    {selectedMuni ? (
                                        <div className="animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                                                <span className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                                                    <MapPin className="h-4 w-4 text-red-500" />
                                                    {selectedMuni.nome}
                                                </span>
                                                <button 
                                                    onClick={() => setSelectedMuni(null)}
                                                    className="text-[10px] font-extrabold text-slate-400 hover:text-slate-700 cursor-pointer"
                                                >
                                                    Fechar
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-2.5">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Visitas</span>
                                                    <span className="text-sm font-black text-slate-800 mt-1 block">{mapMetrics[selectedMuni.id]?.count_agenda || 0}</span>
                                                </div>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-2.5">
                                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide">Mídia / Posts</span>
                                                    <span className="text-sm font-black text-slate-800 mt-1 block">{mapMetrics[selectedMuni.id]?.count_comunicacao || 0}</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-semibold mt-3 bg-slate-50 border border-slate-100 p-2 rounded-xl text-center italic">
                                                Última visita: {mapMetrics[selectedMuni.id]?.ultima_visita 
                                                    ? new Date(mapMetrics[selectedMuni.id].ultima_visita as string).toLocaleDateString('pt-BR') 
                                                    : "Sem visitas registradas"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2.5">
                                                Legenda de Intensidade
                                            </span>
                                            <div className="flex flex-col gap-2 text-xs font-semibold text-slate-655">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-3 w-6 rounded-md border border-slate-200 bg-slate-50" />
                                                    <span>Nenhuma atividade registrada (0)</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-3 w-6 rounded-md border ${
                                                        metricKey === "count_agenda" ? "bg-[#bfdbfe] border-[#93c5fd]" : "bg-[#a7f3d0] border-[#6ee7b7]"
                                                    }`} />
                                                    <span>Cobertura inicial (1)</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-3 w-6 rounded-md border ${
                                                        metricKey === "count_agenda" ? "bg-[#60a5fa] border-[#3b82f6]" : "bg-[#34d399] border-[#10b981]"
                                                    }`} />
                                                    <span>Presença recorrente (2-3)</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-3 w-6 rounded-md border ${
                                                        metricKey === "count_agenda" ? "bg-[#2563eb] border-[#1d4ed8]" : "bg-[#059669] border-[#047857]"
                                                    }`} />
                                                    <span>Forte cobertura / Presença constante (&gt; 3)</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-semibold italic">
                                                * Dica: Clique em qualquer município no mapa para fixar os detalhes de contagem aqui.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Seção de Agenda Oficial */}
                {canViewAgenda && (
                    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.01)]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Pré-Agenda
                                </p>
                                <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-slate-900">
                                    O que exige atenção hoje
                                </h2>
                            </div>
                            <Link
                                href="/pre-agenda"
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-slate-800 hover:shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                            >
                                Abrir agenda
                                <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                            </Link>
                        </div>

                        <div className="mt-6">
                            {loadingStats ? (
                                <div className="h-28 animate-pulse rounded-2xl bg-slate-100 skeleton-shimmer" />
                            ) : stats.agendaHoje > 0 ? (
                                <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-4 ring-sky-100/50">
                                                <CalendarDays className="h-5 w-5" />
                                                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-505 border-2 border-white"></span>
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                                                    {stats.agendaHoje}
                                                </h3>
                                                <p className="mt-0.5 text-xs font-semibold text-slate-600">
                                                    {stats.agendaHoje === 1 ? "compromisso oficial agendado" : "compromissos oficiais agendados"} para hoje.
                                                </p>
                                            </div>
                                        </div>
                                        <p className="max-w-md text-xs leading-relaxed text-slate-500">
                                            Recomendamos priorizar deslocamentos e presença institucional antes de abrir outras rotinas operacionais no painel.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <EmptyAgenda />
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
