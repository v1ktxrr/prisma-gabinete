export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        // List of typical buckets in Prisma
        const buckets = ["comprovantes", "avatares"];
        
        const storageStats = await Promise.all(buckets.map(async (bucket) => {
            // This is a naive way to get stats. In a huge bucket, list() limits to 100 or paginates.
            // For MVP root cockpit, we list up to 1000 files to get an estimate.
            const { data, error } = await supabaseAdmin.storage.from(bucket).list("", {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

            if (error) {
                return { bucket, error: error.message };
            }

            // Exclude placeholders like .emptyFolderPlaceholder
            const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder' && f.metadata);
            
            const totalBytes = validFiles.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
            const totalFiles = validFiles.length;

            return {
                bucket,
                totalBytes,
                totalFiles,
                sampleFiles: validFiles.slice(0, 5) // Show top 5 recent/first files for diagnostic
            };
        }));

        return NextResponse.json(storageStats);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
