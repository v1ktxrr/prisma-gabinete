"use client";

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { CalendarioEvent } from "@/lib/types";

export default function BuscaGlobal() {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { eventsCache, openTaskModal } = useAppStore();

    const closeSearch = () => {
        setIsOpen(false);
        setSearchQuery("");
    };

    // Atalho de Teclado (Cmd+K ou Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape") {
                setIsOpen(false);
                setSearchQuery("");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Focar no input quando abrir
    useEffect(() => {
        if (isOpen) {
            document.getElementById("busca-global-input")?.focus();
        }
    }, [isOpen]);

    // Lógica de Filtragem
    const resultados = useMemo(() => {
        if (!searchQuery.trim()) return [];

        const term = searchQuery.toLowerCase();
        return eventsCache.filter((ev: CalendarioEvent) => {
            const matchTitle = ev.title?.toLowerCase().includes(term);
            const matchTema = ev.tema?.toLowerCase().includes(term);
            const matchTipo = ev.event_type?.toLowerCase().includes(term);
            const matchDesc = ev.descricao?.toLowerCase().includes(term);
            return matchTitle || matchTema || matchTipo || matchDesc;
        });
    }, [searchQuery, eventsCache]);

    if (!isOpen) return null;

    // Formatador nativo de data brasileiro
    const formatadorBR = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    return (
        <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[99999] flex justify-center items-start pt-[10vh]"
            onClick={closeSearch} // Fecha ao clicar fora
        >
            <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mx-4"
                onClick={(e) => e.stopPropagation()} // Impede que o clique dentro feche o modal
            >
                {/* Input de Busca */}
                <div className="relative border-b border-slate-100 flex items-center">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
                    <input
                        id="busca-global-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar pautas, temas ou tipos"
                        className="w-full bg-transparent pl-14 pr-5 py-5 text-lg text-slate-800 placeholder-slate-400 outline-none"
                        autoComplete="off"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
                        <kbd className="bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-400 font-sans font-medium hover:bg-slate-200 cursor-pointer transition-colors" onClick={closeSearch}>ESC</kbd>
                    </div>
                </div>

                {/* Área de Resultados */}
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {searchQuery.trim() && resultados.length === 0 ? (
                        <div className="py-14 text-center">
                            <p className="text-slate-400 text-sm">
                                Nenhuma pauta para &quot;<span className="font-medium text-slate-600">{searchQuery}</span>&quot;
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {resultados.map((ev: CalendarioEvent) => (
                                <div
                                    key={ev.id}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer active:scale-[0.98] transition-all"
                                    onClick={() => {
                                        closeSearch();
                                        openTaskModal({
                                            id: ev.id,
                                            titulo: ev.title,
                                            descricao: ev.descricao || "",
                                            status: ev.status || "pendente",
                                            event_type: ev.event_type || "agenda_oficial",
                                            tema: ev.tema || "",
                                            data_inicio: ev.start || "",
                                            post_url: ev.post_url || "",
                                            tipo_agenda: ev.tipo_agenda || "COMUNICACAO",
                                        });
                                    }}
                                >
                                    <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                        <h4 className="text-sm font-bold text-slate-700 truncate">{ev.title}</h4>
                                        <span className="text-xs text-slate-400 truncate">
                                            {ev.start ? formatadorBR.format(new Date(ev.start)) : "Sem data"}
                                        </span>
                                    </div>

                                    {(ev.tema || ev.event_type) && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            {ev.tema && (
                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-semibold border border-blue-100 lowercase">
                                                    #{ev.tema}
                                                </span>
                                            )}
                                            {ev.event_type && (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-semibold border border-slate-200 lowercase">
                                                    {ev.event_type.replace(/_/g, " ")}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {!searchQuery.trim() && (
                                <div className="py-10 text-center">
                                    <p className="text-sm text-slate-400">Digite para buscar pautas e planejamentos.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
