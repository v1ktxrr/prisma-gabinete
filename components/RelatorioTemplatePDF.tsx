import React from 'react';
import { User, Calendar, Eye, Heart, MessageSquare, ImageIcon } from 'lucide-react';

export interface RelatorioDataProps {
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
        engajamento: number;
        urlImagem?: string;
    }>;
}

export default function RelatorioTemplatePDF({ data }: { data: RelatorioDataProps }) {
    // Helpers
    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('pt-BR').format(num);
    };

    return (
        <div
            className="w-[210mm] min-h-[297mm] bg-transparent pt-[40mm] pb-[30mm] px-[20mm] font-sans text-slate-800 relative shadow-xl mx-auto flex flex-col"
        >
            {/* HEADER DO RELATÓRIO */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-3">
                    Relatório Individual de Desempenho
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 shadow-sm">
                        <User className="w-4 h-4 text-slate-400" />
                        {data.colaborador}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {data.periodo}
                    </div>
                </div>
            </header>

            {/* GRID DE KPIs */}
            <div className="grid grid-cols-3 gap-4 mt-6 mb-8">
                {/* Card 1: Views */}
                <div className="bg-white/90 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-slate-500 tracking-wide">VISUALIZAÇÕES</h2>
                        <Eye className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">
                        {formatNumber(data.kpis.views)}
                    </div>
                </div>

                {/* Card 2: Likes */}
                <div className="bg-white/90 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-slate-500 tracking-wide">CURTIDAS</h2>
                        <Heart className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">
                        {formatNumber(data.kpis.likes)}
                    </div>
                </div>

                {/* Card 3: Comments */}
                <div className="bg-white/90 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-slate-500 tracking-wide">COMENTÁRIOS</h2>
                        <MessageSquare className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">
                        {formatNumber(data.kpis.comments)}
                    </div>
                </div>
            </div>

            {/* LISTA DE ENTREGAS OFICIAIS */}
            <div className="flex-1 flex flex-col mt-4">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Entregas Oficiais</h2>

                <div className="flex flex-col">
                    {data.entregas.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Nenhuma entrega registrada neste período.
                        </div>
                    ) : (
                        data.entregas.map((entrega, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-4 bg-white/95 border border-slate-100 rounded-xl mb-3 shadow-sm"
                            >
                                {/* Lado Esquerdo (Thumb + Info) */}
                                <div className="flex items-center gap-4">
                                    {entrega.urlImagem ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={entrega.urlImagem}
                                            alt={entrega.titulo}
                                            className="w-14 h-14 rounded-lg object-cover bg-slate-200 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-5 h-5 text-slate-300" />
                                        </div>
                                    )}

                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 line-clamp-1">{entrega.titulo}</span>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                            <span>{entrega.data}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="text-blue-600 font-medium">{entrega.categoria}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Lado Direito (Métricas ou Status) */}
                                <div className="flex items-center gap-6 shrink-0 text-right">
                                    {entrega.status === "AGUARDANDO DADOS" || entrega.status === "Aguardando Dados" ? (
                                        <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
                                            Aguardando Dados
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">ALCANCE</span>
                                                <span className="text-sm font-bold text-slate-800">{formatNumber(entrega.alcance)}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">ENGAJAMENTO</span>
                                                <span className="text-sm font-bold text-slate-800">{formatNumber(entrega.engajamento)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
