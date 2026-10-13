"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, ClipboardList, Plus, Filter,
    BarChart3, Users, CalendarDays, FileDown, UserPlus, SearchX,
    AlertCircle, AlertTriangle, TrendingUp, CheckCircle2, ChevronDown, ChevronUp, FileText, PieChart
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import Image from "next/image";

import {
    Categoria,
    Registro,
    RegistroComUsuario,
    RegistroCard,
    FormularioRegistro,
    ToastContainer,
    ToastState
} from "@/components/agenda-shared";

type TabState = "agenda" | "raiox";

const formatadorMesFechado = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
});

const obterChaveMesAtual = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");

    return `${ano}-${mes}`;
};

const formatarLabelMes = (mes: string) => {
    const data = new Date(`${mes}-01T12:00:00Z`);
    const label = formatadorMesFechado.format(data);

    return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function VisaoGeralPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const { hasModule, unidadeId } = usePermissions();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabState>("raiox");

    // Estados da Minha Agenda
    const [meusRegistros, setMeusRegistros] = useState<Registro[]>([]);
    const [carregandoMeus, setCarregandoMeus] = useState(true);
    const [modalAberto, setModalAberto] = useState(false);
    const [registroParaEditar, setRegistroParaEditar] = useState<Registro | null>(null);

    // Estados do Raio-X
    const [todosRegistros, setTodosRegistros] = useState<RegistroComUsuario[]>([]);
    const [todosPerfis, setTodosPerfis] = useState<{ id: string; nome: string; cargo: string }[]>([]);
    const [carregandoTodos, setCarregandoTodos] = useState(true);
    const [filtroAssessor, setFiltroAssessor] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "">("");
    const [filtroMes, setFiltroMes] = useState(obterChaveMesAtual);
    const [logsAbertos, setLogsAbertos] = useState(false);

    const [toasts, setToasts] = useState<ToastState[]>([]);
    const isLoading = authLoading || roleLoading;
    const filtrosAtivos =
        Boolean(filtroAssessor) ||
        Boolean(filtroCategoria) ||
        filtroMes !== obterChaveMesAtual();

    /* ---- Toast helpers ---- */
    const addToast = (message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));



    /* ---- Guards ---- */
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!isLoading && cargo && cargo !== "chefia" && !hasModule("visao_geral_auditoria")) {
            if (cargo === "comunicacao") router.replace("/");
            if (cargo === "assessoria") router.replace("/agenda");
            if (cargo === "secretaria") router.replace("/dashboard");
        }
    }, [isLoading, cargo, hasModule, router]);

    /* ---- Buscas ---- */
    const buscarMeusRegistros = useCallback(async () => {
        if (!user) return;
        setCarregandoMeus(true);
        const { data, error } = await supabase
            .from("relatorios_agenda")
            .select("id, user_id, data_evento, categoria, descricao_resolucao, valor_gasto, comprovantes_urls, criado_em")
            .eq("user_id", user.id)
            .order("data_evento", { ascending: false })
            .order("criado_em", { ascending: false })
            .limit(50);

        if (error) {
            addToast("Não consegui carregar sua agenda.", "error");
        }
        setMeusRegistros((data as unknown as Registro[]) ?? []);
        setCarregandoMeus(false);
    }, [user]);

    const buscarTodosPerfis = useCallback(async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from("perfis_usuarios")
            .select("id, nome, cargo")
            .eq("unidade_id", unidadeId ?? "CG");

        if (error) {
            console.error("Não consegui carregar os assessores.", error);
        } else {
            setTodosPerfis((data as { id: string; nome: string; cargo: string }[]) ?? []);
        }
    }, [user, unidadeId]);

    const buscarTodosRegistros = useCallback(async () => {
        if (!user) return;
        setCarregandoTodos(true);
        const { data, error } = await supabase
            .from("relatorios_agenda")
            .select(`
                id, data_evento, categoria, descricao_resolucao, valor_gasto, comprovantes_urls, criado_em, user_id,
                perfis_usuarios (nome, cargo)
            `)
            .order("data_evento", { ascending: false })
            .order("criado_em", { ascending: false })
            .limit(100);

        if (error) {
            addToast("Não consegui carregar a auditoria do gabinete.", "error");
        }
        setTodosRegistros((data as unknown as RegistroComUsuario[]) ?? []);
        setCarregandoTodos(false);
    }, [user]);

    useEffect(() => {
        if (!user || (cargo !== "chefia" && !hasModule("visao_geral_auditoria"))) return;

        const timeoutId = window.setTimeout(() => {
            void buscarMeusRegistros();
            void buscarTodosRegistros();
            void buscarTodosPerfis();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [user, cargo, hasModule, buscarMeusRegistros, buscarTodosRegistros, buscarTodosPerfis]);

    const assessoresDisponiveis = useMemo(() => {
        const assessores = todosPerfis.filter(p => p.cargo === "assessoria");
        return assessores
            .map((p) => ({ id: p.id, nome: p.nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }, [todosPerfis]);

    const mesesDisponiveis = useMemo(() => {
        const meses = new Set<string>([obterChaveMesAtual()]);

        todosRegistros.forEach((registro) => {
            if (registro.data_evento) {
                meses.add(registro.data_evento.slice(0, 7));
            }
        });

        return Array.from(meses)
            .sort((a, b) => b.localeCompare(a))
            .map((mes) => ({ valor: mes, label: formatarLabelMes(mes) }));
    }, [todosRegistros]);

    const registrosFiltrados = useMemo(() => {
        return todosRegistros.filter((registro) => {
            if (filtroAssessor && registro.user_id !== filtroAssessor) {
                return false;
            }

            if (filtroCategoria && registro.categoria !== filtroCategoria) {
                return false;
            }

            if (filtroMes && registro.data_evento.slice(0, 7) !== filtroMes) {
                return false;
            }

            return true;
        });
    }, [todosRegistros, filtroAssessor, filtroCategoria, filtroMes]);

    const limparFiltros = () => {
        setFiltroAssessor("");
        setFiltroCategoria("");
        setFiltroMes(obterChaveMesAtual());
    };

    const kpis = useMemo(() => {
        let totalAtendimentos = 0;
        let totalVisitas = 0;
        let totalReunioes = 0;
        let totalRepresentacoes = 0;
        let totalParticipacoes = 0;
        const equipeIds = new Set<string>();
        const porAssessor: Record<string, { nome: string; total: number; id: string }> = {};

        registrosFiltrados.forEach((r) => {
            if (r.categoria === "atendimento") totalAtendimentos++;
            if (r.categoria === "visita") totalVisitas++;
            if (r.categoria === "reuniao") totalReunioes++;
            if (r.categoria === "representacao") totalRepresentacoes++;
            if (r.categoria === "participacao") totalParticipacoes++;

            if (r.user_id) {
                equipeIds.add(r.user_id);
            }

            if (r.user_id && r.perfis_usuarios?.nome) {
                if (!porAssessor[r.user_id]) {
                    porAssessor[r.user_id] = { nome: r.perfis_usuarios.nome, total: 0, id: r.user_id };
                }
                porAssessor[r.user_id].total++;
            }
        });

        const forcaTrabalho = Object.values(porAssessor)
            .sort((a, b) => b.total - a.total);

        const totalComprovados = registrosFiltrados.filter(
            r => r.comprovantes_urls && r.comprovantes_urls.length > 0
        ).length;

        const taxaComprovacao = registrosFiltrados.length > 0
            ? Math.round((totalComprovados / registrosFiltrados.length) * 100)
            : 0;

        return {
            totalAtendimentos,
            totalVisitas,
            totalReunioes,
            totalRepresentacoes,
            totalParticipacoes,
            equipeAtiva: equipeIds.size,
            forcaTrabalho,
            taxaComprovacao
        };
    }, [registrosFiltrados]);

    const assessoresInativos = useMemo(() => {
        const equipe = todosPerfis.filter(p => p.cargo === "assessoria");
        const registrosDoMes = todosRegistros.filter(r => r.data_evento.slice(0, 7) === filtroMes);
        const idsAtivos = new Set(registrosDoMes.map(r => r.user_id));
        return equipe.filter(p => !idsAtivos.has(p.id));
    }, [todosPerfis, todosRegistros, filtroMes]);

    const alertaDesequilibrio = useMemo(() => {
        const totalPeriodo = registrosFiltrados.length;
        if (totalPeriodo < 4) return null;

        if (kpis.forcaTrabalho.length > 0) {
            const principal = kpis.forcaTrabalho[0];
            const percentual = (principal.total / totalPeriodo) * 100;
            if (percentual > 60) {
                return {
                    nome: principal.nome.split(" ")[0],
                    percentual: Math.round(percentual),
                    total: principal.total
                };
            }
        }
        return null;
    }, [registrosFiltrados, kpis.forcaTrabalho]);

    const alertaFaltaDeCampo = useMemo(() => {
        const hasVisits = registrosFiltrados.some(r => r.categoria === "visita");
        return !hasVisits && registrosFiltrados.length > 0;
    }, [registrosFiltrados]);

    const comprovantesPendentesCount = useMemo(() => {
        return registrosFiltrados.filter(r => {
            const precisaComprovante = r.categoria === "visita" || r.categoria === "representacao";
            const semComprovante = !r.comprovantes_urls || r.comprovantes_urls.length === 0;
            return precisaComprovante && semComprovante;
        }).length;
    }, [registrosFiltrados]);

    const handleSucessoRegistro = (novo: Registro, isEdit?: boolean) => {
        setModalAberto(false);
        setRegistroParaEditar(null);
        if (isEdit) {
            setMeusRegistros((prev) => prev.map(r => r.id === novo.id ? novo : r));
            setTodosRegistros((prev) => prev.map(r => r.id === novo.id ? { ...r, ...novo } : r));
            addToast("Registro atualizado.", "success");
        } else {
            setMeusRegistros((prev) => [novo, ...prev]);
            buscarTodosRegistros();
            addToast("Registro salvo.", "success");
        }
    };

    /* ---- Loading inicial ---- */
    if (isLoading || !user || (cargo !== "chefia" && !hasModule("visao_geral_auditoria"))) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col print:bg-transparent">
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
                <Image
                    src="/timbrado-relatorio.png"
                    alt="Timbrado Governo"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    unoptimized
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                />
            </div>

            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
                <section className="print:hidden">
                    {/* Page Header Padrão Prisma */}
                    <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm mb-6 p-6 md:p-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                                        Raio-X do Gabinete
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">
                                        Auditoria Operacional
                                    </span>
                                </div>
                                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                                    Auditoria Operacional da Equipe
                                </h1>
                                <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-relaxed">
                                    Acompanhamento de registros de campo, comprovantes e atendimentos realizados pela assessoria.
                                </p>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                                {activeTab === "agenda" && (
                                    <button
                                        type="button"
                                        onClick={() => setModalAberto(true)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 active:scale-98 shadow-sm"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Novo registro
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Seletor de Abas Pílula */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 mb-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab("raiox")}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                                activeTab === "raiox"
                                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                                    : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Painel de Auditoria
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("agenda")}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 ${
                                activeTab === "agenda"
                                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                                    : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            <CalendarDays className="h-3.5 w-3.5" />
                            Meus Lançamentos
                        </button>
                    </div>
                </section>

                {/* ========================================================
                    ABA: RAIO-X DO GABINETE (Web)
                    ======================================================== */}
                {activeTab === "raiox" && (
                    <div className="mt-2 space-y-6 animate-in fade-in duration-300 print:hidden">

                        {/* KPIs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_8px_20px_-4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.08),0_12px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-300">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Lançamentos</h3>
                                        <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">
                                            {carregandoTodos ? "..." : registrosFiltrados.length}
                                        </p>
                                    </div>
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 shadow-2xs">
                                        <ClipboardList className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_8px_20px_-4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.08),0_12px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-300">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxa de Comprovação</h3>
                                        <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">
                                            {carregandoTodos ? "..." : `${kpis.taxaComprovacao}%`}
                                        </p>
                                    </div>
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 shadow-2xs">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05),0_8px_20px_-4px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-3px_rgba(0,0,0,0.08),0_12px_24px_-4px_rgba(0,0,0,0.04)] transition-all duration-300">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assessores Ativos</h3>
                                        <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900">
                                            {carregandoTodos ? "..." : `${kpis.equipeAtiva} / ${todosPerfis.filter(p => p.cargo === "assessoria").length}`}
                                        </p>
                                    </div>
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 shadow-2xs">
                                        <Users className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Barra de Ferramentas (Toolbar) Elegante */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                                {/* Filtro Assessor */}
                                <div className="relative">
                                    <select
                                        id="toolbar-filtro-assessor"
                                        value={filtroAssessor}
                                        onChange={(e) => setFiltroAssessor(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                                    >
                                        <option value="">Todos os Assessores</option>
                                        {assessoresDisponiveis.map((assessor) => (
                                            <option key={assessor.id} value={assessor.id}>
                                                {assessor.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>

                                {/* Filtro Categoria */}
                                <div className="relative">
                                    <select
                                        id="toolbar-filtro-categoria"
                                        value={filtroCategoria}
                                        onChange={(e) => setFiltroCategoria(e.target.value as Categoria | "")}
                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                                    >
                                        <option value="">Todas as Categorias</option>
                                        <option value="atendimento">Atendimento</option>
                                        <option value="reuniao">Reunião</option>
                                        <option value="visita">Visita</option>
                                        <option value="representacao">Representação</option>
                                        <option value="participacao">Participação</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>

                                {/* Filtro Mês */}
                                <div className="relative">
                                    <select
                                        id="toolbar-filtro-mes"
                                        value={filtroMes}
                                        onChange={(e) => setFiltroMes(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                                    >
                                        {mesesDisponiveis.map((mes) => (
                                            <option key={mes.valor} value={mes.valor}>
                                                {mes.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                                {filtrosAtivos && (
                                    <button
                                        type="button"
                                        onClick={limparFiltros}
                                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all active:scale-95"
                                    >
                                        Limpar Filtros
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                                >
                                    <FileDown className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>

                        {/* Painel de Alertas de Gargalos */}
                        {!carregandoTodos && (assessoresInativos.length > 0 || alertaDesequilibrio || alertaFaltaDeCampo || comprovantesPendentesCount > 0) && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/20 p-5 md:p-6 shadow-xs">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">
                                        Alertas de Gargalo Operacional
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {assessoresInativos.length > 0 && (
                                        <div className="flex items-start gap-3 bg-white border border-amber-100/70 rounded-xl p-4 shadow-2xs">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assessores Inativos no Mês</h4>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    Os seguintes integrantes não possuem nenhum lançamento na agenda neste mês:{" "}
                                                    <span className="font-bold text-amber-700">
                                                        {assessoresInativos.map(p => p.nome.split(" ")[0]).join(", ")}
                                                    </span>.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {alertaDesequilibrio && (
                                        <div className="flex items-start gap-3 bg-white border border-amber-100/70 rounded-xl p-4 shadow-2xs">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Desequilíbrio de Carga</h4>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    O assessor <span className="font-bold text-amber-700">{alertaDesequilibrio.nome}</span> concentrou sozinho{" "}
                                                    <span className="font-bold text-amber-700">{alertaDesequilibrio.percentual}%</span> de todas as atividades registradas no período ({alertaDesequilibrio.total} lançamentos).
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {alertaFaltaDeCampo && (
                                        <div className="flex items-start gap-3 bg-white border border-amber-100/70 rounded-xl p-4 shadow-2xs">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ausência de Trabalho Externo</h4>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    Nenhuma <span className="font-bold text-amber-700">Visita de Campo</span> foi lançada por nenhum assessor neste período. Risco de perda de engajamento externo.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {comprovantesPendentesCount > 0 && (
                                        <div className="flex items-start gap-3 bg-white border border-amber-100/70 rounded-xl p-4 shadow-2xs">
                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pendência de Comprovantes</h4>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    Identificamos <span className="font-bold text-amber-700">{comprovantesPendentesCount}</span> atividades externas (visitas ou representações) sem nenhum anexo anexado para auditoria.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Seção de Gráficos e Visualizações */}
                        {!carregandoTodos && registrosFiltrados.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Gráfico 1: Lançamentos por Assessor */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <TrendingUp className="w-4 h-4 text-slate-500" />
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                                            Lançamentos por Assessor
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {kpis.forcaTrabalho.map((assessor, idx) => {
                                            const maxVal = Math.max(...kpis.forcaTrabalho.map(a => a.total)) || 1;
                                            const pct = Math.round((assessor.total / maxVal) * 100);
                                            return (
                                                <div key={assessor.id || idx} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                                                        <span>{assessor.nome}</span>
                                                        <span className="font-bold text-slate-900">{assessor.total} atividades</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-slate-800 rounded-full h-2 transition-all duration-1000 ease-out"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Gráfico 2: Foco Temático / Divisão por Categoria */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6">
                                        <PieChart className="w-4 h-4 text-slate-500" />
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                                            Distribuição por Categoria
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { label: "Atendimento", count: kpis.totalAtendimentos, color: "bg-blue-600", text: "text-blue-700", border: "border-blue-200", bg: "bg-blue-50" },
                                            { label: "Reunião", count: kpis.totalReunioes, color: "bg-violet-600", text: "text-violet-700", border: "border-violet-200", bg: "bg-violet-50" },
                                            { label: "Visita", count: kpis.totalVisitas, color: "bg-emerald-600", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
                                            { label: "Representação", count: kpis.totalRepresentacoes, color: "bg-amber-600", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
                                            { label: "Participação", count: kpis.totalParticipacoes, color: "bg-teal-600", text: "text-teal-700", border: "border-teal-200", bg: "bg-teal-50" },
                                        ].map((cat, idx) => {
                                            const total = registrosFiltrados.length || 1;
                                            const pct = Math.round((cat.count / total) * 100);
                                            return (
                                                <div key={idx} className="flex items-center justify-between gap-4">
                                                    <div className="w-[120px] shrink-0 text-left">
                                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cat.bg} ${cat.border} ${cat.text}`}>
                                                            {cat.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`${cat.color} rounded-full h-2 transition-all duration-1000 ease-out`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="w-16 text-right">
                                                        <span className="text-xs font-bold text-slate-800">{cat.count} ({pct}%)</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Detalhamento dos Lançamentos */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-600" />
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                                        Logs de Auditoria
                                    </h2>
                                </div>
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                    {registrosFiltrados.length} lançamentos
                                </span>
                            </div>

                            <div className="p-6">
                                {carregandoTodos ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                                    </div>
                                ) : registrosFiltrados.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 shadow-2xs">
                                            <SearchX className="h-5 w-5" />
                                        </div>
                                        <p className="mt-4 text-sm font-bold text-slate-900">Nenhum registro com esses filtros</p>
                                        <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
                                            Ajuste os filtros ou limpe a seleção para voltar à visão do período.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {registrosFiltrados.map((r) => (
                                            <RegistroCard
                                                key={r.id}
                                                registro={r}
                                                showUser={true}
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

                                                    setTodosRegistros(prev => prev.filter(item => item.id !== id));
                                                    setMeusRegistros(prev => prev.filter(item => item.id !== id));
                                                    addToast("Registro excluído.", "success");
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================
                    ABA: MINHA AGENDA (Web)
                    ======================================================== */}
                {activeTab === "agenda" && (
                    <div className="mt-6 animate-in fade-in duration-300 max-w-3xl print:hidden">

                        {!carregandoMeus && (
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                                        Meus registros
                                    </p>
                                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                                        Atividades lançadas por você
                                    </h2>
                                </div>
                                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                                    {meusRegistros.length} registro(s)
                                </span>
                            </div>
                        )}

                        {carregandoMeus && (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse border border-slate-200" />
                                ))}
                            </div>
                        )}

                        {!carregandoMeus && meusRegistros.length > 0 && (
                            <div className="space-y-3">
                                {meusRegistros.map((r) => (
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

                                            setMeusRegistros(prev => prev.filter(item => item.id !== id));
                                            setTodosRegistros(prev => prev.filter(item => item.id !== id));
                                                    addToast("Registro excluído.", "success");
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {!carregandoMeus && meusRegistros.length === 0 && (
                            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                                    <ClipboardList className="h-7 w-7 text-slate-400" />
                                </div>
                                <div>
                                    <p className="mt-4 font-black text-slate-900">Você ainda não lançou registros</p>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        Use este espaço para atividades que entram no relatório operacional.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setModalAberto(true)}
                                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary-hover"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Novo registro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================
                    DOSSIÊ EXECUTIVO (Apenas Impressão)
                    ======================================================== */}
                <table className="hidden print:table w-full mx-auto border-collapse font-sans bg-transparent">
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
                                <div className="text-center pb-4 border-b-2 border-slate-200 mb-6 mt-4">
                                    <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-800">
                                        Dossiê Executivo de Gabinete
                                    </h1>
                                    <p className="text-sm font-semibold mt-1 text-slate-700">
                                        Gestor: {profile?.nome ?? "Chefe de Gabinete"}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
                                    </p>
                                </div>

                                <div className="space-y-8">

                                    {/* Seção 1: Força de Trabalho (Gráfico de Barras Nativo HTML) */}
                                    <div className="print-break-inside-avoid">
                                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                                            1. Força de Trabalho (Lançamentos por Assessor)
                                        </h2>
                                        {kpis.forcaTrabalho.length > 0 ? (
                                            <div className="space-y-4">
                                                {kpis.forcaTrabalho.map((assessor) => {
                                                    const maxVal = Math.max(...kpis.forcaTrabalho.map(a => a.total));
                                                    const pct = Math.round((assessor.total / maxVal) * 100);
                                                    return (
                                                        <div key={assessor.nome} className="flex items-center gap-4 text-sm">
                                                            <span className="w-32 font-semibold text-slate-700 truncate">
                                                                {assessor.nome}
                                                            </span>
                                                            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary"
                                                                    style={{ width: `${pct}%`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                                                                />
                                                            </div>
                                                            <span className="w-12 text-right font-bold text-slate-800">
                                                                {assessor.total}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">Sem dados neste período.</p>
                                        )}
                                    </div>

                                    {/* Seção 2: Agendas Estratégicas do Chefe */}
                                    <div className="print-break-inside-avoid pt-4">
                                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                                            2. Agendas Estratégicas (Chefe de Gabinete)
                                        </h2>
                                        {meusRegistros.length > 0 ? (
                                            <div className="space-y-3">
                                                {meusRegistros.map((r) => (
                                                    <RegistroCard key={r.id} registro={r} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">Sem registros estratégicos agora.</p>
                                        )}
                                    </div>

                                    {/* Seção 3: Auditoria Geral */}
                                    <div className="print-break-inside-avoid pt-4">
                                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                                            3. Auditoria Geral do Gabinete
                                        </h2>
                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            <div className="p-3 border border-slate-200 rounded-xl">
                                                <span className="block text-xs text-slate-500 font-semibold mb-1">Atendimentos</span>
                                                <span className="text-xl font-bold">{kpis.totalAtendimentos}</span>
                                            </div>
                                            <div className="p-3 border border-slate-200 rounded-xl">
                                                <span className="block text-xs text-slate-500 font-semibold mb-1">Comprovação</span>
                                                <span className="text-xl font-bold">{kpis.taxaComprovacao}%</span>
                                            </div>
                                            <div className="p-3 border border-slate-200 rounded-xl">
                                                <span className="block text-xs text-slate-500 font-semibold mb-1">Equipe Ativa</span>
                                                <span className="text-xl font-bold">{kpis.equipeAtiva} assessores</span>
                                            </div>
                                        </div>

                                        {registrosFiltrados.length > 0 ? (
                                            <div className="space-y-3">
                                                {registrosFiltrados.map((r) => (
                                                    <RegistroCard key={r.id} registro={r} showUser={true} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">Nenhum registro da equipe.</p>
                                        )}
                                    </div>

                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </main>

            {modalAberto && (
                <FormularioRegistro
                    userId={user.id}
                    onSuccess={handleSucessoRegistro}
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
