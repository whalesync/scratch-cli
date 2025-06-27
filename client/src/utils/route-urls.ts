export class RouteUrls {
  // Public routes
  static healthPageUrl = "/health";
  static rootPageUrl = "/";
  static chatPageUrl = "/chat";

  static publicRoutePatterns = [
    RouteUrls.healthPageUrl,
    RouteUrls.rootPageUrl,
    RouteUrls.chatPageUrl,
  ];

  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) =>
      new RegExp(pattern).test(pathname)
    );
  }

  // Internal Routes
  static connectionsPageUrl = "/connector-accounts";
  static apiImportDemoPageUrl = "/api-import-demo";
  static chatToolPageUrl = "/chat";
  static snapshotPage = (id: string) => `/snapshots/${id}`;
}
