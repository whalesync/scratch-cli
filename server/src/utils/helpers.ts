/**
 * Return the enum value in string enum `T` named `strVal`, or `defaultValue` if it isn't recognized.
 * Accepts values of `strVal` that are either case name ('FOO') OR case value ('foo').
 */
export function stringToEnum<T extends object, DefaultType>(
  strVal: string,
  type: T,
  defaultValue: DefaultType,
): T[keyof T] | DefaultType {
  for (const [k, v] of Object.entries(type)) {
    if (strVal === k || strVal === v) {
      return type[k as keyof T];
    }
  }
  return defaultValue;
}
