import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env.local to avoid external dependencies
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || "";
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

const ALL_MODULES = [
    "agenda_global_ver",
    "agenda_global_editar",
    "agenda_global_presenca",
    "agenda_comunicacao_ver",
    "agenda_comunicacao_editar",
    "briefing_editar",
    "usuarios_gerenciar",
    "visao_geral_auditoria",
    "oficios_ver",
    "oficios_tramitar"
];

const CARGO_TEMPLATES = {
    assessoria: ["agenda_global_ver"],
    secretaria: ["agenda_global_ver", "agenda_global_editar", "briefing_editar", "oficios_ver"],
    comunicacao: [
        "agenda_global_ver",
        "agenda_global_editar",
        "briefing_editar",
        "agenda_comunicacao_ver",
        "agenda_comunicacao_editar"
    ],
    chefia: ALL_MODULES,
    super_admin: ALL_MODULES
};

const TEMPORARY_PASSWORD = "Prisma@Temporaria123";

const USERS_TO_CREATE = [
    { nome: "Administrador Geral (Demo)", email: "admin@exemplo.com", cargo: "super_admin", unidade_id: "CG" },
    { nome: "Chefe de Gabinete (Demo)", email: "chefe@exemplo.com", cargo: "chefia", unidade_id: "CG" },
    { nome: "Secretária Executiva (Demo)", email: "secretaria@exemplo.com", cargo: "secretaria", unidade_id: "CG" },
    { nome: "Equipe de Comunicação (Demo)", email: "comunicacao@exemplo.com", cargo: "comunicacao", unidade_id: "CG" },
    { nome: "Assessor de Campo (Demo)", email: "assessor@exemplo.com", cargo: "assessoria", unidade_id: "CG" },
    { nome: "Assessor Regional (Demo)", email: "assessor.regional@exemplo.com", cargo: "assessoria", unidade_id: "DD" }
];

async function seedUsers() {
    console.log("Iniciando criação/atualização de usuários de teste...");

    for (const u of USERS_TO_CREATE) {
        const modulos_acesso = CARGO_TEMPLATES[u.cargo] || [];
        console.log(`Processando: ${u.nome} (${u.email}) - Cargo: ${u.cargo}`);

        // 1. Tentar criar o usuário
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

        let userId = data?.user?.id;

        if (error) {
            if (error.message.toLowerCase().includes("already registered")) {
                console.log(`ℹ️ Usuário ${u.email} já existe. Atualizando senha e perfil...`);
                // Buscar ID
                const { data: listData } = await supabase.auth.admin.listUsers();
                const existing = listData?.users?.find(x => x.email === u.email);
                if (existing) {
                    userId = existing.id;
                    await supabase.auth.admin.updateUserById(userId, {
                        password: TEMPORARY_PASSWORD,
                        user_metadata: {
                            full_name: u.nome,
                            cargo: u.cargo,
                            unidade_id: u.unidade_id,
                            modulos_acesso: modulos_acesso
                        }
                    });
                }
            } else {
                console.error(`❌ Erro ao criar ${u.email}:`, error.message);
                continue;
            }
        }

        if (userId) {
            // Garantir espelho em perfis_usuarios
            const { error: perfilErr } = await supabase
                .from("perfis_usuarios")
                .upsert({
                    id: userId,
                    nome: u.nome,
                    cargo: u.cargo,
                    unidade_id: u.unidade_id,
                    modulos_acesso: modulos_acesso
                });

            if (perfilErr) {
                console.warn(`⚠️ Aviso no perfil de ${u.email}:`, perfilErr.message);
            } else {
                console.log(`✅ ${u.email} pronto com perfil sincronizado!`);
            }
        }
    }

    console.log("\n--- Usuários de Teste Configurados com Sucesso! ---");
    console.log("Senha padrão: " + TEMPORARY_PASSWORD);
}

seedUsers().catch(console.error);
