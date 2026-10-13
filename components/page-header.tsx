import React from "react";

interface PageHeaderProps {
    preTitle?: string;
    title: string;
    description?: string;
    badges?: React.ReactNode;
    children?: React.ReactNode;
}

export default function PageHeader({ preTitle, title, description, badges, children }: PageHeaderProps) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200 mb-6 print:hidden">
            <div className="space-y-1">
                {preTitle && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                        {preTitle}
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                        {title}
                    </h1>
                    {badges}
                </div>
                {description && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
                        {description}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {children}
                </div>
            )}
        </section>
    );
}
