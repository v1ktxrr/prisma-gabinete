"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Loader2, RefreshCw, Eye, X } from "lucide-react";

interface LogSistema {
    id: string;
    classe: string;
    nivel: string;
    mensagem: string;
    detalhes: any;
    criado_em: string;
}

interface DevLogsTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export interface DevLogsTabRef {
    refreshLogs: () => void;
}

export const DevLogsTab = forwardRef<DevLogsTabRef, DevLogsTabProps>(({ addToast }, ref) => {
    const [logs, setLogs] = useState<LogSistema[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logPage, setLogPage] = useState(1);
    const [logTotalPages, setLogTotalPages] = useState(1);
    const [logTotalCount, setLogTotalCount] = useState(0);
    const [selectedLog, setSelectedLog] = useState<LogSistema | null>(null);
    const [logSearch, setLogSearch] = useState("");

    const fetchLogs = async (page = 1) => {
        setLoadingLogs(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: "15"
            });
            if (logSearch) {
                queryParams.append("search", logSearch);
            }
            const res = await fetch(`/api/deviktor-sys/logs?${queryParams.toString()}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao carregar logs");
            }
            const data = await res.json();
            setLogs(data.logs || []);
            setLogTotalPages(data.pages || 1);
            setLogTotalCount(data.total || 0);
            setLogPage(page);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoadingLogs(false);
        }
    };

    useImperativeHandle(ref, () => ({
        refreshLogs: () => {
            fetchLogs(1);
        }
    }));

    useEffect(() => {
        fetchLogs(1);
    }, []);

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col font-mono text-xs">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    # tail -n 20 /var/log/prisma_sistema
                </h3>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Buscar nos logs..."
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                fetchLogs(1);
                            }
                        }}
                        className="rounded-lg border border-slate-800 bg-slate-950 py-1.5 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 font-mono"
                    />
                    <button 
                        onClick={() => fetchLogs(1)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                        title="Atualizar Logs"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {loadingLogs ? (
                <div className="flex h-80 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
            ) : logs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-mono text-xs">
                    $ status: zero logs gravados no sistema.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] text-slate-500 uppercase tracking-wide">
                                <th className="p-3">Timestamp</th>
                                <th className="p-3">Classe</th>
                                <th className="p-3">Nível</th>
                                <th className="p-3">Mensagem</th>
                                <th className="p-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 text-slate-300">
                            {logs.map((log) => {
                                const timestamp = new Date(log.criado_em).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit"
                                });
                                
                                const lvlStyle = (lvl: string) => {
                                    if (lvl === "ERROR") return "text-red-400 bg-red-950/30 border-red-900/30";
                                    if (lvl === "WARNING") return "text-amber-400 bg-amber-950/30 border-amber-900/30";
                                    return "text-emerald-400 bg-emerald-950/30 border-emerald-900/30";
                                };

                                return (
                                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="p-3 text-slate-500 whitespace-nowrap">{timestamp}</td>
                                        <td className="p-3 font-bold text-slate-400">{log.classe}</td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold ${lvlStyle(log.nivel)}`}>
                                                {log.nivel}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-sm md:max-w-md truncate text-slate-200" title={log.mensagem}>
                                            {log.mensagem}
                                        </td>
                                        <td className="p-3 text-center font-sans">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md border border-slate-750 hover:text-white transition-all cursor-pointer font-sans"
                                            >
                                                <Eye className="h-3 w-3" />
                                                <span>Detalhar</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {logTotalPages > 1 && (
                <div className="p-4 border-t border-slate-800 bg-slate-900/20 flex items-center justify-between font-mono text-xs text-slate-500">
                    <button
                        disabled={logPage === 1 || loadingLogs}
                        onClick={() => fetchLogs(logPage - 1)}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 transition-all hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        &lt; anterior
                    </button>
                    <span>
                        página {logPage} de {logTotalPages}
                    </span>
                    <button
                        disabled={logPage === logTotalPages || loadingLogs}
                        onClick={() => fetchLogs(logPage + 1)}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 transition-all hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        próximo &gt;
                    </button>
                </div>
            )}

            {/* LOG DETAILS MODAL */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl flex flex-col gap-4 text-left font-mono">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="font-bold text-white text-xs font-mono">
                                ID do Log: {selectedLog.id}
                            </h4>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-4 font-mono text-xs">
                            <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-800/40 pb-3">
                                <div>
                                    <span className="text-slate-500 block">Timestamp:</span>
                                    <span className="text-slate-350">{new Date(selectedLog.criado_em).toLocaleString("pt-BR")}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Classe:</span>
                                    <span className="text-white font-bold">{selectedLog.classe}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Nível:</span>
                                    <span className="text-white font-bold">{selectedLog.nivel}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Mensagem:</span>
                                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-200 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                    {selectedLog.mensagem}
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Detalhes (Payload JSON):</span>
                                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-violet-400 overflow-auto max-h-60 text-[10px]">
                                    {JSON.stringify(selectedLog.detalhes, null, 4)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

DevLogsTab.displayName = "DevLogsTab";
