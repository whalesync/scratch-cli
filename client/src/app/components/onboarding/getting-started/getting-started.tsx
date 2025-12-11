import { OnboardingFlowUI } from '@/app/components/onboarding/types';
import { SuggestionsShortcutsContent } from './steps/SuggestionsShortcutsContent';

export const gettingStartedFlowUI: OnboardingFlowUI = {
  flowKey: 'gettingStartedV1',
  steps: [
    {
      stepKey: 'dataSourceConnected',
      data: {
        title: 'Connect data source',
        description: 'Connect an app to import your own data or try out Scratch with demo data.',
      },
    },
    {
      stepKey: 'contentEditedWithAi',
      data: {
        title: 'Edit content with chat',
        description:
          'Write a prompt to bulk-edit all records at once. You can review the suggested changes afterwards.',
      },
    },
    {
      stepKey: 'suggestionsAccepted',
      data: {
        title: 'Review suggestions',
        description:
          'Accept the edits you like, reject the rest. You can review all at once, or go through each record or field individually.',
        content: () => <SuggestionsShortcutsContent />,
      },
    },
    {
      stepKey: 'dataPublished',
      data: {
        title: 'Publish changes',
        description: 'Sync your changes back to the source.',
      },
    },
  ],
};
