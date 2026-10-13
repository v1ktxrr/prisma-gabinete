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

const targetUser = {
    email: "admin.maximo@govtech.local",
    password: "Teste25!",
    nome: "Administrador Máximo",
    cargo: "super_admin",
    unidade_id: "CG",
    modulos_acesso: ALL_MODULES
};

async function createMaxPermissionUser() {
    console.log(`Starting creation of test user: ${targetUser.email}`);

    // 1. Check if user already exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Failed to list users:", listError.message);
        process.exit(1);
    }

    const existingUser = users.find(u => u.email === targetUser.email);
    if (existingUser) {
        console.log(`⚠️ User ${targetUser.email} already exists. Deleting first to ensure fresh creation...`);
        // Clean up from profiles and perfis_usuarios just in case
        await supabase.from("perfis_usuarios").delete().eq("id", existingUser.id);
        await supabase.from("profiles").delete().eq("id", existingUser.id);
        
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
        if (deleteError) {
            console.error(`❌ Failed to delete existing user:`, deleteError.message);
            process.exit(1);
        }
        console.log("✅ Existing user deleted.");
    }

    // 2. Create the user in Auth
    console.log(`Creating user in Supabase Auth...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: targetUser.email,
        password: targetUser.password,
        email_confirm: true,
        user_metadata: {
            full_name: targetUser.nome,
            cargo: targetUser.cargo,
            unidade_id: targetUser.unidade_id,
            modulos_acesso: targetUser.modulos_acesso
        }
    });

    if (authError || !authData?.user) {
        console.error("❌ Failed to create user in Auth:", authError?.message || "Unknown error");
        process.exit(1);
    }

    const newUserId = authData.user.id;
    console.log(`✅ User created in auth with ID: ${newUserId}`);

    // The trigger public.handle_new_user should automatically populate public.profiles and public.perfis_usuarios,
    // but we can upsert explicitly to ensure it has all values correctly configured.
    console.log(`Ensuring profiles are fully configured...`);
    
    const { error: profileError } = await supabase
        .from("perfis_usuarios")
        .upsert({
            id: newUserId,
            nome: targetUser.nome,
            email: targetUser.email,
            cargo: targetUser.cargo,
            unidade_id: targetUser.unidade_id,
            modulos_acesso: targetUser.modulos_acesso,
            ativo: true
        }, { onConflict: "id" });

    if (profileError) {
        console.error("❌ Failed to upsert to perfis_usuarios:", profileError.message);
        // Attempt cleanup
        await supabase.auth.admin.deleteUser(newUserId);
        process.exit(1);
    }

    const { error: legacyProfileError } = await supabase
        .from("profiles")
        .upsert({
            id: newUserId,
            nome: targetUser.nome,
            cargo: targetUser.cargo
        }, { onConflict: "id" });

    if (legacyProfileError) {
        console.error("⚠️ Warning: Failed to upsert to legacy profiles:", legacyProfileError.message);
    }

    console.log("\n=============================================");
    console.log("🚀 USER CREATED SUCCESSFULLY!");
    console.log(`📧 Email: ${targetUser.email}`);
    console.log(`🔑 Password: ${targetUser.password}`);
    console.log(`👤 Name: ${targetUser.nome}`);
    console.log(`💼 Cargo: ${targetUser.cargo}`);
    console.log(`🏢 Unidade ID: ${targetUser.unidade_id}`);
    console.log(`🔒 Permissions: ${targetUser.modulos_acesso.join(", ")}`);
    console.log("=============================================\n");
}

createMaxPermissionUser().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
