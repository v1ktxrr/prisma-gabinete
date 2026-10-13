export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess } from "@/lib/dev-auth";

const DB_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB (1024 MB)

export async function GET() {
    try {
        const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
        if (!authorized || !supabaseAdmin) return errorResponse;

        // 1. Obter tamanho do banco de dados e tabelas
        const { data: dbSize, error: dbSizeError } = await supabaseAdmin.rpc("obter_tamanho_banco");
        if (dbSizeError) {
            return NextResponse.json({ error: "Erro ao obter tamanho do banco: " + dbSizeError.message }, { status: 500 });
        }

        const { data: tablesData, error: tablesError } = await supabaseAdmin.rpc("obter_tamanho_tabelas");
        if (tablesError) {
            return NextResponse.json({ error: "Erro ao obter tamanho das tabelas: " + tablesError.message }, { status: 500 });
        }

        // 2. Obter tamanho do storage
        const buckets = ["comprovantes", "avatares"];
        let storageTotalBytes = 0;
        const bucketStats = [];

        for (const bucket of buckets) {
            const { data, error } = await supabaseAdmin.storage.from(bucket).list("", {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

            if (error) {
                bucketStats.push({ bucket, error: error.message, size_bytes: 0, total_files: 0 });
                continue;
            }

            const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder' && f.metadata);
            const sizeBytes = validFiles.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
            storageTotalBytes += sizeBytes;

            bucketStats.push({
                bucket,
                size_bytes: sizeBytes,
                total_files: validFiles.length
            });
        }

        // 3. Calcular percentual de ocupação
        const dbPercent = (Number(dbSize) / DB_LIMIT_BYTES) * 100;
        const storagePercent = (storageTotalBytes / STORAGE_LIMIT_BYTES) * 100;

        // 4. Projetar forecast financeiro
        let planForecast = "Seu consumo está abaixo de 85% dos limites do plano gratuito. Recomendado manter plano gratuito.";
        let recommendation = "Manter Free Tier";
        let upgradeRequired = false;

        if (dbPercent > 85 || storagePercent > 85) {
            planForecast = "Atenção: O consumo de banco de dados ou armazenamento de arquivos superou 85% da cota gratuita. É recomendável realizar a transição para o Pro Tier ($25/mês) para evitar lentidão ou bloqueios de gravação.";
            recommendation = "Transição para o Pro Tier ($25/mês)";
            upgradeRequired = true;
        }

        return NextResponse.json({
            database: {
                size_bytes: Number(dbSize),
                limit_bytes: DB_LIMIT_BYTES,
                percent_used: dbPercent,
                tables: tablesData || []
            },
            storage: {
                total_bytes: storageTotalBytes,
                limit_bytes: STORAGE_LIMIT_BYTES,
                percent_used: storagePercent,
                buckets: bucketStats
            },
            billing: {
                current_plan: "Free Tier",
                forecast: planForecast,
                recommendation: recommendation,
                upgrade_suggested: upgradeRequired
            }
        });
    } catch (error: any) {
        console.error("[deviktor-storage-metrics] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message }, { status: 500 });
    }
}
