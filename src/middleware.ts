import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// api/v1 is skipped entirely: it authenticates with API keys
// (src/lib/api/v1/http.ts), so a session refresh would just add a Supabase
// Auth round trip to every API request.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
