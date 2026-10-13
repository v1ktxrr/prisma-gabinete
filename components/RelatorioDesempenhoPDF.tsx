import React from 'react';
import {
    Document,
    Page,
    View,
    Text,
    Image,
    StyleSheet
} from '@react-pdf/renderer';
import { TIMBRADO_BASE64 } from './timbrado-base64';

interface DemandItem {
    id: string;
    solicitante: string;
    descricao: string;
    status: string;
    cidade: string;
}

interface RelatorioDesempenhoPDFProps {
    dados: {
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
    };
    unidadeNome: string;
    usuarioGerador: string;
}

function formatarData(iso: string) {
    if (!iso) return "";
    try {
        const datePart = iso.split("T")[0];
        const [ano, mes, dia] = datePart.split("-");
        return `${dia}/${mes}/${ano}`;
    } catch {
        return "";
    }
}

function formatarMoeda(valor: number) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function getPeriodoExtenso(periodo: string, start: string, end: string) {
    const s = formatarData(start);
    const e = formatarData(end);

    if (periodo === "este_mes") return `Mês Corrente (${s} a ${e})`;
    if (periodo === "mes_passado") return `Mês Anterior (${s} a ${e})`;
    if (periodo === "este_ano") return `Ano Vigente (${s} a ${e})`;
    if (periodo === "ultimo_ano") return `Últimos 12 Meses (${s} a ${e})`;
    return `Período Personalizado (${s} a ${e})`;
}

const styles = StyleSheet.create({
    page: {
        paddingTop: 110,
        paddingBottom: 60,
        paddingHorizontal: 45,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
        fontSize: 9,
        color: '#334155',
    },
    backgroundImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 595.28,
        height: 841.89,
        zIndex: -1,
    },
    // Timbre
    timbradoContainer: {
        borderBottomWidth: 2,
        borderBottomColor: '#1e3a8a',
        paddingBottom: 10,
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    timbradoLeft: {
        display: 'flex',
        flexDirection: 'column',
    },
    timbradoSystem: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e3a8a',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    timbradoDocType: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginTop: 2,
        letterSpacing: -0.5,
    },
    timbradoRight: {
        textAlign: 'right',
        fontSize: 8,
        color: '#64748b',
    },
    // Footer
    footerContainer: {
        position: 'absolute',
        bottom: 25,
        left: 45,
        right: 45,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 7,
        color: '#94a3b8',
    },
    footerText: {
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pageNumber: {
        fontSize: 7,
        color: '#94a3b8',
    },
    // Seções
    section: {
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e3a8a',
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 4,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Grid de Cards
    grid: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -5,
        marginBottom: 10,
    },
    card: {
        width: '33.33%',
        paddingHorizontal: 5,
        marginBottom: 10,
    },
    cardInner: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        padding: 10,
        backgroundColor: '#f8fafc',
    },
    cardLabel: {
        fontSize: 7,
        color: '#64748b',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    cardSubtext: {
        fontSize: 7.5,
        color: '#475569',
        marginTop: 3,
    },
    // Duas colunas
    row: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: -10,
    },
    col6: {
        width: '50%',
        paddingHorizontal: 10,
    },
    // Barras de Progresso
    progressContainer: {
        marginBottom: 8,
    },
    progressHeader: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontSize: 8.5,
        marginBottom: 3,
    },
    progressBarOuter: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarInnerBlue: {
        height: '100%',
        backgroundColor: '#2563eb',
        borderRadius: 3,
    },
    progressBarInnerGreen: {
        height: '100%',
        backgroundColor: '#10b981',
        borderRadius: 3,
    },
    // Tabelas
    table: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
    },
    tableHeader: {
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        padding: 6,
        fontWeight: 'bold',
    },
    tableRow: {
        display: 'flex',
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        padding: 6,
    },
    tableCell: {
        flex: 1,
    },
    tableCellBold: {
        flex: 1,
        fontWeight: 'bold',
    },
    tableCellRight: {
        textAlign: 'right',
    },
    badge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        fontSize: 7,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    badgeOrange: {
        backgroundColor: '#ffedd5',
        color: '#c2410c',
    },
    badgeGreen: {
        backgroundColor: '#d1fae5',
        color: '#065f46',
    },
    badgeRed: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
    },
});

export default function RelatorioDesempenhoPDF({ dados, unidadeNome, usuarioGerador }: RelatorioDesempenhoPDFProps) {
    const { metrics } = dados;

    return (
        <Document>
            {/* Página 1: Panorama e Indicadores Geográficos */}
            <Page size="A4" style={styles.page}>
                <Image
                    src={TIMBRADO_BASE64}
                    style={styles.backgroundImage}
                    fixed
                />
                {/* Timbre / Cabeçalho */}
                <View style={styles.timbradoContainer}>
                    <View style={styles.timbradoLeft}>
                        <Text style={styles.timbradoSystem}>Prisma — Gabinete Virtual</Text>
                        <Text style={styles.timbradoDocType}>Dossiê de Desempenho Operacional</Text>
                    </View>
                    <View style={styles.timbradoRight}>
                        <Text>Unidade: {unidadeNome}</Text>
                        <Text>Competência: {getPeriodoExtenso(dados.periodo, dados.startDate, dados.endDate)}</Text>
                    </View>
                </View>

                {/* Seção 1: Indicadores Macro */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Panorama Macro Operacional</Text>
                    <View style={styles.grid}>
                        {/* Card 1: Agendas */}
                        <View style={styles.card}>
                            <View style={styles.cardInner}>
                                <Text style={styles.cardLabel}>Agendas Oficializadas</Text>
                                <Text style={styles.cardValue}>{metrics.agendas.total}</Text>
                                <Text style={styles.cardSubtext}>
                                    {metrics.agendas.capitalPercentage}% Capital | {metrics.agendas.interiorPercentage}% Interior
                                </Text>
                            </View>
                        </View>

                        {/* Card 2: CRM & Demandas */}
                        <View style={styles.card}>
                            <View style={styles.cardInner}>
                                <Text style={styles.cardLabel}>Demandas de Gabinete</Text>
                                <Text style={styles.cardValue}>{metrics.demandas.total}</Text>
                                <Text style={styles.cardSubtext}>
                                    Taxa de entrega: {metrics.demandas.taxaResolucao}%
                                </Text>
                            </View>
                        </View>

                        {/* Card 3: Financeiro */}
                        <View style={styles.card}>
                            <View style={styles.cardInner}>
                                <Text style={styles.cardLabel}>Despesas Consolidadas</Text>
                                <Text style={styles.cardValue}>{formatarMoeda(metrics.financeiro.totalGasto)}</Text>
                                <Text style={styles.cardSubtext}>
                                    Custeio de atividades operacionais
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Seção 2: Divisão Geográfica e Visitas */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Distribuição Geopolítica de Agendas</Text>
                    <View style={styles.row}>
                        {/* Subcoluna 1: Cobertura */}
                        <View style={styles.col6}>
                            <Text style={{ fontSize: 9.5, fontWeight: 'bold', marginBottom: 8, color: '#0f172a' }}>
                                Cobertura Regional (Visitas)
                            </Text>
                            
                            <View style={styles.progressContainer}>
                                <View style={styles.progressHeader}>
                                    <Text>Capital / Sede</Text>
                                    <Text>{metrics.agendas.capitalPercentage}% ({metrics.agendas.capitalCount})</Text>
                                </View>
                                <View style={styles.progressBarOuter}>
                                    <View style={[styles.progressBarInnerBlue, { width: `${metrics.agendas.capitalPercentage}%` }]} />
                                </View>
                            </View>

                            <View style={styles.progressContainer}>
                                <View style={styles.progressHeader}>
                                    <Text>Municípios do Interior</Text>
                                    <Text>{metrics.agendas.interiorPercentage}% ({metrics.agendas.interiorCount})</Text>
                                </View>
                                <View style={styles.progressBarOuter}>
                                    <View style={[styles.progressBarInnerGreen, { width: `${metrics.agendas.interiorPercentage}%` }]} />
                                </View>
                            </View>
                        </View>

                        {/* Subcoluna 2: Cidades Mais Visitadas */}
                        <View style={styles.col6}>
                            <Text style={{ fontSize: 9.5, fontWeight: 'bold', marginBottom: 8, color: '#0f172a' }}>
                                Cidades com Maior Presença (Top 5)
                            </Text>
                            
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.tableCellBold, { flex: 3 }]}>Município</Text>
                                    <Text style={[styles.tableCellBold, styles.tableCellRight, { flex: 1 }]}>Visitas</Text>
                                </View>
                                
                                {metrics.agendas.topCidades.length > 0 ? (
                                    metrics.agendas.topCidades.map((c, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { flex: 3 }]}>{idx + 1}. {c.nome}</Text>
                                            <Text style={[styles.tableCell, styles.tableCellRight, { flex: 1 }]}>{c.visitas}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { textAlign: 'center', color: '#94a3b8' }]}>
                                            Nenhuma agenda oficial no período.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Seção 3: Financeiro por Categoria */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Distribuição de Custos por Categoria</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCellBold, { flex: 3 }]}>Categoria de Atividade</Text>
                            <Text style={[styles.tableCellBold, styles.tableCellRight, { flex: 1 }]}>Total Gasto</Text>
                        </View>
                        {metrics.financeiro.porCategoria.length > 0 ? (
                            metrics.financeiro.porCategoria.map((cat, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { flex: 3, textTransform: 'capitalize' }]}>{cat.label}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellRight, { flex: 1 }]}>{formatarMoeda(cat.value)}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableCell, { textAlign: 'center', color: '#94a3b8' }]}>
                                    Nenhuma despesa declarada no período.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>Documento Gerado por: {usuarioGerador}</Text>
                    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>

            {/* Página 2: Setores Temáticos e Controle de Demandas (CRM) */}
            <Page size="A4" style={styles.page}>
                <Image
                    src={TIMBRADO_BASE64}
                    style={styles.backgroundImage}
                    fixed
                />
                {/* Timbre / Cabeçalho */}
                <View style={styles.timbradoContainer}>
                    <View style={styles.timbradoLeft}>
                        <Text style={styles.timbradoSystem}>Prisma — Gabinete Virtual</Text>
                        <Text style={styles.timbradoDocType}>Dossiê de Desempenho Operacional</Text>
                    </View>
                    <View style={styles.timbradoRight}>
                        <Text>Unidade: {unidadeNome}</Text>
                        <Text>Competência: {getPeriodoExtenso(dados.periodo, dados.startDate, dados.endDate)}</Text>
                    </View>
                </View>

                {/* Seção 4: Desempenho Temático */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Concentração Operacional por Setores</Text>
                    <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 6 }}>
                        Frequência consolidada de atividades (agendas oficiais + postagens) associadas a eixos governamentais.
                    </Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCellBold, { flex: 3 }]}>Eixo Temático / Setor</Text>
                            <Text style={[styles.tableCellBold, styles.tableCellRight, { flex: 1 }]}>Ações Consolidadas</Text>
                        </View>
                        {metrics.eixosConsolidados.length > 0 ? (
                            metrics.eixosConsolidados.map((eixo, idx) => {
                                const labelsMap: Record<string, string> = {
                                    saude: "Saúde",
                                    educacao: "Educação",
                                    seguranca: "Segurança",
                                    infraestrutura: "Infraestrutura",
                                    assistencia_social: "Assistência Social",
                                    institucional: "Institucional",
                                    "sem eixo": "Geral/Não Classificado"
                                };
                                const labelFormated = labelsMap[eixo.label.toLowerCase()] || eixo.label;
                                return (
                                    <View key={idx} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 3 }]}>{labelFormated}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellRight, { flex: 1 }]}>{eixo.count}</Text>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableCell, { textAlign: 'center', color: '#94a3b8' }]}>
                                    Nenhuma classificação de eixo temático mapeada.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Seção 5: Controle do CRM - Demandas Políticas do Interior */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Linha de Demandas & Resolutividade (CRM)</Text>
                    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, fontSize: 8.5 }}>
                        <Text>Total de Demandas do Período: <Text style={{ fontWeight: 'bold' }}>{metrics.demandas.total}</Text></Text>
                        <Text>Taxa de Sucesso (Entregues): <Text style={{ fontWeight: 'bold', color: '#10b981' }}>{metrics.demandas.taxaResolucao}%</Text></Text>
                    </View>

                    <Text style={{ fontSize: 9, fontWeight: 'bold', marginTop: 10, marginBottom: 6, color: '#0f172a' }}>
                        Demandas de Interior Recentes / Urgentes (Top 5)
                    </Text>
                    
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableCellBold, { flex: 1.5 }]}>Solicitante</Text>
                            <Text style={[styles.tableCellBold, { flex: 1.2 }]}>Cidade</Text>
                            <Text style={[styles.tableCellBold, { flex: 3.5 }]}>Descrição do Pedido</Text>
                            <Text style={[styles.tableCellBold, styles.tableCellRight, { flex: 1 }]}>Status</Text>
                        </View>
                        
                        {metrics.demandas.recentes.length > 0 ? (
                            metrics.demandas.recentes.map((d) => (
                                <View key={d.id} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, { flex: 1.5 }]}>{d.solicitante}</Text>
                                    <Text style={[styles.tableCell, { flex: 1.2 }]}>{d.cidade}</Text>
                                    <Text style={[styles.tableCell, { flex: 3.5, fontSize: 8 }]}>{d.descricao}</Text>
                                    <View style={[styles.tableCell, { flex: 1, alignItems: 'flex-end' }]}>
                                        <Text style={[
                                            styles.badge,
                                            d.status === "entregue" ? styles.badgeGreen : 
                                            d.status === "em_andamento" ? styles.badgeOrange : styles.badgeRed
                                        ]}>
                                            {d.status === "entregue" ? "Entregue" : 
                                             d.status === "em_andamento" ? "Pendente" : "Negado"}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableCell, { textAlign: 'center', color: '#94a3b8' }]}>
                                    Nenhuma demanda registrada neste período.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>Documento Gerado por: {usuarioGerador}</Text>
                    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}
