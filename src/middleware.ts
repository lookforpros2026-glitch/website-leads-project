import { NextRequest, NextResponse } from "next/server";

function sanitizeSegment(seg: string) {
  const cleaned = seg
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase();
  return cleaned;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session")?.value;

  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/robots.txt" &&
    pathname !== "/sitemap-index.xml" &&
    pathname !== "/sitemap.xml" &&
    !pathname.startsWith("/sitemaps")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length) {
      const sanitized = parts.map(sanitizeSegment);
      if (sanitized.every((s) => s.length > 0)) {
        const originalPath = parts.join("/");
        const sanitizedPath = sanitized.join("/");
        if (sanitizedPath !== originalPath) {
          const url = req.nextUrl.clone();
          url.pathname = `/${sanitizedPath}`;
          return NextResponse.redirect(url, 308);
        }
      }
    }
  }

  if (pathname.startsWith("/api/admin")) {
    if (!session) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!session && !pathname.startsWith("/admin/login")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
