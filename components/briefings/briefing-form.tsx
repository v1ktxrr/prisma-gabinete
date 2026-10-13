"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Eraser,
    Expand,
    Heading2,
    Heading3,
    Highlighter,
    ImagePlus,
    Italic,
    Link2,
    Loader2,
    Lock,
    List,
    ListChecks,
    ListOrdered,
    Minimize2,
    Minus,
    PaintBucket,
    Pilcrow,
    Plus,
    Redo2,
    Save,
    Strikethrough,
    Trash2,
    Undo2,
    Underline as UnderlineIcon,
    FilePenLine,
    Settings,
    ChevronDown,
    ChevronUp,
    Info,
    CalendarClock,
    Globe,
    Truck,
    Users as UsersIcon,
    Table as TableIcon,
} from "lucide-react";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import MunicipioAutocomplete from "@/components/ui/municipio-autocomplete";
import CRMAlertBanner from "@/components/ui/crm-alert-banner";
import {
    AutoridadeItem,
    CronogramaItem,
    BlocoCustomizado,
    TipoLocalidade,
    BriefingFormValues,
    gerarIdBloco,
    getDefaultContentBlocks,
    getEmptyBriefingValues,
} from "./briefing-types";

type BriefingFormProps = {
    disabled?: boolean;
    loading?: boolean;
    mode: "agenda" | "independente";
    linkedEvent?: {
        titulo: string;
        data_inicio: string | null;
        municipio_id?: string | null;
    } | null;
    values: BriefingFormValues;
    onChange: (values: BriefingFormValues) => void;
    onSubmit: () => Promise<void>;
};

type RichTextEditorProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    sigiloso?: boolean;
};

const TRAJES = [
    "Passeio",
    "Passeio Completo",
    "Esporte Fino",
    "Social",
    "Operacional",
];

function ToolbarButton({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
}: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
                active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            } disabled:cursor-not-allowed disabled:opacity-50`}
        >
            {children}
        </button>
    );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-wrap items-center gap-2 border-r border-slate-200 pr-3 last:border-r-0 last:pr-0">{children}</div>;
}

function RichTextEditor({
    label,
    value,
    onChange,
    disabled = false,
    sigiloso = false,
}: RichTextEditorProps) {
    const [textColor, setTextColor] = useState("#0f172a");
    const [highlightColor, setHighlightColor] = useState("#fef08a");
    const [isFullscreen, setIsFullscreen] = useState(false);

    const editor = useEditor({
        immediatelyRender: false,
        editable: !disabled,
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [2, 3],
                },
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            Image.configure({ allowBase64: true, inline: false }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
            }),
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: `min-h-[220px] rounded-b-xl border-x border-b px-4 py-4 text-sm leading-7 text-slate-800 outline-none ${
                    sigiloso
                        ? "border-red-200 bg-white focus:border-red-300"
                        : "border-slate-200 bg-white focus:border-primary"
                }`,
            },
            transformPastedHTML(html) {
                // Remove especificamente tags de hiperlink <a> mantendo o texto interno
                return html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
            },
            handlePaste: (_view, event) => {
                const clipboardItems = Array.from(event.clipboardData?.items ?? []);
                const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));

                if (!imageItem || !editor) {
                    return false;
                }

                const file = imageItem.getAsFile();
                if (!file) {
                    return false;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : "";
                    if (result) {
                        editor.chain().focus().setImage({ src: result }).run();
                    }
                };
                reader.readAsDataURL(file);

                return true;
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            onChange(currentEditor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (current !== value) {
            editor.commands.setContent(value || "<p></p>");
        }
    }, [editor, value]);

    useEffect(() => {
        if (!editor) return;
        editor.setEditable(!disabled);
    }, [disabled, editor]);

    if (!editor) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Carregando...
            </div>
        );
    }

    const inserirImagemPorUrl = () => {
        const url = window.prompt("Cole a URL da imagem");
        if (!url) return;
        editor.chain().focus().setImage({ src: url }).run();
    };

    const toggleLink = () => {
        const previousUrl = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Cole a URL do link", previousUrl ?? "");

        if (url === null) return;

        if (!url.trim()) {
            editor.chain().focus().unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    };

    const clearFormatting = () => {
        editor.chain().focus().unsetAllMarks().clearNodes().run();
    };

    return (
        <div
            className={`overflow-hidden rounded-xl border transition-all ${
                sigiloso
                    ? "border-red-200 bg-red-50/30 p-4 shadow-sm"
                    : "border-slate-200 bg-white p-1"
            } ${isFullscreen ? "fixed inset-0 z-50 overflow-y-auto bg-white p-8" : ""}`}
        >
            <div className="mb-2.5 flex items-center justify-between gap-2 px-2 pt-1">
                <div className="flex items-center gap-2">
                    {sigiloso && <Lock className="h-4 w-4 text-red-600" />}
                    <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${sigiloso ? "text-red-700" : "text-slate-500"}`}>
                        {label}
                    </span>
                </div>
                {sigiloso && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-700">
                        Reservado
                    </span>
                )}
            </div>

            <div className="rounded-xl bg-slate-50">
                <div
                    className={`sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-t-xl border border-slate-200 bg-slate-100 px-3 py-3 ${
                        isFullscreen ? "top-0 z-[60]" : ""
                    }`}
                >
                    <ToolbarGroup>
                        <ToolbarButton
                            label="Desfazer"
                            disabled={disabled || !editor.can().chain().focus().undo().run()}
                            onClick={() => editor.chain().focus().undo().run()}
                        >
                            <Undo2 className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Refazer"
                            disabled={disabled || !editor.can().chain().focus().redo().run()}
                            onClick={() => editor.chain().focus().redo().run()}
                        >
                            <Redo2 className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Negrito"
                            active={editor.isActive("bold")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                        >
                            <Bold className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Itálico"
                            active={editor.isActive("italic")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                        >
                            <Italic className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Sublinhado"
                            active={editor.isActive("underline")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                        >
                            <UnderlineIcon className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Riscado"
                            active={editor.isActive("strike")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                        >
                            <Strikethrough className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Limpar formatação"
                            disabled={disabled}
                            onClick={clearFormatting}
                        >
                            <Eraser className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Parágrafo"
                            active={editor.isActive("paragraph")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setParagraph().run()}
                        >
                            <Pilcrow className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Título 1"
                            active={editor.isActive("heading", { level: 2 })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        >
                            <Heading2 className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Título 2"
                            active={editor.isActive("heading", { level: 3 })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        >
                            <Heading3 className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Alinhar à esquerda"
                            active={editor.isActive({ textAlign: "left" })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setTextAlign("left").run()}
                        >
                            <AlignLeft className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Centralizar"
                            active={editor.isActive({ textAlign: "center" })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setTextAlign("center").run()}
                        >
                            <AlignCenter className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Alinhar à direita"
                            active={editor.isActive({ textAlign: "right" })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setTextAlign("right").run()}
                        >
                            <AlignRight className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Justificar"
                            active={editor.isActive({ textAlign: "justify" })}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                        >
                            <AlignJustify className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Lista com marcadores"
                            active={editor.isActive("bulletList")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            <List className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Lista numerada"
                            active={editor.isActive("orderedList")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                            <ListOrdered className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Lista de tarefas"
                            active={editor.isActive("taskList")}
                            disabled={disabled}
                            onClick={() => editor.chain().focus().toggleTaskList().run()}
                        >
                            <ListChecks className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Adicionar link"
                            active={editor.isActive("link")}
                            disabled={disabled}
                            onClick={toggleLink}
                        >
                            <Link2 className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Inserir imagem"
                            disabled={disabled}
                            onClick={inserirImagemPorUrl}
                        >
                            <ImagePlus className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Linha horizontal"
                            disabled={disabled}
                            onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        >
                            <Minus className="h-4 w-4" />
                        </ToolbarButton>
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <ToolbarButton
                            label="Inserir Tabela"
                            disabled={disabled}
                            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        >
                            <TableIcon className="h-4 w-4" />
                        </ToolbarButton>
                        {editor.isActive("table") && (
                            <>
                                <ToolbarButton
                                    label="Inserir Linha Acima"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().addRowBefore().run()}
                                >
                                    <span className="text-[10px] font-bold">+L↑</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Inserir Linha Abaixo"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().addRowAfter().run()}
                                >
                                    <span className="text-[10px] font-bold">+L↓</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Inserir Coluna Esquerda"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                                >
                                    <span className="text-[10px] font-bold">+C←</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Inserir Coluna Direita"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                                >
                                    <span className="text-[10px] font-bold">+C→</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Excluir Linha"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().deleteRow().run()}
                                >
                                    <span className="text-[10px] font-bold text-red-500">-L</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Excluir Coluna"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().deleteColumn().run()}
                                >
                                    <span className="text-[10px] font-bold text-red-500">-C</span>
                                </ToolbarButton>
                                <ToolbarButton
                                    label="Excluir Tabela"
                                    disabled={disabled}
                                    onClick={() => editor.chain().focus().deleteTable().run()}
                                >
                                    <span className="text-[10px] font-bold text-red-500">Excluir Tabela</span>
                                </ToolbarButton>
                            </>
                        )}
                    </ToolbarGroup>

                    <ToolbarGroup>
                        <label
                            title="Cor do texto"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                        >
                            <PaintBucket className="h-4 w-4" />
                            <input
                                type="color"
                                value={textColor}
                                disabled={disabled}
                                onChange={(event) => {
                                    const nextColor = event.target.value;
                                    setTextColor(nextColor);
                                    editor.chain().focus().setColor(nextColor).run();
                                }}
                                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                            />
                        </label>
                        <label
                            title="Grifar texto"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                        >
                            <Highlighter className="h-4 w-4" />
                            <input
                                type="color"
                                value={highlightColor}
                                disabled={disabled}
                                onChange={(event) => {
                                    const nextColor = event.target.value;
                                    setHighlightColor(nextColor);
                                    editor.chain().focus().toggleHighlight({ color: nextColor }).run();
                                }}
                                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                            />
                        </label>
                    </ToolbarGroup>

                    <div className="ml-auto">
                        <ToolbarButton
                            label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                            disabled={disabled}
                            onClick={() => setIsFullscreen((current) => !current)}
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                        </ToolbarButton>
                    </div>
                </div>
                <EditorContent editor={editor} />
                {isFullscreen && (
                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(false)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                        >
                            <Minimize2 className="h-4 w-4" />
                            Sair da Tela Cheia
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function AccordionSection({
    title,
    description,
    icon: Icon,
    children,
    isOpen,
    onToggle,
}: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-all duration-350 ${isOpen ? "" : "overflow-hidden"}`}>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50/50 focus:outline-none cursor-pointer"
            >
                <div className="flex items-start gap-3.5 pr-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-605">
                        <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                            {title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-450 leading-normal">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="text-slate-400">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </button>

            {isOpen && (
                <div className="border-t border-slate-150 p-5 bg-slate-50/30 animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function BriefingForm({
    disabled = false,
    loading = false,
    mode,
    linkedEvent = null,
    values,
    onChange,
    onSubmit,
}: BriefingFormProps) {
    const [activeTab, setActiveTab] = useState<"editor" | "apoio">("editor");
    const { unidadeId } = usePermissions();
    const [atendimentos, setAtendimentos] = useState<{ id: string; titulo: string; data: string }[]>([]);

    useEffect(() => {
        if (!unidadeId) return;
        supabase
            .from("atendimentos")
            .select("id, titulo, data")
            .eq("unidade_id", unidadeId)
            .neq("status", "arquivado")
            .order("titulo", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) {
                    setAtendimentos(data);
                }
            });
    }, [unidadeId]);

    const [accordions, setAccordions] = useState({
        statusLocalidade: true,
        cabecalho: true,
        logistica: true,
        autoridadesCronograma: true,
    });

    const toggleAccordion = (key: keyof typeof accordions) => {
        setAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const safeBlocks = useMemo(() => {
        if (values.blocos_customizados.length > 0) {
            return values.blocos_customizados;
        }

        return getDefaultContentBlocks();
    }, [values.blocos_customizados]);

    const setField = <K extends keyof BriefingFormValues>(field: K, value: BriefingFormValues[K]) => {
        onChange({ ...values, [field]: value });
    };

    const updateAutoridade = (index: number, field: keyof AutoridadeItem, value: string) => {
        const next = [...values.autoridades];
        next[index] = { ...next[index], [field]: value };
        setField("autoridades", next);
    };

    const updateCronograma = (index: number, field: keyof CronogramaItem, value: string) => {
        const next = [...values.cronograma];
        next[index] = { ...next[index], [field]: value };
        setField("cronograma", next);
    };

    const updateBloco = (index: number, patch: Partial<BlocoCustomizado>) => {
        const next = [...safeBlocks];
        next[index] = { ...next[index], ...patch };
        setField("blocos_customizados", next);
    };

    const addBloco = () => {
        setField("blocos_customizados", [
            ...safeBlocks,
            {
                id: gerarIdBloco(),
                titulo: "Novo Bloco de Conteúdo",
                conteudo_html: "",
                sigiloso: false,
            },
        ]);
    };

    const removeBloco = (index: number) => {
        setField(
            "blocos_customizados",
            safeBlocks.filter((_, itemIndex) => itemIndex !== index)
        );
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                void onSubmit();
            }}
            className="space-y-6"
        >
            {/* Tabs Navigation Header */}
            <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                <button
                    type="button"
                    onClick={() => setActiveTab("editor")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all cursor-pointer focus:outline-none ${
                        activeTab === "editor"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                >
                    <FilePenLine className="h-4 w-4" />
                    Editor do Briefing
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("apoio")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all cursor-pointer focus:outline-none ${
                        activeTab === "apoio"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                >
                    <Settings className="h-4 w-4" />
                    Metadados e Apoio ({values.autoridades.length + values.cronograma.length + (values.organizacao ? 1 : 0)} itens)
                </button>
            </div>

            {/* TAB CONTENT: EDITOR */}
            {activeTab === "editor" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-900">Blocos de Conteúdo</h3>
                            <p className="mt-0.5 text-xs text-slate-450">Redija o contexto, pautas e notas confidenciais utilizando o editor rico.</p>
                        </div>
                        <button
                            type="button"
                            onClick={addBloco}
                            disabled={disabled}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-350 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5 text-slate-500" />
                            Adicionar Bloco
                        </button>
                    </div>

                    <div className="space-y-5">
                        {safeBlocks.map((bloco, index) => (
                            <div
                                key={bloco.id}
                                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-300 ${
                                    bloco.sigiloso
                                        ? "border-red-200 bg-gradient-to-br from-white to-red-50/10 shadow-red-50/20"
                                        : "border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <input
                                        value={bloco.titulo}
                                        onChange={(event) => updateBloco(index, { titulo: event.target.value })}
                                        disabled={disabled}
                                        className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all md:max-w-xl ${
                                            bloco.sigiloso
                                                ? "border-red-200 bg-red-50/40 text-red-900 focus:border-red-300 focus:ring-2 focus:ring-red-100"
                                                : "border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5"
                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                        placeholder="Título do bloco"
                                    />
                                    <div className="flex items-center gap-2">
                                        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-650 cursor-pointer hover:bg-slate-100 select-none">
                                            <input
                                                type="checkbox"
                                                checked={bloco.sigiloso}
                                                disabled={disabled}
                                                onChange={(event) => updateBloco(index, { sigiloso: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
                                            />
                                            Sigiloso
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => removeBloco(index)}
                                            disabled={disabled || safeBlocks.length === 1}
                                            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer active:scale-95"
                                            aria-label="Remover bloco"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <RichTextEditor
                                    label={bloco.titulo || `Bloco ${index + 1}`}
                                    value={bloco.conteudo_html}
                                    onChange={(conteudo_html) => updateBloco(index, { conteudo_html })}
                                    disabled={disabled}
                                    sigiloso={bloco.sigiloso}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: APUI / SUPPORT DATA */}
            {activeTab === "apoio" && (
                <div className="space-y-4 animate-in fade-in duration-200">

                    {/* ACCORDION 1: STATUS & LOCALIDADE */}
                    <AccordionSection
                        title="Status e Tipo de Modelo"
                        description="Configure se o briefing está pronto e o tipo de localidade para impressão"
                        icon={Info}
                        isOpen={accordions.statusLocalidade}
                        onToggle={() => toggleAccordion("statusLocalidade")}
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label className="block mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-450">
                                    Status de Publicação
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        { id: "RASCUNHO", label: "Rascunho", desc: "Em edição", activeColor: "border-amber-500 bg-amber-500 text-white", inactiveColor: "border-amber-200 bg-amber-50/30 text-amber-800 hover:border-amber-350 hover:bg-white" },
                                        { id: "FINALIZADO", label: "Finalizado", desc: "Pronto", activeColor: "border-emerald-600 bg-emerald-600 text-white", inactiveColor: "border-emerald-200 bg-emerald-50/30 text-emerald-800 hover:border-emerald-350 hover:bg-white" }
                                    ].map((option) => {
                                        const active = values.status === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setField("status", option.id as "RASCUNHO" | "FINALIZADO")}
                                                disabled={disabled}
                                                className={`rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer ${
                                                    active ? option.activeColor + " shadow-sm" : option.inactiveColor
                                                } disabled:opacity-60`}
                                            >
                                                <span className="block text-xs font-extrabold uppercase tracking-wider">{option.label}</span>
                                                <span className={`mt-0.5 block text-[10px] ${active ? "text-white/80" : "text-slate-400"}`}>{option.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-450">
                                    Tipo de Localidade
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {(["INTERIOR", "CAPITAL"] as const).map((tipo) => {
                                        const active = values.tipo_localidade === tipo;
                                        return (
                                            <button
                                                key={tipo}
                                                type="button"
                                                onClick={() => setField("tipo_localidade", tipo)}
                                                disabled={disabled}
                                                className={`rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
                                                    active
                                                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                        : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white"
                                                } disabled:opacity-60`}
                                            >
                                                <span className="block text-xs font-extrabold uppercase tracking-wider">{tipo}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </AccordionSection>

                    {/* ACCORDION 2: CABECALHO / EVENT INFO */}
                    <AccordionSection
                        title="Cabeçalho e Informações do Evento"
                        description="Identificação temporal e espacial do compromisso"
                        icon={CalendarClock}
                        isOpen={accordions.cabecalho}
                        onToggle={() => toggleAccordion("cabecalho")}
                    >
                        {mode === "independente" ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="block md:col-span-2">
                                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                        Título do Briefing
                                    </span>
                                    <input
                                        value={values.titulo_customizado}
                                        onChange={(e) => setField("titulo_customizado", e.target.value)}
                                        disabled={disabled}
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                        placeholder="Digite o título do compromisso"
                                    />
                                </label>

                                <div className="block">
                                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                        Data
                                    </span>
                                    <DatePicker
                                        value={values.data_customizada}
                                        onChange={(val) => setField("data_customizada", val)}
                                        disabled={disabled}
                                        required
                                        className="bg-white focus:border-slate-900"
                                    />
                                </div>

                                <div className="block">
                                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                        Horário
                                    </span>
                                    <TimePicker
                                        value={values.hora_customizada}
                                        onChange={(val) => setField("hora_customizada", val)}
                                        disabled={disabled}
                                        required
                                        className="bg-white focus:border-slate-900"
                                    />
                                </div>

                                <label className="block md:col-span-2">
                                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                        Local do Evento
                                    </span>
                                    <input
                                        value={values.local_customizado}
                                        onChange={(e) => setField("local_customizado", e.target.value)}
                                        disabled={disabled}
                                        required
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                        placeholder="Cidade, endereço ou ponto de referência"
                                    />
                                </label>

                                <div className="block md:col-span-2">
                                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                        Município (MS)
                                    </span>
                                    <MunicipioAutocomplete
                                        value={values.municipio_id}
                                        onChange={(id) => setField("municipio_id", id)}
                                        disabled={disabled}
                                    />
                                    <CRMAlertBanner
                                        municipioId={values.municipio_id}
                                        className="mt-3"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                {linkedEvent && (
                                    <div className="flex flex-col gap-3">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                Vínculo da Agenda Global
                                            </p>
                                            <h4 className="mt-2 text-sm font-extrabold text-slate-900">{linkedEvent.titulo}</h4>
                                            <p className="mt-1 text-xs font-medium text-slate-500">
                                                {linkedEvent.data_inicio
                                                    ? new Intl.DateTimeFormat("pt-BR", {
                                                          day: "2-digit",
                                                          month: "2-digit",
                                                          year: "numeric",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                      }).format(new Date(linkedEvent.data_inicio))
                                                    : "Sem data definida"}
                                            </p>
                                        </div>
                                        <CRMAlertBanner
                                            municipioId={linkedEvent.municipio_id}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                Vincular a Atendimento
                            </span>
                            <select
                                value={values.atendimento_id || ""}
                                onChange={(e) => setField("atendimento_id", e.target.value || null)}
                                disabled={disabled}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60 cursor-pointer"
                            >
                                <option value="">Nenhum atendimento vinculado</option>
                                <option value="new">✨ Gerar Novo Atendimento Automaticamente</option>
                                {atendimentos.map((at) => (
                                    <option key={at.id} value={at.id}>
                                        {at.titulo} ({new Date(at.data).toLocaleDateString("pt-BR")})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </AccordionSection>

                    {/* ACCORDION 3: LOGISTICA */}
                    <AccordionSection
                        title="Dados Logísticos e Traje"
                        description="Contato local, organização oficial e trajes institucionais"
                        icon={Truck}
                        isOpen={accordions.logistica}
                        onToggle={() => toggleAccordion("logistica")}
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                    Organização do Evento
                                </span>
                                <input
                                    value={values.organizacao}
                                    onChange={(e) => setField("organizacao", e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                    placeholder="Secretaria ou órgão responsável"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                    Contato Local
                                </span>
                                <input
                                    value={values.contato_local}
                                    onChange={(e) => setField("contato_local", e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                    placeholder="Nome e contato do receptivo"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                    Traje Recomendado
                                </span>
                                <select
                                    value={values.traje}
                                    onChange={(e) => setField("traje", e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                >
                                    <option value="">Selecione um traje</option>
                                    {TRAJES.map((traje) => (
                                        <option key={traje} value={traje}>
                                            {traje}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-455">
                                    Apoio do Governo MS
                                </span>
                                <input
                                    value={values.apoio_governo_ms}
                                    onChange={(e) => setField("apoio_governo_ms", e.target.value)}
                                    disabled={disabled}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                    placeholder="Estrutura, emendas ou cooperação"
                                />
                            </label>
                        </div>
                    </AccordionSection>

                    {/* ACCORDION 4: AUTORIDADES E CRONOGRAMA */}
                    <AccordionSection
                        title="Cerimonial e Autoridades"
                        description="Composição de mesa, autoridades confirmadas e roteiro do evento"
                        icon={UsersIcon}
                        isOpen={accordions.autoridadesCronograma}
                        onToggle={() => toggleAccordion("autoridadesCronograma")}
                    >
                        <div className="grid gap-6 xl:grid-cols-2">
                            {/* Autoridades Column */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-xs font-extrabold text-slate-900 uppercase">Autoridades</h4>
                                        <p className="text-[10px] text-slate-400">Autoridades relevantes confirmadas.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setField("autoridades", [...values.autoridades, { nome: "", cargo: "" }])}
                                        disabled={disabled}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-350 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-slate-500" />
                                        Adicionar
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {values.autoridades.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                                            Nenhuma autoridade adicionada por enquanto.
                                        </div>
                                    )}
                                    {values.autoridades.map((autoridade, index) => (
                                        <div key={`autoridade-${index}`} className="grid gap-2 grid-cols-[1fr_1fr_auto]">
                                            <input
                                                value={autoridade.nome}
                                                onChange={(e) => updateAutoridade(index, "nome", e.target.value)}
                                                disabled={disabled}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                                placeholder="Nome"
                                            />
                                            <input
                                                value={autoridade.cargo}
                                                onChange={(e) => updateAutoridade(index, "cargo", e.target.value)}
                                                disabled={disabled}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                                placeholder="Cargo"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setField("autoridades", values.autoridades.filter((_, itemIndex) => itemIndex !== index))}
                                                disabled={disabled}
                                                className="inline-flex items-center justify-center rounded-xl border border-red-150 bg-red-50 px-2.5 py-2.5 text-red-650 transition-all hover:bg-red-100 disabled:opacity-60 cursor-pointer active:scale-95"
                                                aria-label="Remover autoridade"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cronograma Column */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-xs font-extrabold text-slate-900 uppercase">Cronograma</h4>
                                        <p className="text-[10px] text-slate-400">Etapas do ato solene.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setField("cronograma", [...values.cronograma, { horario: "", acao: "" }])}
                                        disabled={disabled}
                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-350 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-slate-500" />
                                        Adicionar
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {values.cronograma.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
                                            Nenhuma etapa do roteiro por enquanto.
                                        </div>
                                    )}
                                    {values.cronograma.map((etapa, index) => (
                                        <div key={`cronograma-${index}`} className="grid gap-2 grid-cols-[130px_1fr_auto]">
                                            <TimePicker
                                                value={etapa.horario}
                                                onChange={(val) => updateCronograma(index, "horario", val)}
                                                disabled={disabled}
                                                className="bg-white"
                                            />
                                            <input
                                                value={etapa.acao}
                                                onChange={(e) => updateCronograma(index, "acao", e.target.value)}
                                                disabled={disabled}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-60"
                                                placeholder="Ação/Discurso"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setField("cronograma", values.cronograma.filter((_, itemIndex) => itemIndex !== index))}
                                                disabled={disabled}
                                                className="inline-flex items-center justify-center rounded-xl border border-red-150 bg-red-50 px-2.5 py-2.5 text-red-655 transition-all hover:bg-red-100 disabled:opacity-60 cursor-pointer active:scale-95"
                                                aria-label="Remover etapa"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </AccordionSection>
                </div>
            )}

            {/* Always visible Footer: submit action */}
            <div className="flex justify-end pt-5 border-t border-slate-200">
                <button
                    type="submit"
                    disabled={disabled || loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
                    {loading ? "Salvando..." : "Salvar Briefing"}
                </button>
            </div>
        </form>
    );
}
