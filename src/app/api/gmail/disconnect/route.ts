import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeToken } from "@/lib/gmail/google";
import { decryptToken } from "@/lib/gmail/crypto";

// Tell Google to forget us, then forget the token. The matches already found
// stay — they are the user's notes, not Google's data — until the user
// clears them from the panel.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { data: enc } = await supabase.rpc("gmail_refresh_token");
  if (typeof enc === "string" && enc) {
    try { await revokeToken(decryptToken(enc)); } catch { /* revoke is best effort */ }
  }
  const { error } = await supabase.from("gmail_connections").delete().eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
