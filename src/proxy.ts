import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Comprobación optimista: sin cookie de sesión no se entra al panel.
// La validación real del token la hace cada ruta de la API.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("fc_token")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
