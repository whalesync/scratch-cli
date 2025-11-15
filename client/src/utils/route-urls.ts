export class RouteUrls {
  // Public routes
  static healthEndpoint = '/api/health';
  static signInPageUrl = '/sign-in';
  static signInPageWithRedirect = (redirect_url: string) => `${this.signInPageUrl}?redirect_url=${redirect_url}`;
  static signUpPageUrl = '/sign-up';
  static signUpPageWithRedirect = (redirect_url: string) => `${this.signUpPageUrl}?redirect_url=${redirect_url}`;

  // Authenticated Routes & Route Generators
  static homePageUrl = '/';
  static dataSourcesPageUrl = '/data-sources';
  static healthPageUrl = '/health';
  static workbookPageUrl = (id: string, tableId?: string, recordId?: string) => {
    if (tableId && recordId) {
      return this.workbookRecordView(id, tableId, recordId);
    }
    if (tableId) {
      return this.workbookTablePage(id, tableId);
    }
    return `/workbooks/${id}`;
  };
  static workbookTablePage = (id: string, tableId: string) => `/workbooks/${id}/${tableId}`;
  static workbookRecordView = (id: string, tableId: string, recordId: string) =>
    `/workbooks/${id}/${tableId}/${recordId}`;
  static workbookColumnView = (id: string, tableId: string, recordId: string, columnId: string) =>
    `/workbooks/${id}/${tableId}/${recordId}/${columnId}`;
  static workbooksPageUrl = '/workbooks';
  static promptAssetsPageUrl = '/prompt-assets';
  static settingsPageUrl = '/settings';
  static productCheckoutPage = (productType: string) => `/subscription/checkout/${productType}`;
  static manageSubscriptionPage = '/subscription/manage';

  // Dev Tools routes
  static devToolsPageUrl = '/dev';
  static devToolsGalleryPageUrl = '/dev/gallery';
  static devToolsJobsPageUrl = '/dev/jobs';
  static devToolsUsersPageUrl = '/dev/users';

  /** Utils */

  static publicRoutePatterns = [this.healthEndpoint, this.signInPageUrl, this.signUpPageUrl];

  /**
   * Public routes are endpoints that don't require any authentication, user identification or JWT tokens
   * Pretty much limited to health check endpoints and signin/signup pages
   */
  static isPublicRoute(pathname: string): boolean {
    return RouteUrls.publicRoutePatterns.some((pattern) => new RegExp(pattern).test(pathname));
  }

  static subscriptionRoutePatterns = [
    `^\/$`, // root path
    RouteUrls.dataSourcesPageUrl,
    RouteUrls.workbooksPageUrl,
    RouteUrls.promptAssetsPageUrl,
    RouteUrls.workbooksPageUrl,
    RouteUrls.promptAssetsPageUrl,
  ];

  /** Routes that require an active subscription or free trial to access*/
  static isSubscribedOnlyRoute(pathname: string): boolean {
    return RouteUrls.subscriptionRoutePatterns.some((pattern) => new RegExp(pattern).test(pathname));
  }
}
