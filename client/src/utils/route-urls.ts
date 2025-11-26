export class RouteUrls {
  // Public routes
  static healthEndpoint = '/api/health';

  // Not implemented yet, just placeholder for future use
  static signInPageUrl = '/sign-in';
  static signInPageWithRedirect = (redirect_url: string) => `${this.signInPageUrl}?redirect_url=${redirect_url}`;
  // Not implemented yet, just placeholder for future use
  static signUpPageUrl = '/sign-up';
  static signUpPageWithRedirect = (redirect_url: string) => `${this.signUpPageUrl}?redirect_url=${redirect_url}`;

  // Authenticated Routes & Route Generators
  static homePageUrl = '/workbooks'; // NOTE! Root is redirected to this page.
  static dataSourcesPageUrl = '/data-sources';
  static healthPageUrl = '/health';
  static workbookPageUrl = (id: string) => `/workbooks/${id}`;
  static workbookNewTabPageUrl = (id: string) => `/workbooks/${id}/new`;
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
  static devToolsMigrationsPageUrl = '/dev/migrations';

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

  /**
   * Updates the current path without triggering a rerender of the page
   * @param workbookId - The ID of the workbook
   * @param tableId - The ID of the table. If undefined, the table id will be removed from the path.
   * @param recordId - The ID of the record. If undefined, the record id will be removed from the path.
   * @param columnId - The ID of the column. If undefined, the column id will be removed from the path.
   */
  static updateWorkbookPath = (workbookId: string, tableId?: string, recordId?: string, columnId?: string) => {
    if (tableId && recordId && columnId) {
      window.history.replaceState(null, '', RouteUrls.workbookColumnView(workbookId, tableId, recordId, columnId));
    } else if (tableId && recordId) {
      window.history.replaceState(null, '', RouteUrls.workbookRecordView(workbookId, tableId, recordId));
    } else if (tableId) {
      window.history.replaceState(null, '', RouteUrls.workbookTablePage(workbookId, tableId));
    } else {
      window.history.replaceState(null, '', RouteUrls.workbookPageUrl(workbookId));
    }
  };
}
