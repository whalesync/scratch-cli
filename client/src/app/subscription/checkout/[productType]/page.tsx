'use client';
import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { FullPageLoader } from '@/app/components/FullPageLoader';
import { Info } from '@/app/components/InfoPanel';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { paymentApi } from '@/lib/api/payment';
import { stringToEnum } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { ScratchpadPlanType } from '@spinner/shared-types';
import { RotateCwIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { JSX, useEffect, useState } from 'react';

async function goToPaymentCheckoutUrl(args: { productType: string | string[] | undefined }): Promise<void> {
  if (typeof args.productType === 'string' && typeof window !== 'undefined') {
    const rawProductType = args.productType;
    const productType: ScratchpadPlanType = stringToEnum(
      rawProductType,
      ScratchpadPlanType,
      ScratchpadPlanType.STARTER_PLAN,
    );
    // Generate a URL and redirect to it.
    // This will either be a link to create a new subscription, or to update the current subscription if it exists.
    const result = await paymentApi.createCheckoutSession(productType);
    window.location.replace(result.url);
  }
}

/**
 * Generates a Stripe Checkout URL based on the signed-in user and the productType requested, then
 * redirects to it.
 *
 * The `productType` parameter accepts the strings from the `ProductType`, and defaults to 'starter'.
 */
const ProductCheckoutRedirect = (): JSX.Element => {
  const params = useParams();
  const { isSignedIn } = useScratchPadUser();
  const [error, setError] = useState<string | null>(null);

  const productType = params.productType as string;

  useEffect(() => {
    if (isSignedIn && productType) {
      goToPaymentCheckoutUrl({
        productType,
      }).catch((e) => {
        console.error('Failed to load payment checkout URL: ', e);
        setError(e.message);
      });
    }
  }, [productType, isSignedIn]);

  if (error) {
    return (
      <Info>
        <Info.ErrorIcon />
        <Info.Title>Unable to load Stripe billing portal.</Info.Title>
        <Info.StatusPageDescription />
        <Info.Actions>
          <ButtonSecondaryOutline href={RouteUrls.homePageUrl} leftSection={<RotateCwIcon />} component="a">
            Return to Snapshots
          </ButtonSecondaryOutline>
        </Info.Actions>
      </Info>
    );
  }

  return <FullPageLoader />;
};

export default ProductCheckoutRedirect;
