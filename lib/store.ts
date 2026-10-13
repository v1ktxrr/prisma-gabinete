import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { CalendarioEvent } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import type { TaskFormData } from '@/components/task-modal';

// Custom IndexedDB storage for Zustand
const idbStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};

export type ViewState = 'calendar' | 'reports' | 'profile';

export interface CidadeInsight {
    nome: string;
    views: number;
    percentual: number;
}

export interface AgeGenderInsight {
    faixa: string;
    genero: string;
    porcentagem: number;
}

export interface MetaInsights {
    viewsTotais: number;
    cidades: CidadeInsight[];
    idadeGenero: AgeGenderInsight[];
}

interface AppState {
    // Navigation
    currentView: ViewState;
    setView: (view: ViewState) => void;

    // Offline Data Cache
    eventsCache: CalendarioEvent[];
    setEventsCache: (events: CalendarioEvent[]) => void;
    atualizarDataPauta: (id: number | string, novaDataInicio: string, novaDataFim: string) => void;

    // Static Events Override State
    hiddenStaticEvents: string[];
    esconderEventoEstatico: (id: string) => void;

    // Sync Status
    lastSynced: number | null;
    setLastSynced: (timestamp: number) => void;
    isOfflineMode: boolean;
    setOfflineMode: (isOffline: boolean) => void;

    // Global Modal State
    taskModalOpen: boolean;
    taskModalData?: TaskFormData;
    openTaskModal: (data?: TaskFormData) => void;
    closeTaskModal: () => void;

    // Meta Insights
    metaInsights: MetaInsights | null;
    isLoadingMeta: boolean;
    fetchMetaInsights: (dataInicio?: string, dataFim?: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            currentView: 'calendar',
            setView: (view) => set({ currentView: view }),

            eventsCache: [],
            setEventsCache: (events) => set({ eventsCache: events }),
            atualizarDataPauta: (id, novaDataInicio, novaDataFim) => set((state) => ({
                eventsCache: state.eventsCache.map((ev) =>
                    String(ev.id) === String(id)
                        ? { ...ev, start: novaDataInicio, end: novaDataFim }
                        : ev
                )
            })),

            hiddenStaticEvents: [],
            esconderEventoEstatico: (id) => set((state) => ({
                hiddenStaticEvents: [...state.hiddenStaticEvents, id]
            })),

            lastSynced: null,
            setLastSynced: (timestamp) => set({ lastSynced: timestamp }),

            isOfflineMode: false,
            setOfflineMode: (isOffline) => set({ isOfflineMode: isOffline }),

            taskModalOpen: false,
            taskModalData: undefined,
            openTaskModal: (data) => set({ taskModalOpen: true, taskModalData: data, currentView: 'calendar' }),
            closeTaskModal: () => set({ taskModalOpen: false, taskModalData: undefined }),

            metaInsights: null,
            isLoadingMeta: false,
            fetchMetaInsights: async (dataInicio?: string, dataFim?: string) => {
                set({ isLoadingMeta: true });
                try {
                    // 1. Demografia e Alcance
                    let insightsQuery = supabase
                        .from('instagram_account_insights')
                        .select('audience_city, total_reach, audience_gender_age, impressions')
                        .order('fetched_at', { ascending: false })
                        .limit(1);

                    if (dataInicio && dataFim) {
                        insightsQuery = insightsQuery
                            .gte('fetched_at', `${dataInicio} 00:00:00`)
                            .lte('fetched_at', `${dataFim} 23:59:59`);
                    }

                    let { data: insightsData } = await insightsQuery.maybeSingle();

                    // UX Fallback Elegante: Se não houver dados de audiência exatamente naquela janela (ex: mês passado),
                    // tenta buscar a última 'foto' gravada do Instagram (o snapshot mais próximo ou o atual).
                    // Evita "Nenhum dado" caso a rotina do Supabase cron só tenha rodado depois.
                    if (!insightsData && dataInicio && dataFim) {
                        const { data: fallbackData } = await supabase
                            .from('instagram_account_insights')
                            .select('audience_city, total_reach, audience_gender_age, impressions')
                            .lte('fetched_at', `${dataFim} 23:59:59`) // Tenta a data mais próxima até fim do período
                            .order('fetched_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        insightsData = fallbackData;

                        // Se historicamente antes também não tinha nada, exiba a mais fresca possível
                        if (!insightsData) {
                            const { data: ultimateFallback } = await supabase
                                .from('instagram_account_insights')
                                .select('audience_city, total_reach, audience_gender_age, impressions')
                                .order('fetched_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();
                            insightsData = ultimateFallback;
                        }
                    }

                    let cidades: CidadeInsight[] = [];
                    if (insightsData && insightsData.audience_city) {
                        const audienceObj = insightsData.audience_city as Record<string, number>;
                        const totalCitiesViews = Object.values(audienceObj).reduce((sum, val) => sum + val, 0);

                        cidades = Object.entries(audienceObj)
                            .map(([nome, views]) => ({
                                nome,
                                views: Number(views),
                                percentual: totalCitiesViews > 0 ? Number(((Number(views) / totalCitiesViews) * 100).toFixed(1)) : 0
                            }))
                            .sort((a, b) => b.views - a.views)
                            .slice(0, 5);
                    }

                    // Age / Gender Processing (F.18-24 -> Mulheres 18-24)
                    let idadeGenero: AgeGenderInsight[] = [];
                    if (insightsData && insightsData.audience_gender_age) {
                        const ageObj = insightsData.audience_gender_age as Record<string, number>;
                        const totalAgeViews = Object.values(ageObj).reduce((sum, val) => sum + val, 0);

                        idadeGenero = Object.entries(ageObj)
                            .map(([key, views]) => {
                                const [genderRaw, ageRange] = key.split('.');
                                const generoStr = genderRaw === 'F' ? 'Mulheres' : genderRaw === 'M' ? 'Homens' : 'Outro';
                                return {
                                    faixa: ageRange,
                                    genero: generoStr,
                                    porcentagem: totalAgeViews > 0 ? Number(((Number(views) / totalAgeViews) * 100).toFixed(1)) : 0
                                };
                            })
                            .sort((a, b) => b.porcentagem - a.porcentagem) // top demographics
                            .slice(0, 4); // show top 4
                    }

                    // Total Reach / Views directly from account insights, no task looping!
                    let viewsTotais = 0;
                    if (insightsData && Array.isArray(insightsData) === false) {
                        // Assuming new backend might map global insights to `total_reach`
                        viewsTotais = insightsData.total_reach || insightsData.impressions || 0;
                    }

                    set({ metaInsights: { viewsTotais, cidades, idadeGenero }, isLoadingMeta: false });
                } catch (err) {
                    console.error('Erro ao buscar insights da Meta:', err);
                    // Opcionalmente manter os dados velhos, ou limpar: se falhar, tenta manter o UI suave.
                    set({ isLoadingMeta: false });
                }
            },
        }),
        {
            name: 'gabinete-storage', // unique name
            storage: createJSONStorage(() => idbStorage),
        }
    )
);
