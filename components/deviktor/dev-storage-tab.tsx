"use client";

import { useEffect, useState } from "react";
import { Loader2, HardDrive, AlertTriangle } from "lucide-react";

interface BucketStat {
    bucket: string;
    size_bytes: number;
    total_files: number;
    error?: string;
}

interface TableStat {
    tabela: string;
    tamanho: number;
}

interface MetricsData {
    database: {
        size_bytes: number;
        limit_bytes: number;
        percent_used: number;
        tables: TableStat[];
    };
    storage: {
        total_bytes: number;
        limit_bytes: number;
        percent_used: number;
        buckets: BucketStat[];
    };
    billing: {
        current_plan: string;
        forecast: string;
        recommendation: string;
        upgrade_suggested: boolean;
    };
}

interface DevStorageTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevStorageTab({ addToast }: DevStorageTabProps) {
    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/deviktor-sys/storage/metrics");
            if (!res.ok) throw new Error("Erro ao carregar métricas de armazenamento");
            const data = await res.json();
            setMetrics(data);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <HardDrive className="h-4.5 w-4.5 text-violet-400" />
                        Métricas de Infraestrutura & Banco
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Análise de ocupação física de disco, estimativas de cota e forecasts financeiros para o gabinete.
                    </p>
                </div>
                <button
                    onClick={fetchMetrics}
                    className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-2.5 py-1 text-xs border border-slate-700 font-bold transition-all cursor-pointer"
                >
                    Recarregar
                </button>
            </div>

            {loading || !metrics ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Barra de Progresso do Banco e do Storage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Banco de dados */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-slate-400">Banco de Dados (PostgreSQL)</h4>
                                <span className="text-slate-400 font-mono text-xs">
                                    {formatBytes(metrics.database.size_bytes)} / {formatBytes(metrics.database.limit_bytes)}
                                </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800/80">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${metrics.database.percent_used > 85 ? 'bg-red-500' : 'bg-violet-500'}`}
                                    style={{ width: `${Math.min(metrics.database.percent_used, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                <span>Uso: {metrics.database.percent_used.toFixed(2)}%</span>
                                <span>Limite: {formatBytes(metrics.database.limit_bytes)}</span>
                            </div>
                        </div>

                        {/* Storage */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-slate-400">Armazenamento (Buckets)</h4>
                                <span className="text-slate-400 font-mono text-xs">
                                    {formatBytes(metrics.storage.total_bytes)} / {formatBytes(metrics.storage.limit_bytes)}
                                </span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800/80">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${metrics.storage.percent_used > 85 ? 'bg-red-500' : 'bg-violet-500'}`}
                                    style={{ width: `${Math.min(metrics.storage.percent_used, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                <span>Uso: {metrics.storage.percent_used.toFixed(2)}%</span>
                                <span>Limite: {formatBytes(metrics.storage.limit_bytes)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Previsão Financeira & Forecast de Custos */}
                    <div className={`border rounded-xl p-4 flex flex-col gap-2 ${metrics.billing.upgrade_suggested ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-950/60 border-slate-800'}`}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${metrics.billing.upgrade_suggested ? 'text-red-500' : 'text-slate-400'}`} />
                            <h4 className="font-bold text-white text-xs uppercase tracking-wide">Previsão Financeira & Forecast de Custos</h4>
                        </div>
                        <p className="text-xs text-slate-350 leading-relaxed">
                            {metrics.billing.forecast}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 text-xs">
                            <span className="text-slate-500">Plano Atual: <strong className="text-slate-300 font-bold">{metrics.billing.current_plan}</strong></span>
                            <span className={`font-bold px-2.5 py-0.5 rounded text-[10px] uppercase border ${metrics.billing.upgrade_suggested ? 'bg-red-500 text-white border-red-650' : 'bg-emerald-950 text-emerald-400 border-emerald-800'}`}>
                                {metrics.billing.recommendation}
                            </span>
                        </div>
                    </div>

                    {/* Buckets e Tabelas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Buckets */}
                        <div className="lg:col-span-1 flex flex-col gap-3">
                            <h4 className="font-bold text-slate-450 text-[10px] uppercase tracking-wider">Detalhamento por Bucket</h4>
                            <div className="flex flex-col gap-3">
                                {metrics.storage.buckets.map((b) => (
                                    <div key={b.bucket} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                                        <h5 className="font-bold text-white capitalize text-xs">{b.bucket}</h5>
                                        {b.error ? (
                                            <span className="text-[10px] text-red-400 font-mono bg-red-950/30 p-1.5 rounded">{b.error}</span>
                                        ) : (
                                            <div className="flex justify-between text-xs font-mono">
                                                <span className="text-slate-500">Arquivos: <strong className="text-slate-300">{b.total_files}</strong></span>
                                                <span className="text-violet-400 font-bold">{formatBytes(b.size_bytes)}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tabelas físicas */}
                        <div className="lg:col-span-2 flex flex-col gap-3">
                            <h4 className="font-bold text-slate-450 text-[10px] uppercase tracking-wider">Tamanho Físico das Tabelas</h4>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-[320px] overflow-y-auto">
                                <table className="w-full text-left border-collapse text-[11px] font-mono">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold">
                                            <th className="pb-2">Tabela</th>
                                            <th className="pb-2 text-right">Tamanho Físico (Disk)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/35 text-slate-300">
                                        {metrics.database.tables.map((t) => (
                                            <tr key={t.tabela} className="hover:bg-slate-900/30 transition-colors">
                                                <td className="py-2 text-slate-350">{t.tabela}</td>
                                                <td className="py-2 text-right text-violet-400 font-bold">{formatBytes(t.tamanho)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
