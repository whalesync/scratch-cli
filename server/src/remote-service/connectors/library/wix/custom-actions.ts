import { draftPosts } from '@wix/blog';
import { createClient, OAuthStrategy, TokenRole } from '@wix/sdk';
import { WixBlogTableSpec } from '../custom-spec-registry';

export interface PublishDraftPostsParams {
  tableSpec: WixBlogTableSpec;
  records: Array<{ wsId: string; remoteId: string }>;
}

export interface PublishDraftPostsResponse {
  publishedPostIds?: string[];
  errors?: Array<{
    draftPostId?: string;
    message?: string;
  }>;
}

/**
 * Wix custom actions for publishing draft blog posts.
 *
 * This class provides methods to interact with Wix's Blog API to publish
 * draft posts that have been synced from the Scratchpad workspace.
 */
export class WixCustomActions {
  private readonly wixClient: ReturnType<
    typeof createClient<undefined, ReturnType<typeof OAuthStrategy>, { draftPosts: typeof draftPosts }>
  >;

  constructor(accessToken: string) {
    this.wixClient = createClient({
      auth: OAuthStrategy({
        clientId: '', // Not needed for just using access tokens
        tokens: {
          accessToken: {
            value: accessToken,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now (Wix tokens expire in 5 minutes)
          },
          refreshToken: {
            value: '',
            role: TokenRole.NONE,
          },
        },
      }),
      modules: {
        draftPosts,
      },
    });
  }

  /**
   * Publishes one or more draft posts in Wix Blog.
   *
   * If a draft post was already published, the published post will be updated
   * with the latest values from the draft post.
   *
   * @param params - Parameters containing the table spec and records to publish
   * @returns Response with published post IDs and any errors encountered
   */
  async publishDraftPosts(params: PublishDraftPostsParams): Promise<PublishDraftPostsResponse> {
    const { records } = params;

    const publishedPostIds: string[] = [];
    const errors: Array<{ draftPostId?: string; message?: string }> = [];

    // Publish each draft post individually
    for (const record of records) {
      try {
        const draftPostId = record.remoteId;

        // Call the Wix API to publish the draft post
        const response = await this.wixClient.draftPosts.publishDraftPost(draftPostId);

        if (response.postId) {
          publishedPostIds.push(response.postId);
        }
      } catch (error) {
        errors.push({
          draftPostId: record.remoteId,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }

    return {
      publishedPostIds: publishedPostIds.length > 0 ? publishedPostIds : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
