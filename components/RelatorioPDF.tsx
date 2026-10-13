import { User, Calendar, Eye, Heart, MessageCircle, MessageSquare, ImageIcon, ExternalLink } from 'lucide-react';

export interface RelatorioPDFProps {
    timbrado?: string;
    data: {
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
    };
}

export default function RelatorioPDF({ data, timbrado }: RelatorioPDFProps) {
    const realTotalViews = data.kpis.views;
    const realTotalCurtidas = data.kpis.likes;
    const realTotalComentarios = data.kpis.comments;

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('pt-BR').format(num);
    };

    const formatarPeriodoMesAno = (periodo: string): string => {
        const match = periodo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
            const mes = parseInt(match[2], 10) - 1;
            const ano = parseInt(match[3], 10);
            const dt = new Date(ano, mes, 1);
            return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        }
        const agora = new Date();
        return agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    };

    // Gera os eixos temáticos aqui para manter o JSX limpo
    const temasAgrupados = data.entregas.reduce((acc, entrega) => {
        const tema = entrega.tema && entrega.tema.trim() ? entrega.tema.trim() : null;
        if (!tema) return acc;
        if (!acc[tema]) acc[tema] = 0;
        acc[tema] += entrega.alcance || 0;
        return acc;
    }, {} as Record<string, number>);

    const dadosTemas = Object.entries(temasAgrupados)
        .map(([tema, views]) => ({ tema, views }))
        .filter(t => t.views > 0)
        .sort((a, b) => b.views - a.views);

    const maxViews = dadosTemas.length > 0 ? dadosTemas[0].views : 1;
    const entregasOrdenadas = [...data.entregas].sort((a, b) => (Number(b.alcance) || 0) - (Number(a.alcance) || 0));

    return (
        <div className="bg-white text-slate-900 w-full font-sans relative pb-10 print:pb-0 print:bg-transparent">
            {/* 1. CSS NATIVO DE IMPRESSÃO */}
            <style type="text/css" media="print">
                {`
              @page { 
                size: A4; 
                /* MÁGICA: Zera as margens para destruir o cabeçalho automático ("Prisma App" e "Data") e colar o Timbrado na borda */
                margin: 0; 
              }
              body { 
                margin: 0; 
                background-color: transparent !important;
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              /* Força que o <thead> e <tfoot> sejam impressos em cada página física */
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            `}
            </style>

            {/* ========== TIMBRADO COMO BACKGROUND (Z-INDEX: -1) ========== */}
            {/* Ele fica solto com position fixed para repetir em todas as páginas por debaixo do texto, atuando literalmente como um "papel" timbrado */}
            {timbrado && (
                <>
                    {/* Versão Impressão (Fixo e Repetitivo) */}
                    <div className="hidden print:block fixed top-0 left-0 w-full" style={{ zIndex: -1 }}>
                        <img
                            src={timbrado}
                            alt="Timbrado Governo"
                            className="w-full object-cover block"
                            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                        />
                    </div>
                    {/* Versão Web (Preview) */}
                    <div className="print:hidden w-full max-w-4xl mx-auto mb-4" style={{ zIndex: -1 }}>
                        <img src={timbrado} alt="Timbrado Governo" className="w-full h-auto object-cover block" />
                    </div>
                </>
            )}

            {/* TABELA MESTRA QUE CORRIGE QUEBRA DE PÁGINAS E ESPAÇAMENTOS */}
            <table className="w-full max-w-4xl mx-auto border-collapse font-sans bg-transparent">

                {/* ========== O THEAD FUNCIONA APENAS COMO ESPAÇADOR TRANSPARENTE ========== */}
                {/* Ele empurra o texto para não encavalar com a arte do timbrado (que está no background fixed) */}
                <thead>
                    <tr>
                        <td className="p-0 border-none align-top">
                            <div style={{ height: timbrado ? '40mm' : '15mm' }} />
                        </td>
                    </tr>
                </thead>

                {/* ========== O TFOOT É O RODAPÉ (REPETE EM TODAS AS PÁGINAS) ========== */}
                <tfoot>
                    <tr>
                        <td className="p-0 border-none align-bottom">
                            <div className="h-[15mm] flex items-center justify-center text-[9px] text-slate-400 uppercase tracking-widest">
                                {formatarPeriodoMesAno(data.periodo)}
                            </div>
                        </td>
                    </tr>
                </tfoot>

                {/* ========== O TBODY É O CORPO (DIVIDIDO EM MÚLTIPLAS TRs PARA ROLAR PERFEITO) ========== */}
                <tbody>
                    {/* LINHA 1: CABEÇALHO */}
                    <tr>
                        <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                            <header className="mb-8 mt-6 print:mt-4 break-inside-avoid">
                                <h1 className="text-2xl font-bold text-slate-900 mb-4">
                                    Relatório Individual de Desempenho
                                </h1>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 print:border-slate-300">
                                        <User className="w-4 h-4 text-slate-400" />
                                        {data.colaborador}
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 print:border-slate-300">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        {formatarPeriodoMesAno(data.periodo)}
                                    </div>
                                </div>
                            </header>
                        </td>
                    </tr>

                    {/* LINHA 2: RESUMO EXECUTIVO */}
                    <tr>
                        <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                            <div className="mb-10 break-inside-avoid">
                                <div className="flex items-baseline gap-3 mb-5">
                                    <h2 className="text-xl font-bold text-slate-900">Resumo Executivo</h2>
                                    <span className="text-[10px] text-slate-400 font-medium leading-tight">* Métricas consolidadas de todas as postagens da equipe no período selecionado.</span>
                                </div>
                                <div className="grid grid-cols-3 gap-5">
                                    {/* Visualizações */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 print:shadow-none">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visualizações</h3>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-4xl font-black text-slate-900">
                                                    {realTotalViews > 0 ? (realTotalViews >= 1000000 ? (realTotalViews / 1000000).toFixed(1) + 'M' : realTotalViews.toLocaleString("pt-BR")) : "-"}
                                                </p>
                                            </div>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 print:border print:border-blue-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                                                <Eye className="h-6 w-6" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Curtidas */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 print:shadow-none">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Curtidas</h3>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-4xl font-black text-slate-900">
                                                    {realTotalCurtidas > 0 ? (realTotalCurtidas >= 1000000 ? (realTotalCurtidas / 1000000).toFixed(1) + 'M' : realTotalCurtidas.toLocaleString("pt-BR")) : "-"}
                                                </p>
                                            </div>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 text-pink-600 print:border print:border-pink-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                                                <Heart className="h-6 w-6" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Comentários */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 print:shadow-none">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Comentários</h3>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-4xl font-black text-slate-900">
                                                    {realTotalComentarios > 0 ? (realTotalComentarios >= 1000000 ? (realTotalComentarios / 1000000).toFixed(1) + 'M' : realTotalComentarios.toLocaleString("pt-BR")) : "-"}
                                                </p>
                                            </div>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 print:border print:border-amber-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                                                <MessageCircle className="h-6 w-6" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>

                    {/* LINHA 3: EIXO TEMÁTICO (SE HOUVER) */}
                    {dadosTemas.length > 0 && (
                        <tr>
                            <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                                <div className="mt-4 mb-8 bg-white border border-slate-200 rounded-2xl p-5 print:shadow-none break-inside-avoid">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                                        Retorno por Eixo Temático
                                    </h3>
                                    <div>
                                        {dadosTemas.map((item, idx) => (
                                            <div key={idx} className={`flex items-center gap-4 ${idx < dadosTemas.length - 1 ? 'mb-3' : ''}`}>
                                                <div className="w-1/4 text-sm font-bold text-slate-700 truncate" title={item.tema}>
                                                    {item.tema}
                                                </div>
                                                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
                                                    <div
                                                        className="h-full bg-blue-600 rounded-full"
                                                        style={{
                                                            width: `${(item.views / maxViews) * 100}%`,
                                                            printColorAdjust: 'exact',
                                                            WebkitPrintColorAdjust: 'exact',
                                                        } as React.CSSProperties}
                                                    />
                                                </div>
                                                <div className="w-16 text-right text-sm font-extrabold text-slate-900">
                                                    {formatNumber(item.views)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}

                    {/* LINHA 4: TÍTULO ATIVIDADES CONCLUÍDAS */}
                    <tr>
                        <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">
                                Atividades Concluídas
                            </h3>
                        </td>
                    </tr>

                    {/* MÚLTIPLAS LINHAS: UMA PARA CADA CARD (EVITA MASS PAGE BREAK BUGS) */}
                    {entregasOrdenadas.length === 0 ? (
                        <tr>
                            <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                                <p className="text-sm text-slate-400 italic">Nenhuma atividade registrada neste período.</p>
                            </td>
                        </tr>
                    ) : (
                        entregasOrdenadas.map((entrega, index) => {
                            const estaAguardandoDados = !entrega.alcance && !entrega.curtidas && !entrega.comentarios;

                            const CardWrapper = entrega.postUrl ? 'a' : 'div';
                            const cardProps = entrega.postUrl
                                ? { href: entrega.postUrl, target: '_blank' as const, rel: 'noopener noreferrer' }
                                : {};

                            return (
                                <tr key={index}>
                                    <td className="p-0 border-none px-4 sm:px-0 print:px-[15mm]">
                                        <CardWrapper
                                            {...cardProps}
                                            className="flex items-start justify-between gap-4 w-full p-4 bg-white border border-slate-200 rounded-xl mb-4 break-inside-avoid print:shadow-none no-underline text-inherit hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                                        >
                                            {/* Lado Esquerdo: Imagem + Textos */}
                                            <div className="flex-1 pr-6 flex items-start gap-4">
                                                {entrega.urlImagem ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={entrega.urlImagem}
                                                        alt={entrega.titulo}
                                                        className="w-[42px] h-[56px] rounded-md object-cover bg-slate-200 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-[42px] h-[56px] rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-300">
                                                        <ImageIcon className="w-4 h-4" />
                                                    </div>
                                                )}

                                                <div className="flex flex-col flex-1">
                                                    <h3 className="text-sm font-bold text-slate-800 leading-snug whitespace-normal break-words flex items-center gap-1.5">
                                                        {entrega.titulo}
                                                        {entrega.postUrl && (
                                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-50 text-blue-500 shrink-0 print:border print:border-blue-100">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                                        <span className="shrink-0">{entrega.data}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                                                        <span className="text-blue-600 font-medium">{entrega.categoria}</span>
                                                        {entrega.tema && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                                                                <span className="text-slate-500">{entrega.tema}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {entrega.atividades && entrega.atividades.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {entrega.atividades.map((atividade, i) => {
                                                                const cores: Record<string, string> = {
                                                                    'Captação': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                                    'Edição': 'bg-violet-50 text-violet-700 border-violet-200',
                                                                    'Texto': 'bg-sky-50 text-sky-700 border-sky-200',
                                                                    'Publicação': 'bg-orange-50 text-orange-700 border-orange-200',
                                                                };
                                                                const cor = cores[atividade] || 'bg-slate-50 text-slate-600 border-slate-200';
                                                                const printStyle = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties;
                                                                return (
                                                                    <span
                                                                        key={i}
                                                                        className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${cor}`}
                                                                        style={printStyle}
                                                                    >
                                                                        {atividade}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Lado Direito: Métricas */}
                                            <div className="flex shrink-0 w-[240px] justify-between items-start pt-1">
                                                {estaAguardandoDados ? (
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-full border border-slate-200 shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
                                                        Sem Dados Disponíveis
                                                    </span>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Views</span>
                                                            <span className="text-sm font-bold text-slate-800">{formatNumber(entrega.alcance || 0)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Curtidas</span>
                                                            <span className="text-sm font-bold text-slate-800">{formatNumber(entrega.curtidas || 0)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Comentários</span>
                                                            <span className="text-sm font-bold text-slate-800">{formatNumber(entrega.comentarios || 0)}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </CardWrapper>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
