declare module "node-diff3" {
  export interface IMergeOptions {
    excludeFalseConflicts?: boolean;
    stringSeparator?: string | RegExp;
  }

  export interface MergeRegion<T> {
    ok?: T[];
    conflict?: {
      a: T[];
      aIndex: number;
      b: T[];
      bIndex: number;
      o: T[];
      oIndex: number;
    };
  }

  /**
   * Performs a 3-way diff.
   * Based on types from node-diff3 v3.2.0
   */
  export function diff3Merge<T>(
    a: string | T[],
    o: string | T[],
    b: string | T[],
    options?: IMergeOptions,
  ): MergeRegion<T>[];
}
