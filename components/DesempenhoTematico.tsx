import React from 'react';

interface DesempenhoTematicoProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entregas: any[];
}

export default function DesempenhoTematico({ entregas }: DesempenhoTematicoProps) {
    // Lógica de Agregação de Dados
    const temasAgrupados = entregas.reduce((acc, ev) => {
        // Verifica tema; pautas sem tema caem em 'Diversos'
        let tema = ev.tema || ev.extendedProps?.tema || "Diversos";
        if (typeof tema !== "string" || !tema.trim()) {
            tema = "Diversos";
        }

        if (!acc[tema]) {
            acc[tema] = { views: 0, interacoes: 0, count: 0 };
        }

        const m = ev.metrics_snapshot || {};
        acc[tema].views += (m.views || m.reach || 0);
        acc[tema].interacoes += ((m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saved || 0));
        acc[tema].count += 1;

        return acc;
    }, {} as Record<string, { views: number; interacoes: number; count: number }>);

    const dados = Object.keys(temasAgrupados).map(tema => {
        const data = temasAgrupados[tema];
        const taxa = data.views > 0 ? ((data.interacoes / data.views) * 100) : 0;
        return {
            tema,
            ...data,
            taxaEngajamento: taxa
        };
    }).filter(t => t.views > 0).sort((a, b) => b.views - a.views);

    const maxViews = dados.length > 0 ? dados[0].views : 1;

    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        return num.toString();
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Retorno por Eixo Temático</h2>

            {dados.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Dados temáticos insuficientes para o período</p>
            ) : (
                <div className="flex flex-col gap-5">
                    {dados.map((item, idx) => (
                        <div key={idx} className="w-full flex items-center justify-between">
                            {/* Esquerda (Info) */}
                            <div className="w-[120px] shrink-0 flex flex-col gap-1 items-start">
                                <span className="text-sm font-bold text-slate-700 truncate w-full" title={item.tema}>
                                    {item.tema}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    {item.taxaEngajamento.toFixed(1)}% engaj.
                                </div>
                            </div>

                            {/* Meio (A Barra) */}
                            <div className="flex-1 mx-4 flex items-center">
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-slate-700 rounded-full h-2.5 transition-all duration-1000"
                                        style={{ width: `${(item.views / maxViews) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Direita (Valor) */}
                            <div className="w-[45px] shrink-0 flex justify-end">
                                <span className="text-sm font-bold text-slate-800">{formatNumber(item.views)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
