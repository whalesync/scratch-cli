import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextMiddleware, NextRequest } from "next/server";
import { RouteUrls } from "./utils/route-urls";

function createMiddleware(): NextMiddleware {
  const isPublicRoute = createRouteMatcher(RouteUrls.publicRoutePatterns);

  return clerkMiddleware(
    async (auth, req) => {
      const { userId, redirectToSignIn } = await auth();

      if (!userId && !isPublicRoute(req)) {
        return redirectToSignIn({ returnBackUrl: originalUrl(req) });
      }
    },
    { debug: false }
  );
}

export default createMiddleware();

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

function originalUrl(req: NextRequest): string {
  const url = new URL(req.url);

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    url.hostname = forwardedHost;
    url.port = "";
  }

  return url.toString();
}
