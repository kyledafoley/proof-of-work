import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { authUrl, redirectUri } from "@/lib/gmail/google";

// Step one of connecting Gmail: send the signed-in user to Google's consent
// screen. The `state` nonce goes into an httpOnly cookie and comes back in the
// query string, so a callback that did not start here is rejected.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/app", req.url));

  const state = randomBytes(16).toString("base64url");
  const url = authUrl({
    redirectUri: redirectUri(req.nextUrl.origin),
    state,
    loginHint: user.email ?? undefined,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/api/gmail", maxAge: 600,
  });
  return res;
}
