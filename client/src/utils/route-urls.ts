export class RouteUrls {
  // Public routes
  static healthEndpoint = "/api/health";
  static signInPageUrl = "/sign-in";
  static signInPageWithRedirect = (redirect_url: string) => `${this.signInPageUrl}?redirect_url=${redirect_url}`;
  static signUpPageUrl = "/sign-up";
  static signUpPageWithRedirect = (redirect_url: string) => `${this.signUpPageUrl}?redirect_url=${redirect_url}`;
  
  // Authenticated Routes & Route Generators
  static homePageUrl = "/";
  static connectionsPageUrl = "/connections";
  static apiImportDemoPageUrl = "/ai-connector-builder";
  static healthPageUrl = "/health";
  static snapshotPage = (id: string, tableId?: string, recordId?: string) => {
    if (tableId && recordId) {
      return this.snapshotRecordView(id, tableId, recordId);
    }
    if (tableId) {
      return this.snapshotTablePage(id, tableId);
    }
    return `/snapshots/${id}`;
  };
  static snapshotTablePage = (id: string, tableId: string) => `/snapshots/${id}/${tableId}`;
  static snapshotRecordView = (id: string, tableId: string, recordId: string) => `/snapshots/${id}/${tableId}/${recordId}`;
  static snapshotColumnView = (id: string, tableId: string, recordId: string, columnId: string) =>
    `/snapshots/${id}/${tableId}/${recordId}/${columnId}`;
  static snapshotsPageUrl = "/snapshots";
  static resourcesPageUrl = "/resources";
  static csvFilesPageUrl = "/csv-files";
  static uploadsPageUrl = "/uploads";
  static settingsPageUrl = "/settings";
  static productCheckoutPage = (productType: string) => `/subscription/checkout/${productType}`;
  static manageSubscriptionPage = "/subscription/manage";

  // Dev Tools routes
  static devToolsPageUrl = "/dev";
  static devToolsGalleryPageUrl = "/dev/gallery";
  static devToolsJobsPageUrl = "/dev/jobs";
  static devToolsUsersPageUrl = "/dev/users";
  static devToolsSnapshotMigratorPageUrl = "/dev/snapshot-migrator";

  /** Utils */

  static publicRoutePatterns = [this.healthEndpoint, this.signInPageUrl, this.signUpPageUrl];

  /**
   * Public routes are endpoints that don't require any authentication, user identification or JWT tokens
   * Pretty much limited to health check endpoints and signin/signup pages
   */
  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) =>
      new RegExp(pattern).test(pathname)
    );
  }

  static subscriptionRoutePatterns = [
    `^\/$`, // root path
    RouteUrls.connectionsPageUrl,
    RouteUrls.apiImportDemoPageUrl,
    RouteUrls.snapshotsPageUrl,
    RouteUrls.resourcesPageUrl,
    RouteUrls.snapshotsPageUrl,
    RouteUrls.resourcesPageUrl,
    RouteUrls.csvFilesPageUrl,
    RouteUrls.uploadsPageUrl,
  ];

  /** Routes that require an active subscription or free trial to access*/
  static isSubscribedOnlyRoute(pathname: string): boolean {
    return RouteUrls.subscriptionRoutePatterns.some((pattern) => new RegExp(pattern).test(pathname));
  }
}
