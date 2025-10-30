export type WixAuthor = {
  id: string | null | undefined;
  email: string | null | undefined;
};

export type WixBlogTableSpecExtras = {
  // Wix authors are needed when creating blog posts (JSON-safe representation)
  wixAuthors?: WixAuthor[];
};

export type WixBlogColumnSpecExtras = {
  // Wix field type for special handling
  wixFieldType?: string;
};
