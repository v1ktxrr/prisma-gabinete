// lib/types.ts

/**
 * Representa as métricas extraídas via API de plataformas oficiais (Meta, GA4, etc)
 * atreladas a uma pauta publicada.
 */
export interface TaskMetrics {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
    reach?: number;
    saved?: number;
    local_thumbnail_url?: string;
    thumbnail_url?: string;
    // Index signature to allow future or dynamic metrics
    [key: string]: unknown;
}

/**
 * Representa a entidade bruta 'Task' no Banco de Dados (Supabase)
 */
export type TipoAgenda = 'GLOBAL' | 'COMUNICACAO';

export const MODULOS_ACESSO = [
    "agenda_global_ver",
    "agenda_global_editar",
    "agenda_global_presenca",
    "agenda_comunicacao_ver",
    "agenda_comunicacao_editar",
    "briefing_editar",
    "usuarios_gerenciar",
    "visao_geral_auditoria",
    "oficios_ver",
    "oficios_tramitar",
    "aniversariantes_gerenciar",
] as const;

export type ModuloAcesso = typeof MODULOS_ACESSO[number];

export interface Municipio {
    id: string;
    nome: string;
    codigo_ibge: string;
    criado_em?: string;
}

export interface Task {
    id: string;
    titulo: string;
    descricao?: string;
    status: 'pendente' | 'publicado';
    tipo_agenda?: TipoAgenda;
    event_type?: 'agenda_oficial' | 'aniversario_cidade' | 'data_comemorativa' | 'diversos';
    tema?: string;
    data_inicio?: string;
    data_fim?: string;
    atendimento_id?: string | null;
    municipio_id?: string | null;
    municipio_ids?: string[] | null;
    municipios?: { nome: string } | null;

    // Novas propriedades de Business Intelligence Analítico (Fase 4)
    post_url?: string;
    metrics_snapshot?: TaskMetrics;

    // Sprint 6: Autoria Múltipla e Classificação Estratégica
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
}

/**
 * Representa a entidade formatada para visualização (consumido pelo FullCalendar e Store)
 */
export interface CalendarioEvent {
    id: string;
    title: string;
    start: string | null;
    end: string | null;
    status: string;
    tipo_agenda?: TipoAgenda;
    event_type?: string;
    tema?: string;
    descricao?: string | null;
    created_by?: string | null;
    atendimento_id?: string | null;
    municipio_id?: string | null;
    municipio_ids?: string[] | null;

    // Novas propriedades atreladas na visualização de cache offline
    post_url?: string | null;
    metrics_snapshot?: TaskMetrics | null;

    // Sprint 6: Autoria Múltipla e Classificação Estratégica
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
}

export interface Atendimento {
    id: string;
    data: string;
    titulo: string;
    status: 'aberto' | 'em_andamento' | 'concluido' | 'arquivado';
    unidade_id: 'CG' | 'DD';
    criado_em: string;
    municipio_id?: string | null;
    municipios?: { nome: string } | null;
}

export interface Aniversariante {
    id: string;
    nome: string;
    cargo?: string | null;
    dia: number;
    mes: number;
    telefone?: string | null;
    cidade?: string | null;
    unidade_id: 'CG' | 'DD';
    criado_em: string;
    municipio_id?: string | null;
    municipios?: { nome: string } | null;
}


export interface Oficio {
    id: string;
    atendimento_id?: string | null;
    unidade_id: 'CG' | 'DD';
    numero: string;
    titulo: string;
    destinatario: string;
    status: 'pendente' | 'em_analise' | 'encaminhado' | 'concluido' | 'arquivado';
    data_emissao: string;
    prazo_resposta?: string | null;
    data_recebimento?: string | null;
    arquivo_url?: string | null;
    created_by: string;
    criado_em: string;
    atualizado_em: string;
    atendimentos?: {
        id: string;
        titulo: string;
    } | null;
}

export interface OficioHistorico {
    id: string;
    oficio_id: string;
    acao: string;
    descricao?: string | null;
    realizado_por: string;
    criado_em: string;
    profiles?: {
        nome: string;
        cargo?: string | null;
    } | null;
}

export interface Demanda {
    id: string;
    atendimento_id: string;
    municipio_id: string;
    solicitante: string;
    descricao: string;
    status: 'em_andamento' | 'entregue' | 'negado';
    unidade_id: 'CG' | 'DD';
    criado_em: string;
    atualizado_em: string;
    municipios?: { nome: string } | null;
}
