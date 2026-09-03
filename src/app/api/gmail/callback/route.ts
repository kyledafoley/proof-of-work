import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, gmailProfile, redirectUri } from "@/lib/gmail/google";
import { encryptToken } from "@/lib/gmail/crypto";

// Step two: Google sends the user back with a code. Verify the state, trade
// the code for tokens, learn which mailbox it is, encrypt the refresh token
// and store it against the signed-in user. The access token from this
// exchange is used once (to read the address) and dropped.
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/app?gmail=${q}`, req.url));

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expected = req.cookies.get("gmail_oauth_state")?.value;
  if (searchParams.get("error")) return back("denied");
  if (!code || !state || !expected || state !== expected) return back("state");
  if (!process.env.GMAIL_TOKEN_KEY) return back("unconfigured");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/app", req.url));

  try {
    const { accessToken, refreshToken } = await exchangeCode(code, redirectUri(req.nextUrl.origin));
    const { emailAddress } = await gmailProfile(accessToken);
    // Written through a definer function scoped to the caller — the token
    // column is not writable (or readable) from the app's client directly.
    const { error } = await supabase.rpc("gmail_connect", {
      p_email: emailAddress,
      p_token_enc: encryptToken(refreshToken),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("gmail callback:", e instanceof Error ? e.message : e);
    return back("failed");
  }
  const res = back("connected");
  res.cookies.delete("gmail_oauth_state");
  return res;
}
