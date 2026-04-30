import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Client-side middleware that attaches the current Supabase session's access
 * token as the Authorization header on server-fn RPC requests, so that
 * `requireSupabaseAuth` (server-side) can validate the user.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") {
      return next();
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return next();
    return next({
      headers: { Authorization: `Bearer ${token}` },
    });
  },
);
