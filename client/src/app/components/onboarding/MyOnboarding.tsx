import { OnboardingWidget, ShortcutsContent, StepData } from './OnboardingWidget';
export const MyOnboarding = () => {
  const steps: StepData[] = [
    {
      id: '1',
      title: 'Add data source',
      description: 'Connect your data source to get started.',
      isCompleted: true,
    },
    {
      id: '2',
      title: 'Edit content with chat',
      description: 'Write a prompt to bulk-edit all records at once.',
      isCompleted: false,
      content: <ShortcutsContent />, // Renders the shortcut keys from screenshot
    },
    {
      id: '3',
      title: 'Review suggestions',
      description: 'Accept the edits you like, reject the rest.',
      isCompleted: false,
    },
    {
      id: '4',
      title: 'Publish changes',
      description: 'Sync your changes back to the source.',
      isCompleted: false,
    },
  ];
  return (
    <OnboardingWidget
      steps={steps}
      onClose={() => console.log('closed')}
      onToggleStep={(id) => console.log('toggled', id)}
    />
  );
};
