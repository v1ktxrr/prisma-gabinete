"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";

interface Demanda {
    id: string;
    solicitante: string;
    descricao: string;
    status: "em_andamento" | "entregue" | "negado";
}

interface CRMAlertBannerProps {
    municipioId: string | null | undefined;
    className?: string;
    refreshKey?: number;
}

export default function CRMAlertBanner({ municipioId, className = "", refreshKey }: CRMAlertBannerProps) {
    const { unidadeId } = usePermissions();
    const [cityName, setCityName] = useState<string>("");
    const [demands, setDemands] = useState<Demanda[]>([]);
    const [metrics, setMetrics] = useState({
        emAndamento: 0,
        entregue: 0,
        negado: 0,
        total: 0
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showDetails, setShowDetails] = useState<boolean>(false);

    useEffect(() => {
        if (!municipioId) {
            setCityName("");
            setDemands([]);
            setMetrics({ emAndamento: 0, entregue: 0, negado: 0, total: 0 });
            return;
        }

        const fetchCrmData = async () => {
            setIsLoading(true);
            try {
                // 1. Obter o nome do município
                const { data: cityData } = await supabase
                    .from("municipios")
                    .select("nome")
                    .eq("id", municipioId)
                    .single();
                
                if (cityData) {
                    setCityName(cityData.nome);
                }

                // 2. Obter as demandas associadas do município na unidade ativa
                const { data: demandsData, error } = await supabase
                    .from("demandas")
                    .select("id, solicitante, descricao, status")
                    .eq("municipio_id", municipioId)
                    .eq("unidade_id", unidadeId ?? "CG");

                if (error) throw error;

                const list = (demandsData as Demanda[]) || [];
                setDemands(list);

                const emAndamento = list.filter(d => d.status === "em_andamento").length;
                const entregue = list.filter(d => d.status === "entregue").length;
                const negado = list.filter(d => d.status === "negado").length;

                setMetrics({
                    emAndamento,
                    entregue,
                    negado,
                    total: list.length
                });
            } catch (err) {
                console.error("[CRMAlertBanner] Erro ao carregar dados do alerta:", err);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchCrmData();
    }, [municipioId, unidadeId, refreshKey]);

    // Não exibe nada se estiver carregando ou se não houver nenhuma demanda registrada para este município
    if (isLoading || metrics.total === 0 || !municipioId) {
        return null;
    }

    return (
        <div className={`rounded-2xl bg-amber-50 border border-amber-200 p-4 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 ${className}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex gap-2.5 items-start">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-amber-900 leading-snug">
                            Alerta de CRM: Demandas políticas em {cityName}
                        </h4>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed font-medium">
                            Este município possui {metrics.total} {metrics.total === 1 ? "demanda registrada" : "demandas registradas"} no gabinete para a sua unidade.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-800 hover:text-amber-950 transition-colors uppercase tracking-wider shrink-0 cursor-pointer select-none bg-amber-100/50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200/50"
                >
                    {showDetails ? (
                        <>
                            Ocultar <ChevronUp className="h-3 w-3" />
                        </>
                    ) : (
                        <>
                            Ver Detalhes <ChevronDown className="h-3 w-3" />
                        </>
                    )}
                </button>
            </div>

            {/* Badges de Status */}
            <div className="flex flex-wrap gap-2 mt-3 border-t border-amber-200/30 pt-3">
                <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>{metrics.emAndamento} Em andamento</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{metrics.entregue} Entregues</span>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-rose-800">
                    <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                    <span>{metrics.negado} Negadas</span>
                </div>
            </div>

            {/* Detalhes Expandidos */}
            {showDetails && (
                <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-amber-200/30 border-t border-amber-200/20 pt-2 flex flex-col gap-2 custom-scrollbar">
                    {demands.map((d) => (
                        <div key={d.id} className="pt-2.5 first:pt-0 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-[10px] text-amber-900 truncate">
                                    Solicitante: {d.solicitante}
                                </span>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border shrink-0 ${
                                    d.status === "em_andamento" 
                                        ? "bg-amber-100 text-amber-800 border-amber-200" 
                                        : d.status === "entregue" 
                                            ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                                            : "bg-rose-50 text-rose-800 border-rose-100"
                                }`}>
                                    {d.status === "em_andamento" ? "Em Andamento" : d.status === "entregue" ? "Entregue" : "Negado"}
                                </span>
                            </div>
                            <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                                {d.descricao}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
