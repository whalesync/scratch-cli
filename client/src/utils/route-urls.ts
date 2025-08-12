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
  static homePageUrl = "/";
  static connectionsPageUrl = "/connections";
  static apiImportDemoPageUrl = "/ai-connector-builder";
  static healthPageUrl = "/health";
  static snapshotPage = (id: string) => `/snapshots/${id}`;
  static snapshotTablePage = (id: string, tableId: string) => `/snapshots/${id}/${tableId}`;
  static snapshotRecordView = (id: string, tableId: string, recordId: string) => `/snapshots/${id}/${tableId}/${recordId}`;
  static snapshotColumnView = (id: string, tableId: string, recordId: string, columnId: string) =>
    `/snapshots/${id}/${tableId}/${recordId}/${columnId}`;
  static snapshotsPageUrl = "/snapshots";
  static styleGuidesPageUrl = "/style-guides";
  static csvFilesPageUrl = "/csv-files";
  static settingsPageUrl = "/settings";
}
