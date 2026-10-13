"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, Plus, Calendar, FileDown, SearchX,
    AlertCircle, Trash2, Edit, Upload, ChevronDown, Phone,
    AlertTriangle, Download
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { Aniversariante } from "@/lib/types";
import MunicipioAutocomplete from "@/components/ui/municipio-autocomplete";

// Reusable toast component inline representation to match project's ToastContainer structure
interface ToastState {
    id: number;
    message: string;
    type: "success" | "error";
}

export default function ContatosPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const { hasModule, unidadeId } = usePermissions();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"lista" | "calendario">("lista");
    const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [filtroMes, setFiltroMes] = useState<string>("todos");
    const [filtroCidade, setFiltroCidade] = useState<string>("todas");
    const [pesquisa, setPesquisa] = useState<string>("");

    // Modal Contato CRUD
    const [modalAberto, setModalAberto] = useState(false);
    const [paraEditar, setParaEditar] = useState<Aniversariante | null>(null);
    const [nome, setNome] = useState("");
    const [cargoContato, setCargoContato] = useState("");
    const [dia, setDia] = useState<number>(1);
    const [mes, setMes] = useState<number>(1);
    const [telefone, setTelefone] = useState("");
    const [cidade, setCidade] = useState("");
    const [municipioId, setMunicipioId] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    // Modal Importação em Massa
    const [modalImportacaoAberto, setModalImportacaoAberto] = useState(false);
    const [importacaoTexto, setImportacaoTexto] = useState("");
    const [registrosPrevisualizados, setRegistrosPrevisualizados] = useState<{
        nome: string;
        cargo?: string | null;
        dia: number;
        mes: number;
        telefone?: string | null;
        cidade?: string | null;
    }[]>([]);
    const [salvandoImportacao, setSalvandoImportacao] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [resultadoImportacao, setResultadoImportacao] = useState<{
        importados: number;
        duplicados: number;
        itensDuplicados: { nome: string; cargo: string | null; telefone: string | null; cidade: string | null; motivo: string }[];
    } | null>(null);

    const [toasts, setToasts] = useState<ToastState[]>([]);
    const isLoading = authLoading || roleLoading;

    /* ---- Toast helpers ---- */
    const addToast = (message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };

    const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

    /* ---- Authorization Guards ---- */
    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!authLoading && !roleLoading && user && cargo) {
            const canAccess =
                cargo === "chefia" ||
                cargo === "secretaria" ||
                cargo === "comunicacao" ||
                hasModule("aniversariantes_gerenciar");
            if (!canAccess) {
                router.replace("/dashboard");
            }
        }
    }, [authLoading, roleLoading, user, cargo, hasModule, router]);

    /* ---- Fetch Data ---- */
    const buscarAniversariantes = useCallback(async () => {
        if (!user) return;
        setCarregando(true);
        try {
            const { data, error } = await supabase
                .from("aniversariantes")
                .select("id, nome, cargo, dia, mes, telefone, cidade, unidade_id, criado_em, municipio_id")
                .order("mes", { ascending: true })
                .order("dia", { ascending: true })
                .order("nome", { ascending: true });

            if (error) {
                throw error;
            }
            setAniversariantes((data as Aniversariante[]) ?? []);
        } catch (err: any) {
            console.error("Falha ao buscar contatos:", err);
            addToast("Não consegui carregar a lista de contatos.", "error");
        } finally {
            setCarregando(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const timeoutId = window.setTimeout(() => {
            void buscarAniversariantes();
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [user, buscarAniversariantes]);

    /* ---- Memoized Filters ---- */
    const cidadesUnicas = useMemo(() => {
        const cidades = aniversariantes
            .map((a) => a.cidade?.trim())
            .filter(Boolean) as string[];
        const map = new Map<string, string>();
        cidades.forEach(c => {
            map.set(c.toLowerCase(), c);
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [aniversariantes]);

    const filtrados = useMemo(() => {
        return aniversariantes.filter((a) => {
            if (filtroMes !== "todos" && a.mes !== parseInt(filtroMes, 10)) {
                return false;
            }
            if (filtroCidade !== "todas" && (!a.cidade || a.cidade.toLowerCase() !== filtroCidade.toLowerCase())) {
                return false;
            }
            if (pesquisa.trim()) {
                const busca = pesquisa.toLowerCase();
                const matchesNome = a.nome?.toLowerCase().includes(busca);
                const matchesCargo = a.cargo?.toLowerCase().includes(busca);
                const matchesTelefone = a.telefone?.toLowerCase().includes(busca);
                const matchesCidade = a.cidade?.toLowerCase().includes(busca);
                return matchesNome || matchesCargo || matchesTelefone || matchesCidade;
            }
            return true;
        });
    }, [aniversariantes, filtroMes, filtroCidade, pesquisa]);

    /* ---- CRUD Actions ---- */
    const abrirCriar = () => {
        setParaEditar(null);
        setNome("");
        setCargoContato("");
        setTelefone("");
        setCidade("");
        setMunicipioId(null);
        const hoje = new Date();
        setDia(hoje.getDate());
        setMes(hoje.getMonth() + 1);
        setModalAberto(true);
    };

    const abrirEditar = (a: Aniversariante) => {
        setParaEditar(a);
        setNome(a.nome);
        setCargoContato(a.cargo || "");
        setDia(a.dia);
        setMes(a.mes);
        setTelefone(a.telefone || "");
        setCidade(a.cidade || "");
        setMunicipioId(a.municipio_id || null);
        setModalAberto(true);
    };

    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome.trim()) {
            addToast("O nome é obrigatório.", "error");
            return;
        }
        if (dia < 1 || dia > 31) {
            addToast("Dia inválido.", "error");
            return;
        }
        if (mes < 1 || mes > 12) {
            addToast("Mês inválido.", "error");
            return;
        }

        setSalvando(true);
        try {
            const payload = {
                nome: nome.trim(),
                cargo: cargoContato.trim() || null,
                dia,
                mes,
                telefone: telefone.trim() || null,
                cidade: cidade.trim() || null,
                municipio_id: municipioId,
                unidade_id: unidadeId ?? "CG"
            };

            if (paraEditar) {
                const { error } = await supabase
                    .from("aniversariantes")
                    .update(payload)
                    .eq("id", paraEditar.id);

                if (error) throw error;
                addToast("Contato atualizado com sucesso.", "success");
            } else {
                const { error } = await supabase
                    .from("aniversariantes")
                    .insert([payload]);

                if (error) throw error;
                addToast("Contato cadastrado com sucesso.", "success");
            }

            setModalAberto(false);
            setParaEditar(null);
            setNome("");
            setCargoContato("");
            setTelefone("");
            setCidade("");
            await buscarAniversariantes();
        } catch (err: any) {
            console.error("Falha ao salvar:", err);
            addToast(err.message || "Falha ao salvar contato.", "error");
        } finally {
            setSalvando(false);
        }
    };

    const handleExcluir = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja remover este contato?")) return;
        try {
            const { error } = await supabase
                .from("aniversariantes")
                .delete()
                .eq("id", id);

            if (error) throw error;
            addToast("Contato removido com sucesso.", "success");
            await buscarAniversariantes();
        } catch (err: any) {
            console.error("Falha ao excluir:", err);
            addToast(err.message || "Falha ao excluir contato.", "error");
        }
    };

    /* ---- CSV / JSON Parser ---- */
    const processarArquivo = (conteudo: string, extensao: string) => {
        setImportError(null);
        try {
            if (extensao === "json") {
                const dados = JSON.parse(conteudo);
                if (!Array.isArray(dados)) {
                    throw new Error("O arquivo JSON deve conter um array de objetos.");
                }
                const parsed = dados.map((item: any, idx: number) => {
                    if (!item.nome || typeof item.nome !== "string") {
                        throw new Error(`Item na posição ${idx + 1} deve ter um 'nome'.`);
                    }
                    const d = parseInt(item.dia, 10);
                    const m = parseInt(item.mes, 10);
                    if (Number.isNaN(d) || d < 1 || d > 31) {
                        throw new Error(`Item '${item.nome}' possui um 'dia' inválido: ${item.dia}.`);
                    }
                    if (Number.isNaN(m) || m < 1 || m > 12) {
                        throw new Error(`Item '${item.nome}' possui um 'mes' inválido: ${item.mes}.`);
                    }
                    return {
                        nome: item.nome.trim(),
                        cargo: item.cargo ? String(item.cargo).trim() : null,
                        dia: d,
                        mes: m,
                        telefone: item.telefone ? String(item.telefone).trim() : null,
                        cidade: item.cidade ? String(item.cidade).trim() : null
                    };
                });
                setRegistrosPrevisualizados(parsed);
            } else {
                const linhas = conteudo.split("\n").map(l => l.trim()).filter(Boolean);
                if (linhas.length <= 1) {
                    throw new Error("O arquivo CSV está vazio ou possui apenas cabeçalho.");
                }
                const primeiraLinha = linhas[0].toLowerCase();
                const possuiCabecalho = primeiraLinha.includes("nome") || primeiraLinha.includes("dia") || primeiraLinha.includes("mes") || primeiraLinha.includes("mês");
                const linhasDados = possuiCabecalho ? linhas.slice(1) : linhas;

                const parsed = linhasDados.map((linha, idx) => {
                    const colunas = linha.split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ""));
                    if (colunas.length < 3) {
                        throw new Error(`Linha ${idx + (possuiCabecalho ? 2 : 1)} inválida. Esperado pelo menos Nome, Dia e Mês.`);
                    }
                    const n = colunas[0];
                    if (!n) {
                        throw new Error(`Nome não informado na linha ${idx + (possuiCabecalho ? 2 : 1)}.`);
                    }

                    let cargoVal: string | null = null;
                    let diaStr = "";
                    let mesStr = "";
                    let telVal: string | null = null;
                    let cidadeVal: string | null = null;

                    // Formatos suportados:
                    // 3 colunas: Nome, Dia, Mes
                    // 4 colunas: Nome, Cargo, Dia, Mes
                    // 5 colunas: Nome, Cargo, Dia, Mes, Telefone
                    // 6 colunas: Nome, Cargo, Dia, Mes, Telefone, Cidade
                    if (colunas.length === 3) {
                        diaStr = colunas[1];
                        mesStr = colunas[2];
                    } else if (colunas.length === 4) {
                        cargoVal = colunas[1];
                        diaStr = colunas[2];
                        mesStr = colunas[3];
                    } else if (colunas.length === 5) {
                        cargoVal = colunas[1];
                        diaStr = colunas[2];
                        mesStr = colunas[3];
                        telVal = colunas[4];
                    } else {
                        cargoVal = colunas[1];
                        diaStr = colunas[2];
                        mesStr = colunas[3];
                        telVal = colunas[4];
                        cidadeVal = colunas[5];
                    }

                    const d = parseInt(diaStr, 10);
                    const m = parseInt(mesStr, 10);

                    if (Number.isNaN(d) || d < 1 || d > 31) {
                        throw new Error(`Linha ${idx + (possuiCabecalho ? 2 : 1)} possui 'dia' inválido: ${diaStr}.`);
                    }
                    if (Number.isNaN(m) || m < 1 || m > 12) {
                        throw new Error(`Linha ${idx + (possuiCabecalho ? 2 : 1)} possui 'mes' inválido: ${mesStr}.`);
                    }

                    return {
                        nome: n,
                        cargo: cargoVal || null,
                        dia: d,
                        mes: m,
                        telefone: telVal || null,
                        cidade: cidadeVal || null
                    };
                });
                setRegistrosPrevisualizados(parsed);
            }
        } catch (err: any) {
            setImportError(err.message || "Erro ao processar o arquivo.");
            setRegistrosPrevisualizados([]);
        }
    };

    const baixarRelatorioDuplicados = (itens: { nome: string; cargo: string | null; telefone: string | null; cidade: string | null; motivo: string }[]) => {
        const cabecalho = "Nome,Cargo,Telefone,Cidade,Motivo\n";
        const linhas = itens.map(i => {
            const nome = `"${(i.nome || "").replace(/"/g, '""')}"`;
            const cargo = `"${(i.cargo || "").replace(/"/g, '""')}"`;
            const tel = `"${(i.telefone || "").replace(/"/g, '""')}"`;
            const cidade = `"${(i.cidade || "").replace(/"/g, '""')}"`;
            const motivo = `"${(i.motivo || "").replace(/"/g, '""')}"`;
            return `${nome},${cargo},${tel},${cidade},${motivo}`;
        }).join("\n");

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(cabecalho + linhas);
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", `log_contatos_duplicados_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const salvarImportacao = async () => {
        if (registrosPrevisualizados.length === 0) return;
        setSalvandoImportacao(true);
        try {
            // Mapear contatos existentes para detecção de duplicidade (nome case-insensitive + trim)
            const nomesExistentes = new Set(
                aniversariantes.map(a => a.nome.toLowerCase().trim())
            );

            // Fetch MS cities to resolve municipio_id
            const { data: municipiosData, error: municipiosError } = await supabase
                .from("municipios")
                .select("id, nome");

            if (municipiosError) {
                console.error("Erro ao carregar municípios para importação:", municipiosError);
            }

            const normalizarTexto = (str: string) =>
                str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            const aInserir: (typeof registrosPrevisualizados[number] & { municipio_id?: string | null })[] = [];
            const duplicados: { nome: string; cargo: string | null; telefone: string | null; cidade: string | null; motivo: string }[] = [];
            const nomesProcessadosNestaPlanilha = new Set<string>();

            for (const r of registrosPrevisualizados) {
                const nomeChave = r.nome.toLowerCase().trim();
                if (nomesExistentes.has(nomeChave)) {
                    duplicados.push({
                        nome: r.nome,
                        cargo: r.cargo || null,
                        telefone: r.telefone || null,
                        cidade: r.cidade || null,
                        motivo: "Já cadastrado no banco de dados"
                    });
                } else if (nomesProcessadosNestaPlanilha.has(nomeChave)) {
                    duplicados.push({
                        nome: r.nome,
                        cargo: r.cargo || null,
                        telefone: r.telefone || null,
                        cidade: r.cidade || null,
                        motivo: "Duplicado na própria planilha"
                    });
                } else {
                    nomesProcessadosNestaPlanilha.add(nomeChave);
                    
                    let resolvedCity = r.cidade || null;
                    let resolvedMunicipioId = null;
                    if (r.cidade && municipiosData) {
                        const normalCity = normalizarTexto(r.cidade);
                        const match = municipiosData.find(
                            (m) => normalizarTexto(m.nome) === normalCity
                        );
                        if (match) {
                            resolvedCity = match.nome;
                            resolvedMunicipioId = match.id;
                        }
                    }

                    aInserir.push({
                        ...r,
                        cidade: resolvedCity,
                        municipio_id: resolvedMunicipioId
                    });
                }
            }

            if (aInserir.length > 0) {
                const payloadArray = aInserir.map((r) => ({
                    nome: r.nome,
                    cargo: r.cargo || null,
                    dia: r.dia,
                    mes: r.mes,
                    telefone: r.telefone || null,
                    cidade: r.cidade || null,
                    municipio_id: r.municipio_id || null,
                    unidade_id: unidadeId ?? "CG"
                }));

                const { error } = await supabase
                    .from("aniversariantes")
                    .insert(payloadArray);

                if (error) throw error;
            }

            // Exibir mensagens apropriadas e atualizar estado
            if (duplicados.length === 0) {
                addToast(`${aInserir.length} contatos importados com sucesso!`, "success");
                setModalImportacaoAberto(false);
                setRegistrosPrevisualizados([]);
                setImportacaoTexto("");
                setResultadoImportacao(null);
            } else {
                setResultadoImportacao({
                    importados: aInserir.length,
                    duplicados: duplicados.length,
                    itensDuplicados: duplicados
                });
                addToast(
                    `${aInserir.length} contatos importados. ${duplicados.length} duplicados ignorados.`,
                    aInserir.length > 0 ? "success" : "error"
                );
            }
            await buscarAniversariantes();
        } catch (err: any) {
            console.error("Falha ao salvar importação:", err);
            addToast(err.message || "Falha ao salvar importação.", "error");
        } finally {
            setSalvandoImportacao(false);
        }
    };

    if (isLoading || authLoading || !user || !cargo) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
                {/* Page Header */}
                <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm mb-6 p-6 md:p-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-650">
                                    Contatos & Lideranças
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-700">
                                    Módulo Geral
                                </span>
                            </div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                                Agenda de Contatos
                            </h1>
                            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-relaxed font-semibold">
                                Gerencie as informações de contato, cidades, cargos e aniversários de parceiros políticos e lideranças do gabinete.
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setResultadoImportacao(null);
                                    setModalImportacaoAberto(true);
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-98 shadow-sm cursor-pointer"
                            >
                                <Upload className="h-4 w-4" />
                                Importar Planilha
                            </button>
                            <button
                                type="button"
                                onClick={abrirCriar}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 active:scale-98 shadow-sm cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Novo Contato
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por nome, cargo, telefone ou cidade..."
                                value={pesquisa}
                                onChange={(e) => setPesquisa(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                            />
                            <SearchX className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="relative w-full sm:w-44">
                            <select
                                value={filtroCidade}
                                onChange={(e) => setFiltroCidade(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                            >
                                <option value="todas">Todas as cidades</option>
                                {cidadesUnicas.map((cid) => (
                                    <option key={cid} value={cid}>{cid}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="relative w-full sm:w-44">
                            <select
                                value={filtroMes}
                                onChange={(e) => setFiltroMes(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                            >
                                <option value="todos">Todos os meses</option>
                                <option value="1">Janeiro</option>
                                <option value="2">Fevereiro</option>
                                <option value="3">Março</option>
                                <option value="4">Abril</option>
                                <option value="5">Maio</option>
                                <option value="6">Junho</option>
                                <option value="7">Julho</option>
                                <option value="8">Agosto</option>
                                <option value="9">Setembro</option>
                                <option value="10">Outubro</option>
                                <option value="11">Novembro</option>
                                <option value="12">Dezembro</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Birthdays Table Grid */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-650" />
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                                Lista de Contatos & Lideranças
                            </h2>
                        </div>
                        <span className="rounded-full bg-slate-150/70 border border-slate-250 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                            {filtrados.length} contatos
                        </span>
                    </div>

                    <div className="p-0">
                        {carregando ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                            </div>
                        ) : filtrados.length === 0 ? (
                            <div className="rounded-xl px-6 py-16 text-center bg-white">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 shadow-2xs">
                                    <SearchX className="h-5 w-5" />
                                </div>
                                <p className="mt-4 text-sm font-bold text-slate-900">Nenhum contato encontrado</p>
                                <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto">
                                    Tente ajustar os filtros ou adicione uma nova pessoa utilizando o painel.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-slate-700">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <th className="px-6 py-4">Nome</th>
                                            <th className="px-6 py-4">Cargo / Órgão</th>
                                            <th className="px-6 py-4">Cidade</th>
                                            <th className="px-6 py-4">Telefone</th>
                                            <th className="px-6 py-4">Data de Aniversário</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {filtrados.map((a) => {
                                            const nomesMeses = [
                                                "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                                            ];
                                            const dataFormatada = `${a.dia} de ${nomesMeses[a.mes - 1]}`;
                                            const initials = a.nome
                                                ? a.nome.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                                                : "?";

                                            return (
                                                <tr key={a.id} className="hover:bg-slate-50/40 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white uppercase shadow-2xs">
                                                                {initials}
                                                            </div>
                                                            <span className="font-bold text-slate-900">{a.nome}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-semibold">{a.cargo || "Não informado"}</td>
                                                    <td className="px-6 py-4 text-slate-500 font-bold">{a.cidade || <span className="text-slate-300 font-normal italic">Não informada</span>}</td>
                                                    <td className="px-6 py-4 text-slate-600 font-bold flex items-center gap-1.5 py-5">
                                                        {a.telefone ? (
                                                            <>
                                                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                                <span>{a.telefone}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-400 italic font-semibold">Sem telefone</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">{dataFormatada}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirEditar(a)}
                                                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors cursor-pointer"
                                                                title="Editar"
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleExcluir(a.id)}
                                                                className="p-1.5 rounded-lg border border-red-250 bg-white text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal CRUD */}
            {modalAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-slate-900">
                                {paraEditar ? "Editar Contato" : "Cadastrar Contato"}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Insira as informações do parceiro ou liderança pública.
                            </p>
                        </div>

                        <form onSubmit={handleSalvar} className="space-y-4">
                            <div>
                                <label htmlFor="nome" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Nome Completo
                                </label>
                                <input
                                    id="nome"
                                    type="text"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Ex: Deputado Paulo Corrêa"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="cargo" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Cargo / Órgão
                                </label>
                                <input
                                    id="cargo"
                                    type="text"
                                    value={cargoContato}
                                    onChange={(e) => setCargoContato(e.target.value)}
                                    placeholder="Ex: Assembleia Legislativa"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                />
                            </div>

                            <div>
                                <label htmlFor="telefone" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Telefone / Contato
                                </label>
                                <input
                                    id="telefone"
                                    type="text"
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    placeholder="Ex: (11) 99999-9999"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Município
                                </label>
                                <MunicipioAutocomplete
                                    value={municipioId}
                                    onChange={(id, nome) => {
                                        setMunicipioId(id);
                                        setCidade(nome || "");
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="dia" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Dia
                                    </label>
                                    <input
                                        id="dia"
                                        type="number"
                                        value={dia}
                                        onChange={(e) => setDia(parseInt(e.target.value, 10) || 1)}
                                        min="1"
                                        max="31"
                                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="mes" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Mês
                                    </label>
                                    <select
                                        id="mes"
                                        value={mes}
                                        onChange={(e) => setMes(parseInt(e.target.value, 10) || 1)}
                                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50 bg-white"
                                        required
                                    >
                                        <option value="1">Janeiro (1)</option>
                                        <option value="2">Fevereiro (2)</option>
                                        <option value="3">Março (3)</option>
                                        <option value="4">Abril (4)</option>
                                        <option value="5">Maio (5)</option>
                                        <option value="6">Junho (6)</option>
                                        <option value="7">Julho (7)</option>
                                        <option value="8">Agosto (8)</option>
                                        <option value="9">Setembro (9)</option>
                                        <option value="10">Outubro (10)</option>
                                        <option value="11">Novembro (11)</option>
                                        <option value="12">Dezembro (12)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModalAberto(false);
                                        setParaEditar(null);
                                    }}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Importação Planilha */}
            {modalImportacaoAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        {resultadoImportacao ? (
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="mb-4">
                                    <h3 className="text-lg font-black text-slate-900">
                                        Resultado da Importação
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Resumo do processamento do arquivo de contatos.
                                    </p>
                                </div>

                                <div className="space-y-4 flex-1 overflow-y-auto py-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                                            <span className="block text-2xl font-black text-slate-900">
                                                {resultadoImportacao.importados}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Importados
                                            </span>
                                        </div>
                                        <div className={`rounded-2xl border p-4 text-center ${resultadoImportacao.duplicados > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                                            <span className={`block text-2xl font-black ${resultadoImportacao.duplicados > 0 ? "text-amber-700" : "text-slate-900"}`}>
                                                {resultadoImportacao.duplicados}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Duplicados (Ignorados)
                                            </span>
                                        </div>
                                    </div>

                                    {resultadoImportacao.duplicados > 0 && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                                            <div className="flex items-start gap-2.5">
                                                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Contatos Duplicados Ignorados</h4>
                                                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                                        Foram detectados {resultadoImportacao.duplicados} contatos duplicados. Para preservar a integridade da base de dados, esses registros foram ignorados na importação.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => baixarRelatorioDuplicados(resultadoImportacao.itensDuplicados)}
                                                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                                            >
                                                <Download className="h-4 w-4" />
                                                Baixar Relatório de Duplicados (CSV)
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end pt-4 border-t border-slate-100 mt-6 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalImportacaoAberto(false);
                                            setRegistrosPrevisualizados([]);
                                            setImportacaoTexto("");
                                            setResultadoImportacao(null);
                                        }}
                                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="mb-4">
                                    <h3 className="text-lg font-black text-slate-900">
                                        Importação de Planilha (Contatos)
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Cole as linhas formatadas ou carregue um arquivo CSV/JSON.
                                    </p>
                                </div>

                                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Ordem das Colunas Recomendada
                                        </label>
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[10px] text-slate-650 leading-relaxed font-mono">
                                            <p className="font-bold mb-1">CSV (Nome, Cargo, Dia, Mes, Telefone, Cidade):</p>
                                            <p>João da Silva, Prefeito, 15, 8, (11) 98888-7777, Município Exemplo</p>
                                            <p className="font-bold mt-2 mb-1">JSON Array:</p>
                                            <p>[{"{"}"nome": "Maria Souza", "cargo": "Presidente Partidária", "dia": 20, "mes": 9, "telefone": null, "cidade": "Capital Exemplo"{"}"}]</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-3 min-h-[150px] overflow-hidden">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Dados a Importar
                                        </label>
                                        <textarea
                                            value={importacaoTexto}
                                            onChange={(e) => {
                                                setImportacaoTexto(e.target.value);
                                                processarArquivo(e.target.value, "csv");
                                            }}
                                            placeholder="Cole aqui as linhas..."
                                            className="w-full flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50 font-mono resize-none min-h-[80px]"
                                        />

                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ou carregar arquivo:</span>
                                            <input
                                                type="file"
                                                accept=".csv,.json"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (evt) => {
                                                            const text = evt.target?.result as string;
                                                            setImportacaoTexto(text);
                                                            const ext = file.name.split(".").pop()?.toLowerCase() || "csv";
                                                            processarArquivo(text, ext);
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                                className="text-xs text-slate-650 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {importError && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                            <span>{importError}</span>
                                        </div>
                                    )}

                                    {registrosPrevisualizados.length > 0 && (
                                        <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[140px] overflow-y-auto">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                Registros Detectados ({registrosPrevisualizados.length})
                                            </div>
                                            <table className="w-full text-left text-[11px] text-slate-700">
                                                <tbody className="divide-y divide-slate-100 font-medium">
                                                    {registrosPrevisualizados.slice(0, 5).map((r, idx) => (
                                                        <tr key={idx} className="px-3 py-1.5">
                                                            <td className="px-3 py-1.5 font-bold text-slate-900">{r.nome}</td>
                                                            <td className="px-3 py-1.5 text-slate-500">{r.cargo || "Sem cargo"}{r.cidade ? ` (${r.cidade})` : ""}</td>
                                                            <td className="px-3 py-1.5 text-slate-500 font-semibold">{r.telefone || "Sem tel"}</td>
                                                            <td className="px-3 py-1.5 font-bold text-slate-800 text-right">{r.dia}/{r.mes}</td>
                                                        </tr>
                                                    ))}
                                                    {registrosPrevisualizados.length > 5 && (
                                                        <tr>
                                                            <td colSpan={4} className="px-3 py-1.5 text-center text-slate-400 italic">
                                                                ...e mais {registrosPrevisualizados.length - 5} registros
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalImportacaoAberto(false);
                                            setRegistrosPrevisualizados([]);
                                            setImportacaoTexto("");
                                            setResultadoImportacao(null);
                                        }}
                                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={salvarImportacao}
                                        disabled={registrosPrevisualizados.length === 0 || salvandoImportacao}
                                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                    >
                                        {salvandoImportacao && <Loader2 className="h-3 w-3 animate-spin" />}
                                        Salvar Todos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Global toast container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        onClick={() => removeToast(toast.id)}
                        className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer ${
                            toast.type === "success" ? "bg-slate-900" : "bg-red-600"
                        }`}
                    >
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
