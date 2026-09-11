import { NextResponse, type NextRequest } from "next/server";
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  negotiateLanguage,
  pathLanguage,
} from "./app/i18n/languages";

/**
 * Every page lives under a language segment so it is prerendered once per
 * language with the right `lang`. A visitor who arrives at the root URL is
 * served the language their browser asks for, with the address left alone.
 * An explicit `/fr` or `/en` is remembered so the root keeps honouring it.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const explicit = pathLanguage(pathname);
  if (explicit) {
    const response = NextResponse.next();
    if (request.cookies.get(LANGUAGE_COOKIE)?.value !== explicit)
      response.cookies.set(LANGUAGE_COOKIE, explicit, {
        path: "/",
        maxAge: LANGUAGE_COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
      });
    return response;
  }
  const language = negotiateLanguage({
    cookie: request.cookies.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const url = request.nextUrl.clone();
  url.pathname = `/${language}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  // Skip API routes, Next internals and any file with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
