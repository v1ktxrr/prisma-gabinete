/**
 * pdf-fonts.ts
 * 
 * Utility to fetch and register Roboto font (Regular + Bold) with jsPDF
 * at runtime. This fixes the UTF-8 encoding bug where Portuguese accented
 * characters (á, é, ç, ã, õ, etc.) render as garbage in the default
 * Helvetica font embedded by jsPDF.
 *
 * Roboto is fetched from Google Fonts' CDN and converted to base64.
 */

// Google Fonts CDN direct TTF links for Roboto
const ROBOTO_REGULAR_URL = "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf";
const ROBOTO_BOLD_URL = "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuaabWmT.ttf";

/**
 * Fetches a TTF font from a URL and returns it as a base64 string
 * suitable for jsPDF's addFileToVFS.
 */
async function fetchFontAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch font from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Registers Roboto Regular and Bold fonts with the given jsPDF instance.
 * After calling this, you can use:
 *   pdf.setFont("Roboto", "normal")   — for regular text
 *   pdf.setFont("Roboto", "bold")     — for bold text
 */
export async function registerRobotoFont(pdf: any): Promise<void> {
    try {
        const [regularB64, boldB64] = await Promise.all([
            fetchFontAsBase64(ROBOTO_REGULAR_URL),
            fetchFontAsBase64(ROBOTO_BOLD_URL),
        ]);

        // Register Regular
        pdf.addFileToVFS("Roboto-Regular.ttf", regularB64);
        pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");

        // Register Bold
        pdf.addFileToVFS("Roboto-Bold.ttf", boldB64);
        pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");

        // Set as default
        pdf.setFont("Roboto", "normal");

        console.log("[PDF] Roboto font registered successfully.");
    } catch (err) {
        console.warn("[PDF] Failed to register Roboto font, falling back to Helvetica:", err);
        // If font fetch fails, Helvetica will remain as fallback
    }
}
