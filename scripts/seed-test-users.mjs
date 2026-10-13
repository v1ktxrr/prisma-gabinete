import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar o seed.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ALL_MODULES = [
  "agenda_global_ver",
  "agenda_global_editar",
  "agenda_global_presenca",
  "agenda_comunicacao_ver",
  "agenda_comunicacao_editar",
  "oficios_ver",
  "oficios_tramitar",
];

const users = [
  {
    email: "chefe.cg.teste@govtech.local",
    password: "Teste@123456",
    nome: "Chefe CG Teste",
    cargo: "chefia",
    unidade_id: "CG",
    modulos_acesso: ALL_MODULES,
  },
  {
    email: "assessor.dd.teste@govtech.local",
    password: "Teste@123456",
    nome: "Assessor DD Teste",
    cargo: "assessoria",
    unidade_id: "DD",
    modulos_acesso: ["agenda_global_ver"],
  },
];

for (const user of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.nome,
      cargo: user.cargo,
      unidade_id: user.unidade_id,
      modulos_acesso: user.modulos_acesso,
    },
  });

  if (error) {
    if (!error.message.toLowerCase().includes("already registered")) {
      throw error;
    }

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = existingUsers.users.find((item) => item.email === user.email);
    if (!existingUser) {
      throw new Error(`Usuario ${user.email} ja existe, mas nao foi localizado para upsert do perfil.`);
    }

    const { error: profileError } = await supabase
      .from("perfis_usuarios")
      .upsert(
        {
          id: existingUser.id,
          nome: user.nome,
          cargo: user.cargo,
          unidade_id: user.unidade_id,
          modulos_acesso: user.modulos_acesso,
        },
        { onConflict: "id" }
      );

    if (profileError) throw profileError;

    console.log(`Perfil atualizado para usuario existente: ${user.email}`);
    continue;
  }

  if (!data.user) {
    throw new Error(`Falha ao criar usuario ${user.email}.`);
  }

  const { error: profileError } = await supabase
    .from("perfis_usuarios")
    .upsert(
      {
        id: data.user.id,
        nome: user.nome,
        cargo: user.cargo,
        unidade_id: user.unidade_id,
        modulos_acesso: user.modulos_acesso,
      },
      { onConflict: "id" }
    );

  if (profileError) throw profileError;

  console.log(`Usuario criado: ${user.email}`);
}

console.log("Seed concluido.");
