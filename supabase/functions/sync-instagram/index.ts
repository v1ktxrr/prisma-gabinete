// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Tratamento de CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { task_id, post_url } = await req.json();

        if (!task_id || !post_url) {
            throw new Error('task_id and post_url are required parameters.');
        }

        console.log(`[HÍBRIDO] Iniciando Arquitetura de Merge (Meta + Apify). Task: ${task_id} | URL: ${post_url}`);

        // --- 3. AUTENTICAÇÃO DUPLA VIA DENO.ENV ---
        const META_PAGE_ID = Deno.env.get('META_PAGE_ID');
        const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
        const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');

        if (!META_PAGE_ID || !META_ACCESS_TOKEN || !APIFY_API_TOKEN) {
             throw new Error('Chaves de ambiente ausentes. Verifique META_PAGE_ID, META_ACCESS_TOKEN e APIFY_API_TOKEN.');
        }

        // Recuperar snapshot anterior
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: existingTask, error: fetchError } = await supabase
            .from('tasks')
            .select('metrics_snapshot')
            .eq('id', task_id)
            .single();

        const existingMetrics = existingTask?.metrics_snapshot || {};

        // Extração do shortcode
        const shortcodeMatch = post_url.match(/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        const shortcode = shortcodeMatch ? shortcodeMatch[1] : '';

        if (!shortcode) {
             throw new Error('Não foi possível extrair o shortcode da URL fornecida.');
        }

        console.log(`Disparando APIs em Paralelo (Shortcode: ${shortcode})`);

        // --- FUNÇÃO META (LIKES, COMMENTS, INSIGHTS PRIVADOS) ---
        const fetchMeta = async () => {
            const graphApiUrl = `https://graph.facebook.com/v20.0/${META_PAGE_ID}?fields=instagram_business_account{media.limit(100){id,shortcode,media_url,thumbnail_url,media_type,media_product_type,like_count,comments_count,play_count}}&access_token=${META_ACCESS_TOKEN}`;
            const metaRes = await fetch(graphApiUrl);
            
            if (!metaRes.ok) {
                const text = await metaRes.text();
                throw new Error(`Erro Meta API HTTP ${metaRes.status}: ${text}`);
            }
            
            const metaJson = await metaRes.json();
            const mediaList = metaJson.instagram_business_account?.media?.data || [];
            const mediaItem = mediaList.find((item: any) => item.shortcode === shortcode);
            
            if (!mediaItem) {
                throw new Error(`Mídia com shortcode '${shortcode}' não encontrada na conta vinculada da Meta.`);
            }
            
            // Tenta buscar as métricas privadas (Reach, Saves, Shares)
            let reach = existingMetrics.reach ?? null;
            let saves = existingMetrics.saves ?? null;
            let shares = existingMetrics.shares ?? null;
            let fallback_views = mediaItem.play_count || 0;

            try {
                // Tenta buscar "reach", "saved", "shares", "views", "crossposted_views" e "facebook_views" agrupados.
                const insightsUrl = `https://graph.facebook.com/v20.0/${mediaItem.id}/insights?metric=reach,saved,shares,views,crossposted_views,facebook_views&access_token=${META_ACCESS_TOKEN}`;
                const insightsRes = await fetch(insightsUrl);
                if (insightsRes.ok) {
                    const insightsData = await insightsRes.json();
                    const dataArray = insightsData.data || [];
                    
                    const reachObj = dataArray.find((d: any) => d.name === 'reach');
                    const savedObj = dataArray.find((d: any) => d.name === 'saved');
                    const sharesObj = dataArray.find((d: any) => d.name === 'shares');
                    const viewsObj = dataArray.find((d: any) => d.name === 'views');
                    const crosspostedObj = dataArray.find((d: any) => d.name === 'crossposted_views');
                    const fbViewsObj = dataArray.find((d: any) => d.name === 'facebook_views');

                    if (reachObj?.values?.[0]?.value !== undefined) reach = reachObj.values[0].value;
                    if (savedObj?.values?.[0]?.value !== undefined) saves = savedObj.values[0].value;
                    if (sharesObj?.values?.[0]?.value !== undefined) shares = sharesObj.values[0].value;
                    
                    // Se as métricas novas de views retornarem valores válidos e maiores, atualiza o fallback_views
                    const metaViews = viewsObj?.values?.[0]?.value || 0;
                    const crosspostedViews = crosspostedObj?.values?.[0]?.value || 0;
                    const fbViews = fbViewsObj?.values?.[0]?.value || 0;
                    
                    const maxMetaViews = Math.max(fallback_views, metaViews, crosspostedViews, fbViews);
                    if (maxMetaViews > 0) {
                        fallback_views = maxMetaViews;
                    }
                } else {
                    const errText = await insightsRes.text();
                    console.error("Insights API returned error:", errText);
                }
            } catch (err) {
                console.warn("Falha opcional ao buscar Insights privados da Meta, preservando os antigos do Banco.", err.message);
            }

            return { mediaItem, reach, saves, shares, fallback_views };
        };

        // --- FUNÇÃO APIFY (PLAYS APENAS) ---
        // Se a chamada da Apify falhar ou der timeout longo no plano grátis, não queremos comprometer os Likes e Comments
        const fetchApify = async () => {
            const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos anti-timeout (Apify Scraper leva ~35s)
            
            try {
                const scraperResponse = await fetch(apifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        directUrls: [post_url],
                        resultsType: "details",
                        proxyConfiguration: {
                            useApifyProxy: true,
                            apifyProxyGroups: ["RESIDENTIAL"]
                        }
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (!scraperResponse.ok) {
                    throw new Error(`Apify retornou Status ${scraperResponse.status}`);
                }
                const dataArray = await scraperResponse.json();
                return Array.isArray(dataArray) ? dataArray[0] : dataArray;
            } catch (err) {
                console.warn("[⚠️ APIFY FALLBACK] Falha ou lentidão do Apify abortada:", err.message);
                return null; // Retorna nulo disparando fallback transparente para as Views
            }
        };

        // --- 1. REQUISIÇÕES EM PARALELO (PROMISE.ALL) ---
        const [metaData, apifyData] = await Promise.all([
            fetchMeta(), // Essencial: Se falhar, quebra o try-catch inteiro.
            fetchApify() // Opcional/Robusto: Retorna null em caso de erro.
        ]);

        const { mediaItem, reach, saves, shares, fallback_views } = metaData;

        // Prioriza Apify para contagem de likes e comentários combinados em Collabs, usa Meta API apenas como fallback
        const isValidApify = apifyData && Object.keys(apifyData).length > 0 && (!apifyData.error || apifyData.error === 'restricted_page');
        
        let likes = mediaItem.like_count || 0;
        if (isValidApify && typeof apifyData.likesCount === 'number' && apifyData.likesCount >= 0) {
            likes = apifyData.likesCount;
        }
        likes = Math.max(0, likes); // Previne -1 caso curtidas estejam ocultadas no app
            
        let comments = mediaItem.comments_count || 0;
        if (isValidApify && typeof apifyData.commentsCount === 'number' && apifyData.commentsCount >= 0) {
            comments = apifyData.commentsCount;
        }
        comments = Math.max(0, comments);
            
        let views = 0;
        let apifyUsed = false;
        
        const isVideo = (mediaItem.media_type === 'VIDEO' || mediaItem.media_product_type === 'REELS');
        
        let apifyTotal = 0;
        if (isVideo && apifyData && Object.keys(apifyData).length > 0 && (!apifyData.error || apifyData.error === 'restricted_page')) {
            const apifyPlays = apifyData.videoPlayCount || 0;
            const apifyViews = apifyData.videoViewCount || 0;
            
            if (apifyPlays > 0 || apifyViews > 0) {
                apifyTotal = apifyPlays + apifyViews;
            } else {
                apifyTotal = apifyData.viewCount || 0;
            }
            apifyUsed = true;
        }

        const metaTotal = fallback_views || 0;
        
        // Atendendo à nova priorização absoluta: Puxar SEMPRE o MAIOR número disponível das duas APIs.
        views = Math.max(apifyTotal, metaTotal);

        console.log(`RESULTADO DE FUSÃO -> Likes: ${likes} | Comments: ${comments} | Views: ${views} (Apify: ${apifyTotal}, Meta: ${metaTotal}) | Reach: ${reach} | Saves: ${saves} | Shares: ${shares}`);

        // Download da Thumbnail
        let localThumbnailUrl = existingMetrics.local_thumbnail_url || null;
        let targetUrl = mediaItem.media_type === 'VIDEO' ? mediaItem.thumbnail_url : mediaItem.media_url;
        
        if (!targetUrl && apifyData) {
            targetUrl = apifyData.displayUrl || apifyData.thumbnailUrl;
        }

        if (targetUrl) {
            try {
                const imageResponse = await fetch(targetUrl);
                if (imageResponse.ok) {
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    const fileName = `task-${task_id}.jpg`;
                    const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, arrayBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });
                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName);
                        localThumbnailUrl = publicUrl;
                    }
                }
            } catch (err) {
                 console.warn("Falha ao salvar thumbnail via proxy.", err.message);
            }
        }

        // Build Final e Update
        const finalMetricsSnapshot = {
            ...existingMetrics,
            likes: likes,
            comments: comments,
            views: views,
            reach: reach,
            saves: saves,
            shares: shares,
            local_thumbnail_url: localThumbnailUrl,
            audit_flags: {
                is_scraped: apifyUsed,
                hybrid_merge: true,
                media_type: isVideo ? 'VIDEO' : 'IMAGE/CAROUSEL'
            }
        };

        const updateResponse = await supabase
            .from('tasks')
            .update({ metrics_snapshot: finalMetricsSnapshot })
            .eq('id', task_id)
            .select();

        if (updateResponse.error) {
            throw new Error(`Erro atualizar Banco (Supabase): ${updateResponse.error.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Merge Híbrido Finalizado! (Meta Core + Apify Views)',
                metrics: finalMetricsSnapshot
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        // Se a Meta API falhar (Ex: shortcode errado, etc) ela joga o erro aqui
        console.error("Erro Detectado na Edge Function (Arquitetura Híbrida):", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
