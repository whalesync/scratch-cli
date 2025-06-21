export class RouteUrls {
  // Public routes
  static healthPageUrl = "/health";

  static publicRoutePatterns = [RouteUrls.healthPageUrl];

  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) =>
      new RegExp(pattern).test(pathname)
    );
  }
}
