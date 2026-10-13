"use client";

import { useEffect, useState, useRef } from "react";
import { Search, X, ChevronDown, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Municipio } from "@/lib/types";

// Promessa de cache estático em nível de módulo para buscar os municípios apenas uma vez
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
                municipiosCachePromise = null; // reseta para permitir retentativa se falhar
                throw error;
            }
            return (data as Municipio[]) || [];
        });
    }
    return municipiosCachePromise;
}

interface MunicipioAutocompleteProps {
    value?: string | null; // municipio_id selecionado
    onChange: (id: string | null, nome: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export default function MunicipioAutocomplete({
    value,
    onChange,
    disabled = false,
    placeholder = "Selecione um município...",
    className = "",
    required = false
}: MunicipioAutocompleteProps) {
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState("");
    const [aberto, setAberto] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Efeito para buscar a lista de municípios
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

    // Localizar o município selecionado para exibir no input
    const selecionado = municipios.find((m) => m.id === value);

    // Sincronizar texto de busca com o nome selecionado quando fechado
    useEffect(() => {
        if (!aberto) {
            setBusca(selecionado ? selecionado.nome : "");
        }
    }, [selecionado, aberto]);

    // Filtrar municípios em tempo real
    const filtrados = municipios.filter((m) =>
        m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .includes(busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        function cliqueFora(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setAberto(false);
            }
        }
        document.addEventListener("mousedown", cliqueFora);
        return () => document.removeEventListener("mousedown", cliqueFora);
    }, []);

    const handleSelect = (m: Municipio) => {
        onChange(m.id, m.nome);
        setBusca(m.nome);
        setAberto(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, null);
        setBusca("");
        setAberto(false);
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative">
                <input
                    type="text"
                    disabled={disabled}
                    required={required && !value}
                    value={busca}
                    onChange={(e) => {
                        setBusca(e.target.value);
                        if (!aberto) setAberto(true);
                    }}
                    onFocus={() => {
                        if (!disabled) {
                            setAberto(true);
                            setBusca(""); // Limpa o texto ao focar para facilitar busca
                        }
                    }}
                    placeholder={placeholder}
                    className={`w-full rounded-xl border border-slate-250 bg-white px-3.5 py-2 pl-9 pr-14 text-xs font-semibold text-slate-800 outline-none transition-all focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50 disabled:opacity-60 ${
                        disabled ? "cursor-not-allowed" : "cursor-text"
                    }`}
                />
                
                {/* Ícone de Pino à esquerda */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {carregando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <MapPin className="h-3.5 w-3.5" />
                    )}
                </span>

                {/* Controles à direita */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-0.5 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 pointer-events-none ${aberto ? "rotate-180" : ""}`} />
                </div>
            </div>

            {/* Dropdown de opções */}
            {aberto && !disabled && (
                <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
                    {filtrados.length > 0 ? (
                        filtrados.map((m) => (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => handleSelect(m)}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors ${
                                    m.id === value
                                        ? "bg-slate-900 text-white"
                                        : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <span>{m.nome}</span>
                                <span className={`text-[10px] ${m.id === value ? "text-slate-300" : "text-slate-400 font-normal"}`}>
                                    Código: {m.codigo_ibge}
                                </span>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                            Nenhum município encontrado
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
