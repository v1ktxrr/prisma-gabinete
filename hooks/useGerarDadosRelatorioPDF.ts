import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Definimos a interface estrita que o RelatorioPDF.tsx espera receber
export interface RelatorioAdapterResult {
    colaborador: string;
    periodo: string;
    kpis: {
        views: number;
        likes: number;
        comments: number;
    };
    entregas: Array<{
        titulo: string;
        data: string;
        categoria: string;
        status: string;
        alcance: number;
        curtidas: number;
        comentarios: number;
        urlImagem?: string;
        atividades: string[];
        postUrl?: string;
        tema?: string;
    }>;
}

interface DateRange {
    startDate: string | null;
    endDate: string | null;
}

const GLOBAL_EVENT_TYPES = ["aniversario_cidade", "data_comemorativa"] as const;

export function useGerarDadosRelatorioPDF() {
    const [loadingPdfData, setLoadingPdfData] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    /**
     * Função Orquestradora: Busca pautas, resolve as métricas e cospe o objeto blindado.
     */
    const fetchDadosRelatorio = useCallback(async (
        userId: string,
        dateRange: DateRange
    ): Promise<RelatorioAdapterResult | null> => {
        setLoadingPdfData(true);
        setPdfError(null);

        try {
            // 1. FORMATAR PERÍODO (Cabeçalho do PDF)
            const formatarDataBR = (iso: string) => {
                const [y, m, d] = iso.split('-');
                return `${d}/${m}/${y}`;
            };
            const periodoLabel = (dateRange.startDate && dateRange.endDate)
                ? `${formatarDataBR(dateRange.startDate)} a ${formatarDataBR(dateRange.endDate)}`
                : 'Todo o Período';

            // 2. BUSCAR ATIVIDADES DO USUÁRIO LOGADO
            const { data: assignments, error: assignErr } = await supabase
                .from('task_assignments')
                .select('task_id, activity_type')
                .eq('user_id', userId);

            if (assignErr) throw assignErr;

            // Mapa de atividades por task_id para lookup rápido
            const atividadesPorTask = new Map<string, string[]>();
            for (const a of assignments || []) {
                const existing = atividadesPorTask.get(a.task_id) || [];
                if (!existing.includes(a.activity_type)) {
                    existing.push(a.activity_type);
                }
                atividadesPorTask.set(a.task_id, existing);
            }

            // 3. BUSCAR ENTREGAS REAIS: usuário logado + exceções globais
            let query = supabase
                .from('tasks')
                .select('id, titulo, descricao, status, event_type, data_inicio, data_fim, post_url, metrics_snapshot, tema, created_by')
                .eq('status', 'publicado')
                .or(`created_by.eq.${userId},event_type.in.(${GLOBAL_EVENT_TYPES.join(",")})`)
                .order('data_inicio', { ascending: false })
                .limit(5000);

            // Injeção do Filtro de Data (DateRange do Datepicker)
            if (dateRange.startDate && dateRange.endDate) {
                query = query
                    .gte('data_inicio', `${dateRange.startDate} 00:00:00`)
                    .lte('data_inicio', `${dateRange.endDate} 23:59:59`);
            }

            const { data: pautas, error: pautasErr } = await query;
            if (pautasErr) throw pautasErr;

            // 4. PREPARAÇÃO DOS AGREGADORES (Métricas Hero Section)
            let totalViews = 0;
            let totalLikes = 0;
            let totalComments = 0;

            // Deduplicação: Previne a soma excessiva de views se dois cards apontarem pro mesmo Reels
            const postUrlsVistos = new Set<string>();
            
            // Helper para limpar URL
            const getCleanedUrl = (url: string | null) => {
                if (!url) return null;
                const match = url.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
                return match ? match[1] : url.split('?')[0];
            };

            // 5. MERGA E TRANSFORMAÇÃO DE DADOS (The Reducer)
            const entregasFormatadas = (pautas || []).map((pauta) => {

                // As métricas da Meta/GA4 são consolidadas e salvas assincronamente no DB (metrics_snapshot).
                const metrics = pauta.metrics_snapshot || {};

                // Extraindo dados com prioridade na integridade (Views puro de vídeo, não alcance genérico)
                const alcance = metrics.views || 0; 
                const curtidas = metrics.likes || 0;
                const comentarios = metrics.comments || 0;

                // TRATAMENTO EXCEPCIONAL (Empty State)
                // Se a postagem possui URL no banco, mas todas as métricas estão zeradas,
                // significa que a Meta API ainda não atualizou a Edge Function ou o link é inválido.
                const hasUrl = !!pauta.post_url;
                const isAguardandoDados = hasUrl && (alcance === 0 && curtidas === 0);

                // Agregação Lógica (Soma KPIs evitando duplicatas de URL)
                const currentUrl = pauta.post_url;
                const cleanedUrl = getCleanedUrl(currentUrl);
                
                if (!cleanedUrl || !postUrlsVistos.has(cleanedUrl)) {
                    if (cleanedUrl) postUrlsVistos.add(cleanedUrl);
                    totalViews += alcance;
                    totalLikes += curtidas;
                    totalComments += comentarios;
                }

                // Formatação visual da Data (ex: 28/02/2026)
                let dataExibicao = 'Sem data';
                if (pauta.data_inicio) {
                    const dt = new Date(pauta.data_inicio);
                    dataExibicao = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
                }

                // Mapeamento Humanizado de Categorias
                let categoriaLabel = "Diversos";
                if (pauta.event_type === 'agenda_oficial') categoriaLabel = "Agenda Oficial";
                if (pauta.event_type === 'aniversario_cidade') categoriaLabel = "Aniversário da Cidade";
                if (pauta.event_type === 'data_comemorativa') categoriaLabel = "Data Comemorativa";

                // Buscar atividades realizadas nesta tarefa pelo colaborador
                const atividadesRaw = atividadesPorTask.get(pauta.id) || [];
                const ACTIVITY_LABELS: Record<string, string> = {
                    captacao: 'Captação',
                    edicao: 'Edição',
                    texto: 'Texto',
                    publicacao: 'Publicação',
                };
                const atividades = atividadesRaw.map(a => ACTIVITY_LABELS[a] || a);

                return {
                    titulo: pauta.titulo,
                    data: dataExibicao,
                    categoria: categoriaLabel,
                    status: isAguardandoDados ? "AGUARDANDO DADOS" : "PROCESSADO",
                    alcance: alcance,
                    curtidas: curtidas,
                    comentarios: comentarios,
                    urlImagem: metrics.local_thumbnail_url || undefined,
                    atividades: atividades,
                    postUrl: pauta.post_url || undefined,
                    tema: pauta.tema || undefined,
                };
            });

            // 6. RETORNO ESTRITO DA INTERFACE A4
            return {
                colaborador: "Meu Relatório",
                periodo: periodoLabel,
                kpis: {
                    views: totalViews,
                    likes: totalLikes,
                    comments: totalComments
                },
                entregas: entregasFormatadas
            };

        } catch (err) {
            console.error("Erro massivo ao gerar adaptador PDF:", err);
            setPdfError("Não foi possível acoplar a base de dados com a interface do documento.");
            return null;
        } finally {
            setLoadingPdfData(false);
        }
    }, []);

    return { fetchDadosRelatorio, loadingPdfData, pdfError };
}
