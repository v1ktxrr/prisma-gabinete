export interface MetaMetrics {
    totalAlcance: number;
    totalEngajamento: number;
}

export interface TopPost {
    id: string;
    titulo: string;
    alcance: number;
    curtidas: number;
    share: number;
    thumbnail: string;
}

/**
 * Funções Mock para a Graph API da META (Instagram/Facebook).
 * No futuro, substituir essas funções por chamadas reais usando:
 * fetch(`https://graph.facebook.com/v19.0/${process.env.META_IG_USER_ID}/media?access_token=${process.env.META_ACCESS_TOKEN}`)
 */

export async function getMetaMetrics(): Promise<MetaMetrics> {
    // Simulando delay de rede
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
        totalAlcance: 245100, // 245k
        totalEngajamento: 18450, // 18.4k
    };
}

export async function getTopPosts(): Promise<TopPost[]> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    return [
        {
            id: "mp_01",
            titulo: "Inauguração da Nova Ponte no Interior",
            alcance: 45200,
            curtidas: 3200,
            share: 450,
            thumbnail: "🌉",
        },
        {
            id: "mp_02",
            titulo: "Programa Jovem Aprendiz Estadual - Abertura",
            alcance: 38100,
            curtidas: 2800,
            share: 620,
            thumbnail: "📚",
        },
        {
            id: "mp_03",
            titulo: "Entrevista Coletiva: Balanço da Segurança",
            alcance: 29500,
            curtidas: 1540,
            share: 210,
            thumbnail: "🎙️",
        },
    ];
}
