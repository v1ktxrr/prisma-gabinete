import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env.local to avoid external dependencies like dotenv
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || "";
            // Remove surrounding quotes
            if (value.startsWith("'") && value.endsWith("'")) {
                value = value.slice(1, -1);
            } else if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

type CargoUsuario = "assessoria" | "secretaria" | "comunicacao" | "chefia";
type UnidadeUsuario = "CG" | "DD";

interface UserSeed {
    nome: string;
    email: string;
    cargo: CargoUsuario;
    unidade_id: UnidadeUsuario;
}

const USERS_TO_CREATE: UserSeed[] = [
    { nome: "Chefe de Gabinete (Sede)", email: "chefe@exemplo.com", cargo: "chefia", unidade_id: "CG" },
    { nome: "Secretária Executiva (Sede)", email: "secretaria@exemplo.com", cargo: "secretaria", unidade_id: "CG" },
    { nome: "Comunicação (Sede)", email: "comunicacao@exemplo.com", cargo: "comunicacao", unidade_id: "CG" },
    { nome: "Assessor de Campo (Sede)", email: "assessor@exemplo.com", cargo: "assessoria", unidade_id: "CG" },
    { nome: "Chefe Regional", email: "chefe.regional@exemplo.com", cargo: "chefia", unidade_id: "DD" },
    { nome: "Assessor Regional", email: "assessor.regional@exemplo.com", cargo: "assessoria", unidade_id: "DD" }
];

// RBAC Templates of Access Modules for pre-seeding
const CARGO_TEMPLATES: Record<CargoUsuario, string[]> = {
    assessoria: [],
    secretaria: ["agenda_global_editar", "briefing_editar"],
    comunicacao: [
        "agenda_global_editar",
        "briefing_editar",
        "agenda_comunicacao_ver",
        "agenda_comunicacao_editar"
    ],
    chefia: [
        "agenda_global_editar",
        "briefing_editar",
        "agenda_comunicacao_ver",
        "usuarios_gerenciar",
        "visao_geral_auditoria",
        "oficios_ver",
        "oficios_tramitar"
    ]
};

const TEMPORARY_PASSWORD = "Prisma@Temporaria123";

async function seedUsers() {
    console.log("Starting seed of homologation users...");

    for (const u of USERS_TO_CREATE) {
        const modulos_acesso = CARGO_TEMPLATES[u.cargo];
        console.log(`Creating user: ${u.nome} (${u.email}) - Role: ${u.cargo}, Unit: ${u.unidade_id}`);

        const { data, error } = await supabase.auth.admin.createUser({
            email: u.email,
            password: TEMPORARY_PASSWORD,
            email_confirm: true,
            user_metadata: {
                full_name: u.nome,
                cargo: u.cargo,
                unidade_id: u.unidade_id,
                modulos_acesso: modulos_acesso
            }
        });

        if (error) {
            console.error(`❌ Failed to create user ${u.nome}:`, error.message);
        } else if (data?.user) {
            console.log(`✅ Successfully created user ${u.nome} with ID: ${data.user.id}`);
        }
    }

    console.log("User seeding process finished.");
}

seedUsers().catch((err) => {
    console.error("Fatal seeding error:", err);
    process.exit(1);
});
