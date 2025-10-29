import { Flavor } from "@/utils/build";

export function clerkUserUrl(clerkId: string, flavor: Flavor): string {
    // these values are pulled from the clerk dashboard by going to the Users page and clicking on a specific user, then copying the URL
    if (flavor === Flavor.Production) {
      return `https://dashboard.clerk.com/apps/app_2ymxByR3cEOiOZGKx91GRzHZQ3f/instances/ins_31IAVihYbmlklAm4ErCH5ijgND5/users/${clerkId}`;
    } else {
      return `https://dashboard.clerk.com/apps/app_2ymxByR3cEOiOZGKx91GRzHZQ3f/instances/ins_2ymxBtQskUovRqqMFxDlz8s4QNT/users/${clerkId}`;
    }
  }

  export function stripeCustomerUrl(stripeId: string, flavor: Flavor): string {
    if (flavor === Flavor.Production) {
      return `https://dashboard.stripe.com/acct_1SNB1tBuGFTHqsGm/customers/${stripeId}`;
    } else if (flavor === Flavor.Staging) {
        return `https://dashboard.stripe.com/acct_1SNIphPd1pp0ErHM/test/customers/${stripeId}`;
    } else {
      return `https://dashboard.stripe.com/acct_1SNIouBdRE0kMHNq/test/customers/${stripeId}`;
    }
  }


  