export interface Ga4Metrics {
    totalAcessosSite: number;
    acessosUnicos: number;
}

/**
 * Funções Mock para o Google Analytics 4 (Data API v1beta).
 * No futuro, substituir por chamadas à API real usando:
 * const analyticsDataClient = new BetaAnalyticsDataClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) })
 */

export async function getGa4Metrics(): Promise<Ga4Metrics> {
    // Simulando delay de rede
    await new Promise((resolve) => setTimeout(resolve, 700));

    return {
        totalAcessosSite: 125430, // 125k visualizações de página
        acessosUnicos: 89000,    // 89k usuários únicos
    };
}
