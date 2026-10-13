import React from 'react';
import { Target } from 'lucide-react';

interface TermometroTracaoProps {
    totalViews: number;
    periodoSelecionado: string;
}

const META_MENSAL_VIEWS = 100000; // 100k views hardcoded

export default function TermometroTracao({ totalViews, periodoSelecionado }: TermometroTracaoProps) {
    // 1. Cálculos de Porcentagem
    const pctMetaAtingida = Math.min((totalViews / META_MENSAL_VIEWS) * 100, 100);

    // 2. Cálculo de Tempo Decorrido (apenas se for este_mes)
    let pctTempoDecorrido = 100;
    const isEsteMes = periodoSelecionado === 'este_mes';

    if (isEsteMes) {
        const hoje = new Date();
        const diaAtual = hoje.getDate();
        const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        pctTempoDecorrido = (diaAtual / diasNoMes) * 100;
    }

    // 3. Status de Ritmo
    let statusLabel = "Concluído";
    let statusColor = "border-slate-200 text-slate-700 bg-slate-50";
    let dotColor = "bg-slate-400";
    let barColor = "bg-slate-700";

    if (isEsteMes) {
        const diferenca = pctMetaAtingida - pctTempoDecorrido;

        if (diferenca >= 0) {
            statusLabel = "Acima do Ritmo";
            statusColor = "border-slate-200 text-slate-700 bg-slate-50";
            barColor = "bg-slate-800";
            dotColor = "bg-emerald-500";
        } else if (diferenca >= -15) {
            statusLabel = "Atenção (Leve Atraso)";
            statusColor = "border-slate-200 text-slate-700 bg-slate-50";
            barColor = "bg-slate-600";
            dotColor = "bg-amber-500";
        } else {
            statusLabel = "Abaixo do Ritmo";
            statusColor = "border-slate-200 text-slate-700 bg-slate-50";
            barColor = "bg-slate-400";
            dotColor = "bg-rose-500";
        }
    } else {
        if (pctMetaAtingida >= 100) {
            statusLabel = "Meta Batida";
            statusColor = "border-slate-200 text-slate-700 bg-slate-50";
            barColor = "bg-slate-800";
            dotColor = "bg-emerald-500";
        } else {
            statusLabel = "Meta Não Atingida";
            statusColor = "border-slate-200 text-slate-700 bg-slate-50";
            barColor = "bg-slate-400";
            dotColor = "bg-rose-500";
        }
    }

    // Helpers de formatação
    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        return num.toString();
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mt-8">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <Target className="w-4 h-4 text-slate-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Termômetro de Tração</h2>
                </div>
                <div className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-full border shadow-sm ${statusColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                    {statusLabel}
                </div>
            </div>

            {/* Informação e Meta */}
            <div className="flex items-end justify-between mb-2">
                <div className="flex flex-col">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">
                        {formatNumber(totalViews)} <span className="text-sm font-medium text-slate-500">views</span>
                    </span>
                    <span className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                        de {formatNumber(META_MENSAL_VIEWS)} (Meta Mensal)
                    </span>
                </div>
                <span className="text-sm font-bold text-slate-700">
                    {pctMetaAtingida.toFixed(1)}%
                </span>
            </div>

            {/* Barra de Progresso com Marcação de Tempo */}
            <div className="relative w-full h-3 bg-slate-100 rounded-full mt-3 overflow-hidden">
                {/* Linha do Tempo (Hoje) - Só mostra se for o mês corrente */}
                {isEsteMes && (
                    <div
                        className="absolute top-0 bottom-0 border-l-[3px] border-slate-800 z-10"
                        style={{ left: `${pctTempoDecorrido}%`, marginLeft: '-1.5px' }}
                        title={`Hoje: ${pctTempoDecorrido.toFixed(1)}% do mês`}
                    ></div>
                )}

                {/* Barra de Preenchimento da Meta */}
                <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                    style={{ width: `${pctMetaAtingida}%` }}
                ></div>
            </div>

            {/* Legenda de Tempo */}
            {isEsteMes && (
                <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-slate-400 font-medium">Início do Mês</span>
                    <span className="text-[10px] text-slate-500 font-semibold leading-none">
                        Tempo decorrido: {pctTempoDecorrido.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Fim do Mês</span>
                </div>
            )}
        </div>
    );
}
