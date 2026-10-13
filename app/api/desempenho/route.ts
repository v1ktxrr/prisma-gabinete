export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

interface PerfilDesempenho {
    cargo: string | null;
    unidade_id: string | null;
    modulos_acesso: unknown;
}

function normalizarModulos(modulos: unknown): string[] {
    return Array.isArray(modulos)
        ? modulos.filter((modulo): modulo is string => typeof modulo === "string")
        : [];
}

function temAcessoDesempenho(perfil: PerfilDesempenho): boolean {
    if (perfil.cargo === "chefia" || perfil.cargo === "secretaria" || perfil.cargo === "comunicacao") {
        return true;
    }
    const modulos = normalizarModulos(perfil.modulos_acesso);
    return modulos.includes("visao_geral_auditoria");
}

async function createClients() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error("Configuração do Supabase incompleta.");
    }

    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Ignora erro em contexto GET
                }
            },
        },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return { supabaseAuth, supabaseAdmin };
}

export async function GET(request: Request) {
    let supabaseAuth;
    let supabaseAdmin;

    try {
        ({ supabaseAuth, supabaseAdmin } = await createClients());
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Falha na configuração do servidor." },
            { status: 500 }
        );
    }

    try {
        const {
            data: { session },
            error: authError,
        } = await supabaseAuth.auth.getSession();

        const user = session?.user ?? null;

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        // Obter perfil do usuário
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("cargo, unidade_id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !perfil.unidade_id) {
            return NextResponse.json({ error: "Perfil não encontrado ou sem unidade configurada." }, { status: 403 });
        }

        if (!temAcessoDesempenho(perfil)) {
            return NextResponse.json({ error: "Acesso negado ao módulo de relatórios de desempenho." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const filterPeriod = searchParams.get("periodo") || "este_ano";
        const startDateParam = searchParams.get("startDate");
        const endDateParam = searchParams.get("endDate");

        const now = new Date();
        let start: Date;
        let end: Date;

        if (filterPeriod === "este_mes") {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            end = now;
        } else if (filterPeriod === "mes_passado") {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        } else if (filterPeriod === "este_ano") {
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            end = now;
        } else if (filterPeriod === "ultimo_ano") {
            start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
            end = now;
        } else {
            // personalizado
            if (startDateParam) {
                const [sYear, sMonth, sDay] = startDateParam.split("-").map(Number);
                start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
            } else {
                start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            }

            if (endDateParam) {
                const [eYear, eMonth, eDay] = endDateParam.split("-").map(Number);
                end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
            } else {
                end = now;
            }
        }

        const dataInicioStr = start.toISOString();
        const dataFimStr = end.toISOString();

        // Buscar dados necessários de forma paralela
        const [
            { data: municipios, error: munError },
            { data: tasksGlobal, error: tgError },
            { data: tasksComms, error: tcError },
            { data: relatoriosAgenda, error: raError },
            { data: atendimentos, error: atError },
            { data: demandas, error: deError }
        ] = await Promise.all([
            supabaseAdmin
                .from("municipios")
                .select("id, nome, codigo_ibge"),
            supabaseAdmin
                .from("tasks")
                .select("id, data_inicio, municipio_id, eixo_tematico")
                .eq("tipo_agenda", "GLOBAL")
                .eq("status", "publicado")
                .eq("unidade_id", perfil.unidade_id)
                .gte("data_inicio", dataInicioStr)
                .lte("data_inicio", dataFimStr),
            supabaseAdmin
                .from("tasks")
                .select("id, data_inicio, eixo_tematico, formato_midia")
                .eq("tipo_agenda", "COMUNICACAO")
                .eq("status", "publicado")
                .eq("unidade_id", perfil.unidade_id)
                .gte("data_inicio", dataInicioStr)
                .lte("data_inicio", dataFimStr),
            supabaseAdmin
                .from("relatorios_agenda")
                .select(`
                    id, data_evento, categoria, valor_gasto,
                    perfis_usuarios!inner(unidade_id)
                `)
                .eq("perfis_usuarios.unidade_id", perfil.unidade_id)
                .gte("data_evento", dataInicioStr.split("T")[0])
                .lte("data_evento", dataFimStr.split("T")[0]),
            supabaseAdmin
                .from("atendimentos")
                .select("id, status, data, titulo")
                .eq("unidade_id", perfil.unidade_id)
                .gte("data", dataInicioStr.split("T")[0])
                .lte("data", dataFimStr.split("T")[0]),
            supabaseAdmin
                .from("demandas")
                .select("id, status, solicitante, municipio_id, descricao, criado_em")
                .eq("unidade_id", perfil.unidade_id)
                .gte("criado_em", dataInicioStr)
                .lte("criado_em", dataFimStr)
        ]);

        if (munError || tgError || tcError || raError || atError || deError) {
            console.error("Erro nas consultas de relatórios:", { munError, tgError, tcError, raError, atError, deError });
            return NextResponse.json({ 
                error: "Erro ao consultar dados no banco de dados.",
                details: {
                    mun: munError?.message,
                    tg: tgError?.message,
                    tc: tcError?.message,
                    ra: raError?.message,
                    at: atError?.message,
                    de: deError?.message
                }
            }, { status: 500 });
        }

        // Criar dicionário de municípios por ID para mapeamento rápido
        const muniMap: Record<string, { nome: string; codigo_ibge: string }> = {};
        municipios?.forEach(m => {
            muniMap[m.id] = { nome: m.nome, codigo_ibge: m.codigo_ibge };
        });

        // 1. Agendas / Visitas (GLOBAL)
        const totalAgendas = tasksGlobal?.length || 0;
        let capitalCount = 0;
        let interiorCount = 0;
        const cidadesVisitasCount: Record<string, number> = {};

        tasksGlobal?.forEach(t => {
            if (t.municipio_id && muniMap[t.municipio_id]) {
                const muni = muniMap[t.municipio_id];
                if (muni.codigo_ibge === "5002704") {
                    capitalCount++;
                } else {
                    interiorCount++;
                }
                cidadesVisitasCount[muni.nome] = (cidadesVisitasCount[muni.nome] || 0) + 1;
            } else {
                interiorCount++; // Sem cidade definida ou fora do MS vai pro interior por fallback
            }
        });

        const topCidades = Object.entries(cidadesVisitasCount)
            .map(([nome, visitas]) => ({ nome, visitas }))
            .sort((a, b) => b.visitas - a.visitas)
            .slice(0, 5);

        // 2. Comunicação
        const totalPosts = tasksComms?.length || 0;
        const postsPorEixo: Record<string, number> = {};
        const postsPorFormato: Record<string, number> = {};

        tasksComms?.forEach(t => {
            const eixo = t.eixo_tematico || "Sem Eixo";
            postsPorEixo[eixo] = (postsPorEixo[eixo] || 0) + 1;

            const formato = t.formato_midia || "Outros";
            postsPorFormato[formato] = (postsPorFormato[formato] || 0) + 1;
        });

        // 3. Eixos temáticos consolidados (GLOBAL + COMUNICACAO)
        const eixosConsolidados: Record<string, number> = {};
        tasksGlobal?.forEach(t => {
            const eixo = t.eixo_tematico || "Sem Eixo";
            eixosConsolidados[eixo] = (eixosConsolidados[eixo] || 0) + 1;
        });
        tasksComms?.forEach(t => {
            const eixo = t.eixo_tematico || "Sem Eixo";
            eixosConsolidados[eixo] = (eixosConsolidados[eixo] || 0) + 1;
        });

        // 4. Finanças (Valor Gasto)
        let totalFinanceiro = 0;
        const financeiroPorCategoria: Record<string, number> = {};

        relatoriosAgenda?.forEach(r => {
            const valor = Number(r.valor_gasto || 0);
            totalFinanceiro += valor;
            const cat = r.categoria || "Geral";
            financeiroPorCategoria[cat] = (financeiroPorCategoria[cat] || 0) + valor;
        });

        // 5. Atendimentos
        const totalAtendimentos = atendimentos?.length || 0;
        const atendimentosPorStatus: Record<string, number> = {
            aberto: 0,
            em_andamento: 0,
            concluido: 0,
            arquivado: 0
        };
        atendimentos?.forEach(a => {
            if (a.status && a.status in atendimentosPorStatus) {
                atendimentosPorStatus[a.status]++;
            }
        });

        // 6. Demandas / Promessas
        const totalDemandas = demandas?.length || 0;
        const demandasPorStatus: Record<string, number> = {
            em_andamento: 0,
            entregue: 0,
            negado: 0
        };
        demandas?.forEach(d => {
            if (d.status && d.status in demandasPorStatus) {
                demandasPorStatus[d.status]++;
            }
        });

        const totalResolvidos = demandasPorStatus.entregue;
        const taxaResolucao = totalDemandas > 0 ? Math.round((totalResolvidos / totalDemandas) * 100) : 0;

        // Listar 5 demandas recentes para incluir no relatório
        const demandasRecentes = demandas
            ?.map(d => ({
                id: d.id,
                solicitante: d.solicitante,
                descricao: d.descricao,
                status: d.status,
                cidade: d.municipio_id && muniMap[d.municipio_id] ? muniMap[d.municipio_id].nome : "Não cadastrado",
                criado_em: d.criado_em
            }))
            .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
            .slice(0, 5) || [];

        // Montar resposta do dashboard de relatórios
        const responseData = {
            periodo: filterPeriod,
            startDate: dataInicioStr,
            endDate: dataFimStr,
            unidadeId: perfil.unidade_id,
            metrics: {
                agendas: {
                    total: totalAgendas,
                    capitalCount,
                    interiorCount,
                    capitalPercentage: totalAgendas > 0 ? Math.round((capitalCount / totalAgendas) * 100) : 0,
                    interiorPercentage: totalAgendas > 0 ? Math.round((interiorCount / totalAgendas) * 100) : 0,
                    topCidades
                },
                comunicacao: {
                    total: totalPosts,
                    porEixo: Object.entries(postsPorEixo).map(([label, count]) => ({ label, count })),
                    porFormato: Object.entries(postsPorFormato).map(([label, count]) => ({ label, count }))
                },
                eixosConsolidados: Object.entries(eixosConsolidados)
                    .map(([label, count]) => ({ label, count }))
                    .sort((a, b) => b.count - a.count),
                financeiro: {
                    totalGasto: totalFinanceiro,
                    porCategoria: Object.entries(financeiroPorCategoria).map(([label, value]) => ({ label, value }))
                },
                atendimentos: {
                    total: totalAtendimentos,
                    porStatus: Object.entries(atendimentosPorStatus).map(([label, count]) => ({ label, count }))
                },
                demandas: {
                    total: totalDemandas,
                    porStatus: Object.entries(demandasPorStatus).map(([label, count]) => ({ label, count })),
                    taxaResolucao,
                    recentes: demandasRecentes
                }
            }
        };

        return NextResponse.json(responseData, { status: 200 });

    } catch (e: any) {
        console.error("[Desempenho GET] Crash Fatal:", e);
        return NextResponse.json({ error: "Erro interno no servidor ao consolidar relatórios.", details: e.message || String(e) }, { status: 500 });
    }
}
