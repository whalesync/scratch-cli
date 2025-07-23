export class RouteUrls {
  // Public routes
  static healthEndpoint = "/api/health";

  static publicRoutePatterns = [this.healthEndpoint];

  /**
   * Public routes are endpoints that don't require any authentication, user identification or JWT tokens
   * Pretty much limited to health check endpoints and signin/signup pages
   */
  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) =>
      new RegExp(pattern).test(pathname)
    );
  }

  // Authenticated Routes & Route Generators
  static connectionsPageUrl = "/connector-accounts";
  static apiImportDemoPageUrl = "/ai-connector-builder";
  static healthPageUrl = "/health";
  static snapshotPage = (id: string) => `/snapshots/${id}`;
  static snapshotsPageUrl = "/snapshots";
  static styleGuidesPageUrl = "/style-guides";
  static styleGuidePage = (id: string) => `/style-guides/${id}`;
  static csvFilesPageUrl = "/csv-files";
  static csvFilePage = (id: string) => `/csv-files/${id}`;
}
