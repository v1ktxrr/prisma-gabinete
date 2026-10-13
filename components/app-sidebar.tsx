"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    CalendarDays,
    ClipboardPlus,
    FileText,
    LayoutDashboard,
    Megaphone,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    Mail,
    Settings,
    Contact,
    Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";

interface AppSidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
}

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
};

function formatCargo(cargo: string | null) {
    if (!cargo) return "Perfil sem cargo";

    return cargo
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AppSidebar({
    isCollapsed,
    onToggleCollapse,
    isMobileOpen,
    onCloseMobile,
}: AppSidebarProps) {
    const pathname = usePathname();
    const { profile, signOut } = useAuth();
    const { hasModule, unidadeId } = usePermissions();
    const { cargo } = useUserRole();
    const canAccessCommunication =
        hasModule("agenda_comunicacao_ver") || hasModule("agenda_comunicacao_editar");
    const canAccessOficios =
        cargo === "chefia" || hasModule("oficios_ver") || hasModule("oficios_tramitar");

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        "Principal": true,
        "Operacional": true,
        "Comunicação": true,
    });

    useEffect(() => {
        const saved = localStorage.getItem("prisma-sidebar-open-groups");
        if (saved) {
            try {
                setOpenGroups(JSON.parse(saved));
            } catch (e) {
                console.error("Erro ao carregar openGroups do localStorage:", e);
            }
        }
    }, []);

    const toggleGroup = (title: string) => {
        setOpenGroups((prev: Record<string, boolean>) => {
            const next = { ...prev, [title]: !prev[title] };
            localStorage.setItem("prisma-sidebar-open-groups", JSON.stringify(next));
            return next;
        });
    };

    const initials = profile?.nome
        ? profile.nome
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?";

    const groups: {
        title: string;
        items: NavItem[];
    }[] = [
        {
            title: "Principal",
            items: [
                {
                    href: "/dashboard",
                    label: "Painel de Decisão",
                    icon: LayoutDashboard,
                    visible: true,
                },
                {
                    href: "/pre-agenda",
                    label: "Pré-Agenda",
                    icon: CalendarDays,
                    visible: hasModule("agenda_global_ver"),
                },
                {
                    href: "/agenda-oficial",
                    label: "Agenda Oficial",
                    icon: CalendarDays,
                    visible: cargo === "chefia" || cargo === "secretaria" || cargo === "comunicacao" || hasModule("agenda_global_ver"),
                },
            ],
        },
        {
            title: "Operacional",
            items: [
                {
                    href: "/visao-geral",
                    label: "Raio-X do Gabinete",
                    icon: ShieldCheck,
                    visible: cargo === "chefia" || hasModule("visao_geral_auditoria"),
                },
                {
                    href: "/relatorios-desempenho",
                    label: "Relatórios",
                    icon: FileText,
                    visible: cargo === "chefia" || cargo === "secretaria" || cargo === "comunicacao" || hasModule("visao_geral_auditoria"),
                },
                {
                    href: "/contatos",
                    label: "Contatos",
                    icon: Contact,
                    visible: cargo === "chefia" || cargo === "secretaria" || cargo === "comunicacao" || hasModule("aniversariantes_gerenciar"),
                },
                {
                    href: "/atendimentos",
                    label: "Atendimentos",
                    icon: Layers,
                    visible: true,
                },
                {
                    href: "/agenda",
                    label: "Meus Registros",
                    icon: ClipboardPlus,
                    visible: cargo === "assessoria",
                },
                {
                    href: "/oficios",
                    label: "Ofícios",
                    icon: Mail,
                    visible: canAccessOficios,
                },
            ],
        },
        {
            title: "Comunicação",
            items: [
                {
                    href: "/briefings",
                    label: "Briefings",
                    icon: FileText,
                    visible:
                        hasModule("agenda_comunicacao_ver") ||
                        hasModule("briefing_editar") ||
                        hasModule("agenda_comunicacao_editar"),
                },
                {
                    href: "/agenda-comunicacao",
                    label: "Atividades",
                    icon: Megaphone,
                    visible: canAccessCommunication,
                },
            ],
        },
    ];

    // Filter groups and items that are visible
    const visibleGroups = groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.visible),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <aside
            className={`fixed top-0 bottom-0 left-0 z-50 h-screen shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between transition-all duration-300 ease-in-out
                lg:sticky lg:z-10 lg:shadow-none lg:translate-x-0
                ${isCollapsed ? "lg:w-[78px] px-3 py-6" : "lg:w-[280px] px-5 py-6"}
                ${isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
        >
            {/* Toggle Button for Desktop Collapse */}
            <button
                type="button"
                onClick={onToggleCollapse}
                className="absolute -right-3 top-8 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-950 active:scale-95 lg:flex z-25 cursor-pointer"
                aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
                {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                )}
            </button>

            {/* Top section: Brand / Logo */}
            <div className="flex flex-col">
                <div className={`flex items-center gap-3 mb-6 ${isCollapsed ? "justify-center px-1" : "px-2"}`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-transparent shadow-xs transition-transform hover:scale-105">
                        <img src="/icone-prisma.png" alt="Prisma" className="h-9 w-9 object-contain" />
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-500 truncate">
                                Prisma
                            </p>
                            <h1 className="text-base font-black tracking-tight text-slate-950 truncate">
                                Gabinete Virtual
                            </h1>
                        </div>
                    )}
                </div>

                {/* Scope Badge (Unidade) in Expanded mode */}
                {!isCollapsed && unidadeId && (
                    <div className="mb-6 px-2">
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                            {`Unidade ${unidadeId}`}
                        </div>
                    </div>
                )}

                {/* Navigation Menu */}
                <nav aria-label="Navegação principal" className="flex flex-col gap-5">
                    {visibleGroups.map((group, gIdx) => (
                        <div key={group.title} className="flex flex-col gap-1.5">
                            {/* Group Title */}
                            {!isCollapsed ? (
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.title)}
                                    className="group/btn flex w-full items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 mt-2 mb-1 cursor-pointer outline-none transition-colors text-left"
                                >
                                    <span>{group.title}</span>
                                    {openGroups[group.title] !== false ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-slate-600 transition-transform duration-200" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover/btn:text-slate-600 transition-transform duration-200" />
                                    )}
                                </button>
                            ) : (
                                gIdx > 0 && <div className="h-px bg-slate-100 my-2 mx-2" />
                            )}

                            {(isCollapsed || openGroups[group.title] !== false) &&
                                group.items.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                                    const Icon = item.icon;

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onCloseMobile}
                                            aria-current={isActive ? "page" : undefined}
                                            className={`group/item relative flex items-center gap-3 rounded-2xl transition-all cursor-pointer ${
                                                isCollapsed
                                                    ? "justify-center h-12 w-12 mx-auto"
                                                    : "px-4 py-3 text-left w-full"
                                            } ${
                                                isActive
                                                    ? "bg-slate-950 text-white shadow-sm"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                            }`}
                                        >
                                            {/* Accent side bar */}
                                            {!isCollapsed && (
                                                <span
                                                    className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full transition-opacity ${
                                                        isActive ? "bg-blue-500 opacity-100" : "opacity-0"
                                                    }`}
                                                />
                                            )}

                                            <span
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                                    isActive
                                                        ? "bg-white/10 text-white"
                                                        : "bg-slate-100 text-slate-500 group-hover/item:bg-white group-hover/item:text-slate-900"
                                                }`}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>

                                            {!isCollapsed && (
                                                <span className="block min-w-0 truncate text-sm font-black leading-tight">
                                                    {item.label}
                                                </span>
                                            )}

                                            {/* CSS Tooltip for Collapsed view */}
                                            {isCollapsed && (
                                                <div className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-md transition-all translate-x-2 group-hover/item:translate-x-0 group-hover/item:opacity-100 whitespace-nowrap">
                                                    {item.label}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })
                            }
                        </div>
                    ))}
                </nav>
            </div>

            {/* Bottom section: User Profile + Logout */}
            <div className={`border-t border-slate-100 pt-4 flex ${isCollapsed ? "flex-col items-center gap-4 px-1" : "items-center justify-between gap-3 px-2"}`}>
                {/* Expanded Profile Info */}
                {!isCollapsed ? (
                    <>
                        <Link
                            href="/profile"
                            onClick={onCloseMobile}
                            className="flex items-center gap-3 overflow-hidden rounded-xl p-1 transition-all hover:bg-slate-50 flex-1 min-w-0"
                        >
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.nome || "Usuário"}
                                    className="h-9 w-9 rounded-full object-cover border border-slate-200"
                                />
                            ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                                    {initials}
                                </div>
                            )}
                            <div className="min-w-0 text-left">
                                <p className="truncate text-xs font-black text-slate-950">
                                    {profile?.nome || "Usuário"}
                                </p>
                                <p className="truncate text-[10px] font-semibold text-slate-500">
                                    {formatCargo(cargo)}
                                </p>
                            </div>
                        </Link>

                        <button
                            onClick={signOut}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95 cursor-pointer"
                            title="Sair da sessão"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    /* Collapsed Profile Info */
                    <>
                        <Link
                            href="/profile"
                            onClick={onCloseMobile}
                            className="group/item relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105 cursor-pointer"
                        >
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.nome || "Usuário"}
                                    className="h-9 w-9 rounded-full object-cover border border-slate-200"
                                />
                            ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                                    {initials}
                                </div>
                            )}
                            <div className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-md transition-all translate-x-2 group-hover/item:translate-x-0 group-hover/item:opacity-100 whitespace-nowrap">
                                Meu Perfil
                            </div>
                        </Link>

                        <button
                            onClick={signOut}
                            className="group/item relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            title="Sair"
                        >
                            <LogOut className="h-4 w-4" />
                            <div className="pointer-events-none absolute left-full ml-3 z-50 rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-md transition-all translate-x-2 group-hover/item:translate-x-0 group-hover/item:opacity-100 whitespace-nowrap">
                                Sair
                            </div>
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
}
