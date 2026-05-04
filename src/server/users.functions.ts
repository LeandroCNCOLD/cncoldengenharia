import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireAuthOrDev } from "./auth-or-dev";

import type { Database } from "@/integrations/supabase/types";

type AppRole = "admin" | "engenheiro" | "gerente" | "visualizador";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(userId: string) {
  const admin = getAdmin();
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuthOrDev])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("id, full_name, email, is_active, created_at"),
      admin.from("user_roles").select("user_id, role"),
    ]);
    const rolesByUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuthOrDev])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        role: z.enum(["admin", "engenheiro", "gerente", "visualizador"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "create failed");
    
    await admin.from("user_roles").delete().eq("user_id", created.user.id);
    await admin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    
    return { id: created.user.id };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuthOrDev])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "engenheiro", "gerente", "visualizador"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    await admin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireAuthOrDev])
  .inputValidator((d) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    await admin.from("profiles").update({ is_active: data.is_active }).eq("id", data.user_id);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuthOrDev])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateModulePermission = createServerFn({ method: "POST" })
  .middleware([requireAuthOrDev])
  .inputValidator((d) =>
    z
      .object({
        role: z.enum(["admin", "engenheiro", "gerente", "visualizador"]),
        module_key: z.string().min(1),
        can_view: z.boolean(),
        can_edit: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const admin = getAdmin();
    const { error } = await admin
      .from("module_permissions")
      .upsert(data, { onConflict: "role,module_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
