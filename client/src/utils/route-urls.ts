export class RouteUrls {
  // Public routes
  static healthEndpoint = '/api/health';
  static pricingPageUrl = '/pricing';

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
  static workbookScratchSyncPageUrl = (id: string) => `/workbooks/${id}`;
  static workbookNewTabPageUrl = (id: string) => `/workbooks/${id}/new`;
  static workbookTablePage = (id: string, tableId: string) => `/workbooks/${id}/${tableId}`;
  static workbookRecordView = (id: string, tableId: string, recordId: string) =>
    `/workbooks/${id}/${tableId}/${recordId}`;
  static workbookColumnView = (id: string, tableId: string, recordId: string, columnId: string) =>
    `/workbooks/${id}/${tableId}/${recordId}/${columnId}`;
  static workbooksPageUrl = '/workbooks';
  static settingsPageUrl = '/settings';
  static billingPageUrl = '/billing';
  static productCheckoutPage = (planType: string, returnPath?: string) =>
    `/subscription/checkout/${planType}${returnPath ? `?returnPath=${returnPath}` : ''}`;

  // Dev Tools routes
  static devToolsPageUrl = '/dev';
  static devToolsGalleryPageUrl = '/dev/gallery';
  static devToolsGridPageUrl = '/dev/grid';
  static devToolsJobsPageUrl = '/dev/jobs';
  static devToolsUsersPageUrl = '/dev/users';
  static devToolsMigrationsPageUrl = '/dev/migrations';
  static devToolsSyncDataFoldersPageUrl = '/dev/sync-data-folders';

  /** Utils */

  static publicRoutePatterns = [this.healthEndpoint, this.pricingPageUrl, this.signInPageUrl, this.signUpPageUrl];

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
    '/workbooks',
  ];

  /** Routes that require an active subscription or free trial to access*/
  static isSubscribedOnlyRoute(pathname: string): boolean {
    return RouteUrls.subscriptionRoutePatterns.some((pattern) => new RegExp(pattern).test(pathname));
  }

  /**
   * Updates the current path without triggering a rerender of the page
   * @param workbookId - The ID of the workbook
   * @param tableId - The ID of the table. If undefined, the table id will be removed from the path.
   * @param recordId - The ID or name of the file. If undefined, the record id will be removed from the path.
   */
  static updateWorkbookPath = (workbookId: string, tableId?: string, recordId?: string) => {
    const base = '/workbooks';

    let url = `${base}/${workbookId}`;

    // Don't include transient new-tab IDs in the URL
    const isNewTab = tableId?.startsWith('new-tab') || tableId === 'new';
    if (tableId && !isNewTab) {
      url += `/${tableId}`;
      if (recordId) {
        url += `/${recordId}`;
      }
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url);
    }
  };

  /**
   * Updates the URL path for file-based workbook views.
   * @param workbookId - The ID of the workbook
   * @param viewType - The view type: 'files' or 'review'
   * @param filePath - The file path (optional)
   */
  static updateWorkbookFilePath = (workbookId: string, viewType?: 'files' | 'review', filePath?: string) => {
    let url = `/workbooks/${workbookId}`;

    if (viewType) {
      url += `/${viewType}`;
      if (filePath) {
        // Strip leading slashes to avoid double slashes
        const cleanPath = filePath.replace(/^\/+/, '');
        if (cleanPath) {
          url += `/${cleanPath}`;
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url);
    }
  };
}
