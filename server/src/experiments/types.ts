import { JsonValue } from '@openfeature/core';

export type FlagDataType = 'boolean' | 'string' | 'number' | 'array';

export type ExperimentFlagVariantValue = string | number | undefined | JsonValue;
