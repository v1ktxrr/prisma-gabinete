"use client";

import { useEffect, useState, useRef } from "react";
import { Search, X, ChevronDown, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Municipio } from "@/lib/types";

// Static module-level cache for MS municipalities
let municipiosCachePromise: Promise<Municipio[]> | null = null;

function fetchMunicipios(): Promise<Municipio[]> {
    if (!municipiosCachePromise) {
        municipiosCachePromise = Promise.resolve(
            supabase
                .from("municipios")
                .select("id, nome, codigo_ibge")
                .order("nome", { ascending: true })
        ).then(({ data, error }) => {
            if (error) {
                municipiosCachePromise = null;
                throw error;
            }
            return (data as Municipio[]) || [];
        });
    }
    return municipiosCachePromise;
}

interface MunicipioMultiSelectProps {
    values: string[]; // Array of selected municipio_ids
    onChange: (ids: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export default function MunicipioMultiSelect({
    values = [],
    onChange,
    disabled = false,
    placeholder = "Selecione os municípios...",
    className = ""
}: MunicipioMultiSelectProps) {
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState("");
    const [aberto, setAberto] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch municipalities
    useEffect(() => {
        let ativo = true;
        setCarregando(true);
        fetchMunicipios()
            .then((list) => {
                if (ativo) {
                    setMunicipios(list);
                }
            })
            .catch((err) => {
                console.error("Erro ao carregar municípios:", err);
            })
            .finally(() => {
                if (ativo) setCarregando(false);
            });
        return () => {
            ativo = false;
        };
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        function cliqueFora(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setAberto(false);
            }
        }
        document.addEventListener("mousedown", cliqueFora);
        return () => document.removeEventListener("mousedown", cliqueFora);
    }, []);

    // Filter out already selected municipalities and match by search text
    const selecionados = municipios.filter((m) => values.includes(m.id));
    
    const disponiveis = municipios.filter((m) => !values.includes(m.id));
    
    const filtrados = disponiveis.filter((m) =>
        m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .includes(busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );

    const handleSelect = (m: Municipio) => {
        const novosIds = [...values, m.id];
        onChange(novosIds);
        setBusca("");
        // Keep focus but let dropdown stay open if they want to select more
    };

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const novosIds = values.filter((x) => x !== id);
        onChange(novosIds);
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
        setBusca("");
        setAberto(false);
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div 
                onClick={() => !disabled && setAberto(true)}
                className={`w-full min-h-[42px] rounded-xl border border-slate-250 bg-white p-1.5 pl-3 pr-10 text-xs font-semibold text-slate-800 outline-none transition-all flex flex-wrap gap-1.5 items-center ${
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-slate-350 focus-within:border-slate-450 focus-within:ring-4 focus-within:ring-slate-100/50"
                }`}
            >
                {/* Ícone de Pino */}
                <span className="text-slate-400 shrink-0 mr-1">
                    {carregando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <MapPin className="h-3.5 w-3.5" />
                    )}
                </span>

                {/* Selecionados Badges */}
                {selecionados.map((m) => (
                    <span 
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 pl-2 pr-1 py-0.5 text-[11px] font-bold text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                    >
                        <span>{m.nome}</span>
                        {!disabled && (
                            <button
                                type="button"
                                onClick={(e) => handleRemove(m.id, e)}
                                className="p-0.5 rounded-full hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </span>
                ))}

                {/* Input de Busca */}
                {!disabled && (
                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => {
                            setBusca(e.target.value);
                            if (!aberto) setAberto(true);
                        }}
                        onFocus={() => setAberto(true)}
                        placeholder={values.length === 0 ? placeholder : ""}
                        className="flex-1 min-w-[80px] bg-transparent border-none outline-none py-0.5 text-xs text-slate-800 placeholder-slate-400 font-semibold"
                    />
                )}

                {/* Controles de Ação à Direita */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                    {values.length > 0 && !disabled && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="p-1 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 pointer-events-none ${aberto ? "rotate-180" : ""}`} />
                </div>
            </div>

            {/* Dropdown Options */}
            {aberto && !disabled && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
                    {filtrados.length > 0 ? (
                        filtrados.map((m) => (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => handleSelect(m)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                <span>{m.nome}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                    Código: {m.codigo_ibge}
                                </span>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                            {municipios.length === 0 ? "Carregando municípios..." : "Nenhum município disponível"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
