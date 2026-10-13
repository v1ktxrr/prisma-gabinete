import React from 'react';
import { CalendarClock } from 'lucide-react';
import { CalendarioEvent } from '@/lib/types';

interface MapaCalorEngajamentoProps {
    entregas: CalendarioEvent[];
}

const DIAS_SEMANA = [
    { label: 'Seg', value: 1 },
    { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 },
    { label: 'Qui', value: 4 },
    { label: 'Sex', value: 5 },
    { label: 'Sáb', value: 6 },
    { label: 'Dom', value: 0 },
];

const PERIODOS_DIA = [
    { id: 'manha', label: 'Manhã (06h-12h)', min: 6, max: 11.99 },
    { id: 'tarde', label: 'Tarde (12h-18h)', min: 12, max: 17.99 },
    { id: 'noite', label: 'Noite (18h-23h)', min: 18, max: 23.99 },
];

export default function MapaCalorEngajamento({ entregas }: MapaCalorEngajamentoProps) {
    // 1. Estrutura inicial do Heatmap
    // heatmap[periodoId][diaDaSemanaValue] = totalInteracoes
    const heatmap: Record<string, Record<number, number>> = {};
    PERIODOS_DIA.forEach(p => {
        heatmap[p.id] = {};
        DIAS_SEMANA.forEach(d => {
            heatmap[p.id][d.value] = 0;
        });
    });

    // 2. Agregação de dados
    let maxInteracoes = 0;

    entregas.forEach(ev => {
        if (!ev.start) return;

        // Tenta fazer o parse da data. No PostgreSQL v_calendario, vem como 'YYYY-MM-DD HH24:MI'
        // Mas se não tiver hora, assumimos default (ex: 00:00). Podemos ignorar os que não têm hora certa?
        // Vamos parsear a data corretamente
        const date = new Date(ev.start.replace(' ', 'T'));
        if (isNaN(date.getTime())) return;

        const hr = date.getHours();
        const min = date.getMinutes();
        const timeDecimal = hr + (min / 60);
        const diaSemana = date.getDay();

        // Identifica o período
        const periodo = PERIODOS_DIA.find(p => timeDecimal >= p.min && timeDecimal <= p.max);

        if (periodo && heatmap[periodo.id][diaSemana] !== undefined) {
            const m = ev.metrics_snapshot || {};
            const interacoes = (m.likes || 0) + (m.comments || 0);

            heatmap[periodo.id][diaSemana] += interacoes;
            if (heatmap[periodo.id][diaSemana] > maxInteracoes) {
                maxInteracoes = heatmap[periodo.id][diaSemana];
            }
        }
    });

    const getOpacity = (valor: number) => {
        if (maxInteracoes === 0 || valor === 0) return 0; // Vai renderizar o empty state
        // Garante uma opacidade mínima de 20% para que seja visível
        return Math.max(0.2, valor / maxInteracoes);
    };



    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-8">
            {/* Cabeçalho */}
            <div className="flex flex-col items-start gap-3 mb-6 w-full">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                        <CalendarClock className="w-4 h-4 text-slate-600" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Mapa de Calor</h2>
                </div>

                {/* Legenda de Intensidade */}
                <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 font-medium">
                    <span>Menos ativ.</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-sm bg-blue-600 opacity-20"></div>
                        <div className="w-3 h-3 rounded-sm bg-blue-600 opacity-50"></div>
                        <div className="w-3 h-3 rounded-sm bg-blue-600 opacity-80"></div>
                        <div className="w-3 h-3 rounded-sm bg-blue-600 opacity-100"></div>
                    </div>
                    <span>Mais ativ.</span>
                </div>
            </div>

            {/* O Grid Principal */}
            <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[350px] grid grid-cols-8 gap-1.5">
                    {/* Célula Vazia Superior Esquerda */}
                    <div></div>
                    {/* Rótulos dos Dias do Eixo X */}
                    {DIAS_SEMANA.map(dia => (
                        <div key={dia.value} className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider self-end pb-1">
                            {dia.label}
                        </div>
                    ))}

                    {/* Blocos de Calor */}
                    {PERIODOS_DIA.map(periodo => (
                        <React.Fragment key={periodo.id}>
                            {/* Rótulo do Período no Eixo Y */}
                            <div className="flex flex-col items-end justify-center pr-2">
                                <span className="text-sm font-semibold">{periodo.label.split(' ')[0]}</span>
                                <span className="text-[10px] text-slate-400">{periodo.label.match(/\((.*?)\)/)?.[1]}</span>
                            </div>

                            {/* Os 7 Quadrados de Calor */}
                            {DIAS_SEMANA.map(dia => {
                                const interacoes = heatmap[periodo.id][dia.value];
                                const opacity = getOpacity(interacoes);

                                return (
                                    <div
                                        key={`${periodo.id}-${dia.value}`}
                                        className="w-full aspect-square rounded-md transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-slate-300 hover:ring-offset-1 cursor-crosshair flex items-center justify-center relative group"
                                        style={{
                                            backgroundColor: interacoes > 0 ? '#2563eb' : '#f8fafc',
                                            opacity: interacoes > 0 ? opacity : 1 // bg-slate-50 has its own color, no opacity needed
                                        }}
                                        title={`${dia.label} - ${periodo.label.split(' ')[0]}: ${interacoes} interações`}
                                    >
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Empty State visual */}
            {maxInteracoes === 0 && (
                <div className="mt-4 text-center">
                    <p className="text-xs text-slate-400 italic">Volume de interações insuficiente para gerar o mapa de calor no período selecionado.</p>
                </div>
            )}
        </div>
    );
}
