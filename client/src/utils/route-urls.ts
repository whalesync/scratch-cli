export class RouteUrls {
  // Public routes
  static healthPageUrl = "/health";
  static rootPageUrl = "/";
  static chatPageUrl = "/chat";

  static publicRoutePatterns = [RouteUrls.healthPageUrl, RouteUrls.rootPageUrl, RouteUrls.chatPageUrl];

  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) =>
      new RegExp(pattern).test(pathname)
    );
  }
}
