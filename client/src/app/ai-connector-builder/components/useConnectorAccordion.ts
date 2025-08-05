import { useState } from 'react';

export const useConnectorAccordion = () => {
  // State for accordion control
  const [accordionValue, setAccordionValue] = useState<string[]>([
    'step1',
    'step2',
    'step3',
    'step4',
    'step5',
    'step6',
    'step7',
    'step8',
  ]);

  // Expand all accordion items
  const expandAll = () => {
    setAccordionValue(['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8']);
  };

  // Collapse all accordion items
  const collapseAll = () => {
    setAccordionValue([]);
  };

  return {
    accordionValue,
    setAccordionValue,
    expandAll,
    collapseAll,
  };
};