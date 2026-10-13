"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    FileText,
    Calendar,
    ChevronDown,
    MapPin,
    Megaphone,
    FileDown,
    Building2,
    TrendingUp,
    CheckCircle,
    Info,
    HelpCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import PageHeader from "@/components/page-header";
import RelatorioDesempenhoPDF from "@/components/RelatorioDesempenhoPDF";

// Lazy-load PDF motor on the client side to avoid SSR/hydration errors
const PDFDownloadLink = dynamic(
    () => import("@react-pdf/renderer").then((mod) => ({ default: mod.PDFDownloadLink })),
    { ssr: false }
);

interface DemandItem {
    id: string;
    solicitante: string;
    descricao: string;
    status: string;
    cidade: string;
}

interface PerformanceData {
    periodo: string;
    startDate: string;
    endDate: string;
    unidadeId: string;
    metrics: {
        agendas: {
            total: number;
            capitalCount: number;
            interiorCount: number;
            capitalPercentage: number;
            interiorPercentage: number;
            topCidades: { nome: string; visitas: number }[];
        };
        comunicacao: {
            total: number;
            porEixo: { label: string; count: number }[];
            porFormato: { label: string; count: number }[];
        };
        eixosConsolidados: { label: string; count: number }[];
        financeiro: {
            totalGasto: number;
            porCategoria: { label: string; value: number }[];
        };
        atendimentos: {
            total: number;
            porStatus: { label: string; count: number }[];
        };
        demandas: {
            total: number;
            porStatus: { label: string; count: number }[];
            taxaResolucao: number;
            recentes: DemandItem[];
        };
    };
}

export default function RelatoriosDesempenhoPage() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const { loading: permissionsLoading, hasModule, unidadeId } = usePermissions();

    const [dados, setDados] = useState<PerformanceData | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    const [filterPeriod, setFilterPeriod] = useState<"este_mes" | "mes_passado" | "este_ano" | "ultimo_ano" | "personalizado">("este_ano");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const isLoading = authLoading || roleLoading || permissionsLoading;

    // Strict access control: restricted to chefia, secretaria, comunicacao, or visao_geral_auditoria module
    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace("/login");
                return;
            }
            const hasAuditoria = hasModule("visao_geral_auditoria");
            const canAccess = cargo === "chefia" || cargo === "secretaria" || cargo === "comunicacao" || hasAuditoria;
            if (!canAccess) {
                router.replace("/acesso-negado");
            }
        }
    }, [isLoading, user, cargo, hasModule, router]);

    // Fetch consolidated metrics
    const fetchMetrics = async () => {
        try {
            setCarregando(true);
            setErro(null);

            let url = `/api/desempenho?periodo=${filterPeriod}`;
            if (filterPeriod === "personalizado" && startDate && endDate) {
                url += `&startDate=${startDate}&endDate=${endDate}`;
            }

            const res = await fetch(url);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Falha ao obter os dados do relatório.");
            }

            const data = await res.json();
            setDados(data);
        } catch (err: any) {
            console.error("Erro ao obter estatísticas:", err);
            setErro(err.message || "Erro desconhecido.");
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        if (user && !isLoading && (cargo === "chefia" || cargo === "secretaria" || cargo === "comunicacao" || hasModule("visao_geral_auditoria"))) {
            if (filterPeriod !== "personalizado" || (startDate && endDate)) {
                void fetchMetrics();
            }
        }
    }, [user, isLoading, filterPeriod, startDate, endDate, cargo, hasModule]);

    const formatarMoeda = (valor: number) => {
        return valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });
    };

    const getUnidadeNome = () => {
        return unidadeId === "DD" ? "Gabinete de Apoio (DD)" : "Gabinete Geral (CG)";
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
            <PageHeader
                title="Relatório de Desempenho Institucional"
                description="Consolidação de atividades operacionais, presença geográfica e resolutividade de demandas (CRM)."
            />

            {/* Filtros */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.01)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <select
                                value={filterPeriod}
                                onChange={(e) => setFilterPeriod(e.target.value as any)}
                                className="h-10 rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-xs font-bold text-slate-700 outline-none transition-all hover:bg-slate-100 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 appearance-none cursor-pointer"
                            >
                                <option value="este_mes">Este Mês</option>
                                <option value="mes_passado">Mês Passado</option>
                                <option value="este_ano">Este Ano (Janeiro até Hoje)</option>
                                <option value="ultimo_ano">Últimos 12 Meses</option>
                                <option value="personalizado">Período Personalizado</option>
                            </select>
                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {filterPeriod === "personalizado" && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-255">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-655 outline-none focus:border-slate-400"
                                />
                                <span className="text-xs text-slate-400 font-semibold">até</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-655 outline-none focus:border-slate-400"
                                />
                            </div>
                        )}
                    </div>

                    {dados && !carregando && (
                        <div className="shrink-0">
                            <PDFDownloadLink
                                document={
                                    <RelatorioDesempenhoPDF
                                        dados={dados}
                                        unidadeNome={getUnidadeNome()}
                                        usuarioGerador={profile?.nome || "Usuário Prisma"}
                                    />
                                }
                                fileName={`relatorio-desempenho-${unidadeId || "CG"}-${filterPeriod}.pdf`}
                            >
                                {({ loading: pdfLoading }) => (
                                    <button
                                        disabled={pdfLoading}
                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-95 cursor-pointer"
                                    >
                                        {pdfLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        ) : (
                                            <FileDown className="h-4 w-4 text-slate-200" />
                                        )}
                                        Exportar PDF Timbrado
                                    </button>
                                )}
                            </PDFDownloadLink>
                        </div>
                    )}
                </div>
            </div>

            {/* Painel Principal */}
            {carregando ? (
                <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consolidando Dossiê Operacional...</span>
                </div>
            ) : erro ? (
                <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50/20 p-6 text-center">
                    <Info className="h-8 w-8 text-red-500" />
                    <h3 className="text-sm font-bold text-slate-855">Não consegui calcular o desempenho</h3>
                    <p className="text-xs text-slate-500 max-w-xs">{erro}</p>
                </div>
            ) : dados ? (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                    {/* Cards Superiores */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Agendas Confirmadas</span>
                                <div className="rounded-xl bg-slate-100 p-2 text-slate-655">
                                    <Building2 className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="mt-4 text-3xl font-black text-slate-900">{dados.metrics.agendas.total}</h2>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                {dados.metrics.agendas.capitalPercentage}% Capital | {dados.metrics.agendas.interiorPercentage}% Interior
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-455">CRM e Demandas</span>
                                <div className="rounded-xl bg-slate-100 p-2 text-slate-655">
                                    <CheckCircle className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="mt-4 text-3xl font-black text-slate-900">{dados.metrics.demandas.total}</h2>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                Taxa de Resolutividade: <span className="font-extrabold text-emerald-600">{dados.metrics.demandas.taxaResolucao}%</span>
                              </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-455">Investimento Operacional</span>
                                <div className="rounded-xl bg-slate-100 p-2 text-slate-655">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                            </div>
                            <h2 className="mt-4 text-3xl font-black text-slate-900">{formatarMoeda(dados.metrics.financeiro.totalGasto)}</h2>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                Custeio total de atividades de campo
                            </p>
                        </div>
                    </div>

                    {/* Foco Geográfico e Cidades */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Cobertura Geográfica */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-red-500" />
                                    Foco Geográfico (Capital vs Interior)
                                </h3>
                                <p className="text-xs text-slate-455 mt-1.5 leading-relaxed">
                                    Comparativo percentual de viagens, reuniões e agendas do titular baseados no município sede.
                                </p>
                            </div>

                            <div className="mt-6 flex flex-col gap-5">
                                <div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                                        <span>Capital / Sede</span>
                                        <span>{dados.metrics.agendas.capitalPercentage}% ({dados.metrics.agendas.capitalCount} agendas)</span>
                                    </div>
                                    <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-150">
                                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${dados.metrics.agendas.capitalPercentage}%` }} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                                        <span>Cidades do Interior</span>
                                        <span>{dados.metrics.agendas.interiorPercentage}% ({dados.metrics.agendas.interiorCount} agendas)</span>
                                    </div>
                                    <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-150">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dados.metrics.agendas.interiorPercentage}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Cidades */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                                Presença Regional Ativa (Top 5 Cidades)
                            </h3>
                            <div className="divide-y divide-slate-100">
                                {dados.metrics.agendas.topCidades.length > 0 ? (
                                    dados.metrics.agendas.topCidades.map((c, idx) => (
                                        <div key={idx} className="py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="h-6 w-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                                <span className="text-xs font-bold text-slate-700">{c.nome}</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-800 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md">{c.visitas} visitas</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-455 text-center py-6">Nenhuma agenda registrada no interior no período.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Concentração de Eixos e Demandas do CRM */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Eixos Temáticos */}
                        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-4">
                                <Megaphone className="h-4 w-4 text-[#165cfb]" />
                                Setores Governamentais
                            </h3>
                            <div className="flex flex-col gap-3.5">
                                {dados.metrics.eixosConsolidados.length > 0 ? (
                                    dados.metrics.eixosConsolidados.map((e, idx) => {
                                        const labelsMap: Record<string, string> = {
                                            saude: "Saúde",
                                            educacao: "Educação",
                                            seguranca: "Segurança",
                                            infraestrutura: "Infraestrutura",
                                            assistencia_social: "Assistência Social",
                                            institucional: "Institucional",
                                            "sem eixo": "Não Classificado"
                                        };
                                        const labelText = labelsMap[e.label.toLowerCase()] || e.label;
                                        return (
                                            <div key={idx}>
                                                <div className="flex items-center justify-between text-xs font-semibold text-slate-655 mb-1">
                                                    <span>{labelText}</span>
                                                    <span className="font-extrabold">{e.count} ações</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-slate-50 overflow-hidden border border-slate-100">
                                                    <div className="h-full bg-slate-650 rounded-full" style={{ width: `${Math.min(100, (e.count / Math.max(1, dados.metrics.agendas.total + dados.metrics.comunicacao.total)) * 100)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-slate-455 text-center py-6">Nenhum eixo governamental associado às pautas.</p>
                                )}
                            </div>
                        </div>

                        {/* CRM - Demandas Recentes */}
                        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
                                Demandas Recentes do Interior (CRM)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="pb-3 pr-2">Solicitante</th>
                                            <th className="pb-3 pr-2">Cidade</th>
                                            <th className="pb-3 pr-2">Demanda / Descrição</th>
                                            <th className="pb-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {dados.metrics.demandas.recentes.length > 0 ? (
                                            dados.metrics.demandas.recentes.map((d) => (
                                                <tr key={d.id} className="text-xs">
                                                    <td className="py-3 pr-2 font-bold text-slate-800">{d.solicitante}</td>
                                                    <td className="py-3 pr-2 text-slate-500 font-semibold">{d.cidade}</td>
                                                    <td className="py-3 pr-2 text-slate-500 max-w-xs truncate">{d.descricao}</td>
                                                    <td className="py-3 text-right">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                                            d.status === "entregue" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                            d.status === "em_andamento" ? "bg-amber-50 text-amber-700 border-amber-250" :
                                                            "bg-rose-50 text-rose-700 border-rose-200"
                                                        }`}>
                                                            {d.status === "entregue" ? "Entregue" : 
                                                             d.status === "em_andamento" ? "Pendente" : "Negada"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-xs text-slate-455">Nenhuma demanda registrada no período.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                    <span className="text-xs text-slate-400">Nenhum dado disponível. Escolha outro período de filtro.</span>
                </div>
            )}
        </div>
    );
}
