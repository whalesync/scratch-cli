// WordPress API types

export type WordPressRecord = { [Key in string]?: unknown } & { id?: number };

export type WordPressDownloadProgress = {
  nextOffset: number | undefined;
};

/**
 * Response to a WordPress discovery request.
 * https://developer.wordpress.org/rest-api/using-the-rest-api/discovery/
 * Includes only relevant properties.
 */
export interface WordPressGetDiscoveryApiResponse {
  name: string;
  url: string;
  routes: { [Key in string]?: WordPressRoute };
}

/** Includes only relevant properties. */
export interface WordPressRoute {
  endpoints: WordPressEndpoint[];
}

/** Includes only relevant properties. */
export interface WordPressEndpoint {
  args: { [Key in string]?: WordPressArgument };
}

/** Includes only relevant properties. */
export interface WordPressArgument {
  type: string | string[];
  // Optional:
  required?: boolean;
  writeOnly?: boolean;
  readonly?: boolean;
  writeOnce?: boolean;
  properties?: { [Key in string]?: WordPressArgument };
  format?: string;
  enum?: string[];
  context?: string[];
}

/** Includes only relevant properties. */
export interface WordPressRendered {
  rendered: string;
}

/**
 * Response to a WordPress schema request.
 * Includes only relevant properties.
 */
export interface WordPressEndpointOptionsResponse {
  endpoints: WordPressEndpoint[];
  schema: {
    properties: { [Key in string]?: WordPressArgument } & {
      acf?: {
        properties?: { [Key in string]?: WordPressArgument };
      };
    };
  };
}

/**
 * Response to a WordPress types request.
 * https://developer.wordpress.org/rest-api/reference/post-types/
 * Includes only relevant properties.
 */
export interface WordPressGetTypesApiResponse {
  [typeName: string]: WordPressPostType;
}

/** Includes only relevant properties. */
export interface WordPressPostType {
  name: string;
  rest_base: string;
  rest_namespace?: string;
  slug?: string;
  description?: string;
  hierarchical?: boolean;
}

export enum WordPressDataType {
  STRING = 'wordpress/string',
  EMAIL = 'wordpress/email',
  URI = 'wordpress/uri',
  ENUM = 'wordpress/enum',
  INTEGER = 'wordpress/integer',
  NUMBER = 'wordpress/number',
  BOOLEAN = 'wordpress/boolean',
  DATE = 'wordpress/date',
  DATETIME = 'wordpress/datetime',
  ARRAY = 'wordpress/array',
  OBJECT = 'wordpress/object',
  RENDERED = 'wordpress/rendered',
  RENDERED_INLINE = 'wordpress/renderedinline',
  FOREIGN_KEY = 'wordpress/foreignkey',
  // None of the above.
  UNKNOWN = 'wordpress/unknown',
}
