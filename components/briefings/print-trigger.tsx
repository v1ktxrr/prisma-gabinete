"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export default function PrintTrigger({ fileName }: { fileName: string }) {
    const [printing, setPrinting] = useState(false);

    const handlePrint = () => {
        const previousTitle = document.title;
        setPrinting(true);
        document.title = fileName.replace(/\.pdf$/i, "");

        window.setTimeout(() => {
            window.print();
            window.setTimeout(() => {
                document.title = previousTitle;
                setPrinting(false);
            }, 600);
        }, 100);
    };

    return (
        <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 print:hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {printing ? "Gerando PDF..." : "Gerar PDF Oficial"}
        </button>
    );
}
