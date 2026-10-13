import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    Image,
    Link,
    StyleSheet
} from '@react-pdf/renderer';
import { TIMBRADO_BASE64 } from './timbrado-base64';

// Interface das métricas
interface TaskMetrics {
    likes?: number;
    comments?: number;
    views?: number;
    reach?: number;
    saves?: number;
    shares?: number;
    local_thumbnail_url?: string | null;
}

// Interface dos itens de tarefas/publicações
export interface TaskRowPDF {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    data_publicacao: string | null;
    data_inicio: string | null;
    created_at: string;
    post_url: string | null;
    link_final: string | null;
    metrics_snapshot: TaskMetrics | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
    profiles?: {
        nome: string;
    } | null;
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
}

export interface RelatorioComunicacaoPDFProps {
    tasks: TaskRowPDF[];
    periodo: string;
    colaborador: string;
    unidade: string;
    totalKpis: {
        views: number;
        likes: number;
        comments: number;
    };
    teamProfiles: Record<string, string>;
}

// Helpers para formatação de rótulos
function formatEixoLabel(val?: string | null) {
    if (!val) return "Geral";
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
    if (!val) return "Outros";
    const mapping: Record<string, string> = {
        video: "Vídeo",
        card: "Card",
        cobertura: "Cobertura",
        foto: "Foto",
        texto: "Texto",
    };
    return mapping[val.toLowerCase()] || val;
}

function formatarData(iso: string | null) {
    if (!iso) return "";
    try {
        const datePart = iso.split("T")[0];
        const [anoStr, mesStr, diaStr] = datePart.split("-");
        const dia = parseInt(diaStr, 10);
        const mes = parseInt(mesStr, 10) - 1;
        const ano = parseInt(anoStr, 10);
        
        const meses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        
        const diaFormatado = String(dia).padStart(2, '0');
        const mesExtenso = meses[mes];
        
        return `${diaFormatado} de ${mesExtenso} de ${ano}`;
    } catch {
        return "";
    }
}

function formatNumber(num: number) {
    if (num === undefined || num === null) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return num.toString();
}

function getMesCompetencia(periodo: string) {
    if (!periodo) return "";
    const match = periodo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
        const mes = parseInt(match[2], 10) - 1;
        const ano = parseInt(match[3], 10);
        const meses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        return `${meses[mes]}/${ano}`;
    }
    return periodo;
}

function sanitizeUrl(url: string | null | undefined): string {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.toLowerCase().startsWith("www.")) {
        return `https://${trimmed}`;
    }
    return `https://${trimmed}`;
}

// Estilos limpos e executivos
const styles = StyleSheet.create({
    page: {
        paddingTop: 110,
        paddingBottom: 60,
        paddingHorizontal: 40,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
        fontSize: 9,
        color: '#1e293b',
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 595.28,
        height: 841.89,
        zIndex: -1,
    },
    footerContainer: {
        position: 'absolute',
        bottom: 25,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 7,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pageNumber: {
        fontSize: 7,
        color: '#94a3b8',
    },
    // Novo cabeçalho minimalista
    reportHeader: {
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    reportTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    reportSubtitle: {
        fontSize: 8.5,
        color: '#64748b',
        marginTop: 3,
    },
    // KPIs Dashboard
    kpisRow: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    kpiCard: {
        width: '23.5%',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 3,
        borderLeftColor: '#6d28d9', // Destaque lateral violeta do Prisma
        borderRadius: 4,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
    },
    kpiLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    kpiValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingBottom: 3,
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
    },
    // Lista de Postagens por Faixas (Stripes)
    listContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    stripeRow: {
        display: 'flex',
        flexDirection: 'row',
        padding: '10 8',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'flex-start',
    },
    rowEven: {
        backgroundColor: '#ffffff',
    },
    rowOdd: {
        backgroundColor: '#f8fafc',
    },
    // Colunas do novo layout
    colLeft: {
        width: '15%',
        display: 'flex',
        alignItems: 'flex-start',
    },
    colCenter: {
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
        paddingRight: 12,
    },
    colRight: {
        width: '35%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    // Bounding Box
    thumbnailContainer: {
        width: 48,
        height: 64,
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    thumbnailPlaceholder: {
        fontSize: 6,
        color: '#94a3b8',
        fontWeight: 'bold',
    },
    // Coluna Central (Textos)
    postTitleLink: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#1e3a8a', // Azul escuro executivo/governamental
        textDecoration: 'underline',
        lineHeight: 1.2,
    },
    postTitleText: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#0f172a',
        lineHeight: 1.2,
    },
    postDate: {
        fontSize: 7,
        color: '#94a3b8',
        marginTop: 2,
        fontWeight: 'medium',
    },
    postDesc: {
        fontSize: 7.5,
        color: '#475569',
        marginTop: 4,
        lineHeight: 1.3,
    },
    // Linha de Autoria Múltipla
    authorPillsRow: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
    },
    authorPill: {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 3,
        paddingHorizontal: 4,
        paddingVertical: 1,
        marginRight: 4,
        marginBottom: 3,
    },
    authorPillText: {
        fontSize: 6,
        color: '#475569',
        fontWeight: 'bold',
    },
    // Coluna Direita (Classificação e Métricas)
    badgeEixo: {
        backgroundColor: '#f5f3ff',
        borderColor: '#ddd6fe',
        borderWidth: 1,
        color: '#6d28d9',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        fontSize: 6.5,
        fontWeight: 'bold',
        marginBottom: 3,
        alignSelf: 'flex-end',
    },
    badgeFormato: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        color: '#475569',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        fontSize: 6.5,
        fontWeight: 'bold',
        marginBottom: 8,
        alignSelf: 'flex-end',
    },
    // Métricas Compactas
    metricsStack: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    metricRow: {
        fontSize: 7,
        color: '#64748b',
        marginBottom: 1.5,
    },
    metricBold: {
        fontWeight: 'bold',
        color: '#0f172a',
    }
});

// Componente do PDF principal refatorado
export default function RelatorioComunicacaoPDF({
    tasks,
    periodo,
    colaborador,
    unidade,
    totalKpis,
    teamProfiles
}: RelatorioComunicacaoPDFProps) {
    const dataGerado = new Date().toLocaleDateString("pt-BR");
    const mesCompetencia = getMesCompetencia(periodo);

    // Helper defensivo para obter a URL completa de imagens locais/Supabase no cliente
    const getFullUrl = (url: string | null | undefined) => {
        if (!url) return undefined;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        if (typeof window !== 'undefined') {
            return `${window.location.origin}${url}`;
        }
        return url;
    };

    // Renderizador das pílulas de autoria
    const renderAutores = (row: TaskRowPDF) => {
        const autores = [];
        
        if (row.captacao_by && teamProfiles[row.captacao_by]) {
            autores.push(`Captação: ${teamProfiles[row.captacao_by].split(" ")[0]}`);
        }
        if (row.edicao_by && teamProfiles[row.edicao_by]) {
            autores.push(`Edição: ${teamProfiles[row.edicao_by].split(" ")[0]}`);
        }
        if (row.texto_by && teamProfiles[row.texto_by]) {
            autores.push(`Texto: ${teamProfiles[row.texto_by].split(" ")[0]}`);
        }
        if (row.publicacao_by && teamProfiles[row.publicacao_by]) {
            autores.push(`Publicação: ${teamProfiles[row.publicacao_by].split(" ")[0]}`);
        }

        if (autores.length === 0) return null;

        return (
            <View style={styles.authorPillsRow}>
                {autores.map((txt, index) => (
                    <View key={index} style={styles.authorPill}>
                        <Text style={styles.authorPillText}>{txt}</Text>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <Document title={`Relatório_Comunicação_${dataGerado.replace(/\//g, '-')}`}>
            <Page size="A4" style={styles.page}>
                {/* 1. Imagem de Papel Timbrado Oficial em Background Absoluto */}
                <Image
                    src={TIMBRADO_BASE64}
                    style={styles.backgroundImage}
                    fixed
                />

                {/* 2. Rodapé Institucional Repetido em Todas as Páginas */}
                <View style={styles.footerContainer} fixed>
                    <Text style={styles.footerText}>Prisma Gabinete Virtual — Módulo de Mídia</Text>
                    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
                        `PÁGINA ${pageNumber} DE ${totalPages}`
                    )} />
                </View>

                {/* 3. Cabeçalho Minimalista e Direto */}
                <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Relatório de Comunicação</Text>
                    <Text style={styles.reportSubtitle}>
                        Mês de Competência: {mesCompetencia}  |  Assessor: {colaborador}
                    </Text>
                </View>

                {/* 4. Resumo Executivo (KPIs Consolidados) */}
                <View style={styles.kpisRow}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Atividades</Text>
                        <Text style={styles.kpiValue}>{tasks.length}</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Visualizações</Text>
                        <Text style={styles.kpiValue}>{formatNumber(totalKpis.views)}</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Reações / Likes</Text>
                        <Text style={styles.kpiValue}>{formatNumber(totalKpis.likes)}</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>Comentários</Text>
                        <Text style={styles.kpiValue}>{formatNumber(totalKpis.comments)}</Text>
                    </View>
                </View>

                {/* 5. Lista de Entregas Oficiais em Stripes */}
                <Text style={styles.sectionTitle}>Atividades de Comunicação</Text>
                
                <View style={styles.listContainer}>
                    {tasks.map((row, idx) => {
                        const urlThumb = row.metrics_snapshot?.local_thumbnail_url;
                        const hasThumb = !!urlThumb;
                        const views = row.metrics_snapshot?.views || 0;
                        const likes = row.metrics_snapshot?.likes || 0;
                        const comments = row.metrics_snapshot?.comments || 0;
                        
                        const url = row.post_url || row.link_final;
                        const sanitizedUrl = sanitizeUrl(url);
                        const isEven = idx % 2 === 0;

                        return (
                            <View 
                                key={row.id} 
                                style={[styles.stripeRow, isEven ? styles.rowEven : styles.rowOdd]} 
                                wrap={false}
                            >
                                {/* ESQUERDA (15%): Thumbnail na Bounding Box (48x64px) */}
                                <View style={styles.colLeft}>
                                    {sanitizedUrl ? (
                                        <Link src={sanitizedUrl}>
                                            <View style={styles.thumbnailContainer}>
                                                {hasThumb ? (
                                                    <Image
                                                        src={getFullUrl(urlThumb)}
                                                        style={styles.thumbnail}
                                                    />
                                                ) : (
                                                    <Text style={styles.thumbnailPlaceholder}>MÍDIA</Text>
                                                )}
                                            </View>
                                        </Link>
                                    ) : (
                                        <View style={styles.thumbnailContainer}>
                                            {hasThumb ? (
                                                <Image
                                                    src={getFullUrl(urlThumb)}
                                                    style={styles.thumbnail}
                                                />
                                            ) : (
                                                <Text style={styles.thumbnailPlaceholder}>MÍDIA</Text>
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* CENTRO (50%): Título (link), Data e Autoria Múltipla */}
                                <View style={styles.colCenter}>
                                    {sanitizedUrl ? (
                                        <Link src={sanitizedUrl} style={styles.postTitleLink}>
                                            {row.titulo}
                                        </Link>
                                    ) : (
                                        <Text style={styles.postTitleText}>{row.titulo}</Text>
                                    )}
                                    
                                    <Text style={styles.postDate}>
                                        {formatarData(row.data_inicio || row.data_publicacao || row.created_at)}
                                    </Text>
                                    
                                    {row.descricao && (
                                        <Text style={styles.postDesc} {...({ numberOfLines: 2 } as any)}>
                                            {row.descricao}
                                        </Text>
                                    )}

                                    {/* Pílulas de Autoria Múltipla */}
                                    {renderAutores(row)}
                                </View>

                                {/* DIREITA (35%): Classificação e Métricas */}
                                <View style={styles.colRight}>
                                    <Text style={styles.badgeEixo}>
                                        {formatEixoLabel(row.eixo_tematico)}
                                    </Text>
                                    <Text style={styles.badgeFormato}>
                                        {formatFormatoLabel(row.formato_midia)}
                                    </Text>
                                    
                                    {/* Métricas Compactas */}
                                    <View style={styles.metricsStack}>
                                        <Text style={styles.metricRow}>
                                            Visualizações: <Text style={styles.metricBold}>{formatNumber(views)}</Text>
                                        </Text>
                                        <Text style={styles.metricRow}>
                                            Curtidas: <Text style={styles.metricBold}>{formatNumber(likes)}</Text>
                                        </Text>
                                        <Text style={styles.metricRow}>
                                            Comentários: <Text style={styles.metricBold}>{formatNumber(comments)}</Text>
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </Page>
        </Document>
    );
}
