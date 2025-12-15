import { FC } from 'react';
// import { DiffText } from './DiffText';
import { DiffText } from '@/app/components/field-value-wrappers/DiffText';
import { diffWordsWithSpace } from 'diff';

interface DiffViewerProps {
  originalValue: string;
  suggestedValue: string;
}

export const DiffViewer: FC<DiffViewerProps> = (props) => {
  const { originalValue, suggestedValue } = props;

  // diff functions don't work with null values or undefined values, and require strings
  const originalValueSafe = String(originalValue ?? '');
  const suggestedValueSafe = String(suggestedValue ?? '');

  // Run the diff and included whitespace in the changes
  const changes = diffWordsWithSpace(originalValueSafe, suggestedValueSafe);

  return <DiffText changes={changes} px={12} py={5} />;
};
