import * as React from 'react';
import { Mention, MentionProps, SuggestionDataItem, SuggestionFunc } from 'react-mentions';

export type TypesafeDataFunc<T extends SuggestionDataItem> = (
  query: string,
  callback: (data: T[]) => void,
) => Promise<T[]> | T[] | void | Promise<void>;

type Props<T extends SuggestionDataItem, TTrigger extends string> = Omit<
  MentionProps,
  'data' | 'renderSuggestion' | 'trigger'
> & {
  // | 'markup'
  trigger: TTrigger; // Drop RegExp support
  markup: `${TTrigger}[__display__](__id__)`; // We cannot just generate it since the lib does some magic on this field
  data: T[] | TypesafeDataFunc<T>;
  renderSuggestion: (
    suggestion: T,
    search: string,
    highlightedDisplay: React.ReactNode,
    index: number,
    focused: boolean,
  ) => React.ReactNode;
  appendSpaceOnAdd?: boolean;
};

export const TypesafeMention = <T extends SuggestionDataItem, TTrigger extends string>(props: Props<T, TTrigger>) => {
  const { renderSuggestion, ...rest } = props;
  return <Mention {...rest} renderSuggestion={renderSuggestion as SuggestionFunc} />;
};
