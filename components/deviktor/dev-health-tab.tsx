"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

interface HealthCheck {
    service: string;
    status: "ok" | "warning" | "error";
    latency?: string;
    message: string;
}

interface DevHealthTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevHealthTab({ addToast }: DevHealthTabProps) {
    const [checks, setChecks] = useState<HealthCheck[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/deviktor-sys/health");
            if (!res.ok) throw new Error("Erro ao carregar health checks");
            const data = await res.json();
            setChecks(data);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
    }, []);

    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case "ok": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
            case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
            case "error": return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <Activity className="h-5 w-5 text-slate-500" />;
        }
    };

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-violet-400" />
                        Saúde de Integrações (Health Checks)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Verifique a comunicação com o banco de dados e APIs externas.
                    </p>
                </div>
                <button
                    onClick={fetchHealth}
                    disabled={loading}
                    className="p-2 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 cursor-pointer disabled:opacity-50"
                    title="Atualizar"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading && checks.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {checks.map((check, idx) => (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1 h-full ${
                                check.status === 'ok' ? 'bg-emerald-500' :
                                check.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                            
                            <div className="flex justify-between items-start pl-2">
                                <h4 className="font-bold text-white text-sm">{check.service}</h4>
                                <StatusIcon status={check.status} />
                            </div>
                            
                            <div className="pl-2 mt-auto">
                                <div className="text-xs text-slate-400">{check.message}</div>
                                {check.latency && (
                                    <div className="text-[10px] font-mono text-slate-500 mt-2 bg-slate-900 inline-block px-2 py-0.5 rounded">
                                        Latência: {check.latency}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {checks.length === 0 && !loading && (
                        <div className="col-span-full p-8 text-center text-slate-500 italic">Nenhuma integração configurada.</div>
                    )}
                </div>
            )}
        </div>
    );
}
