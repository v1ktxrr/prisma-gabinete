export type AutoridadeItem = {
    nome: string;
    cargo: string;
};

export type CronogramaItem = {
    horario: string;
    acao: string;
};

export type BlocoCustomizado = {
    id: string;
    titulo: string;
    conteudo_html: string;
    sigiloso: boolean;
};

export type TipoLocalidade = "INTERIOR" | "CAPITAL";

export type BriefingFormValues = {
    tipo_localidade: TipoLocalidade;
    titulo_customizado: string;
    data_customizada: string;
    hora_customizada: string;
    local_customizado: string;
    municipio_id: string | null;
    organizacao: string;
    contato_local: string;
    traje: string;
    apoio_governo_ms: string;
    autoridades: AutoridadeItem[];
    cronograma: CronogramaItem[];
    blocos_customizados: BlocoCustomizado[];
    status: "RASCUNHO" | "FINALIZADO";
    atendimento_id?: string | null;
};

export function gerarIdBloco() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `bloco_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getDefaultContentBlocks(): BlocoCustomizado[] {
    return [
        {
            id: gerarIdBloco(),
            titulo: "Contexto Geral do Evento",
            conteudo_html: "",
            sigiloso: false,
        },
        {
            id: gerarIdBloco(),
            titulo: "Destaques do MS / Protagonismo",
            conteudo_html: "",
            sigiloso: false,
        },
        {
            id: gerarIdBloco(),
            titulo: "Informações Confidenciais",
            conteudo_html: "",
            sigiloso: true,
        },
    ];
}

export function getEmptyBriefingValues(): BriefingFormValues {
    return {
        tipo_localidade: "INTERIOR",
        titulo_customizado: "",
        data_customizada: "",
        hora_customizada: "",
        local_customizado: "",
        municipio_id: null,
        organizacao: "",
        contato_local: "",
        traje: "",
        apoio_governo_ms: "",
        autoridades: [],
        cronograma: [],
        blocos_customizados: getDefaultContentBlocks(),
        status: "RASCUNHO",
        atendimento_id: null,
    };
}
