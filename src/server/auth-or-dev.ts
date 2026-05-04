import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side middleware: validates Supabase Bearer token like
 * requireSupabaseAuth, but in dev mode (or when explicitly bypassing) falls
 * back to a hardcoded dev admin user so the local app — which uses a client
 * auth bypass — can still call protected server functions.
 */
export const requireAuthOrDev = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    if (typeof window === "undefined") return next();

    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) return next();
    return next({ headers: { Authorization: `Bearer ${token}` } });
  })
  .server(async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (token) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        return next({
          context: { supabase, userId: data.claims.sub as string },
        });
      }
    }

    const isDevRequest = import.meta.env.DEV || new URL(request.url).hostname === "localhost";
    if (!isDevRequest) {
      throw new Error("Não autorizado: faça login novamente.");
    }

    // Dev fallback: use service-role client and resolve any admin user id.
    const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: anyAdmin } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (!anyAdmin?.user_id) {
      throw new Error("Nenhum administrador encontrado para o modo de desenvolvimento.");
    }

    return next({
      context: {
        supabase: admin,
        userId: anyAdmin.user_id,
      },
    });
  });
