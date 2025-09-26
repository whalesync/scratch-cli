import { UserCluster } from 'src/db/cluster-types';

export class SlackFormatters {
  private constructor() {}

  /**
   * Formats a link in Slack markdown format, which is not the same as the regularl []() format.
   * @param label label for the link
   * @param url the url for the link
   * @returns Encoded link in Slack mkdn format
   */
  static formatLink(label: string, url: string): string {
    return `<${url}|${label}>`;
  }

  static newUserSignup(user: UserCluster.User, offerCode?: string): string {
    return `New user signup: ${user.email || user.name || 'no email'} ${offerCode ? `with offer code ${offerCode}` : ''} -- ${user.id}`;
  }
}
