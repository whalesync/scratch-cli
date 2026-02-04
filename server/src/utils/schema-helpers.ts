import { TSchema } from '@sinclair/typebox';

/**
 * Extracts all possible dot-notation paths from a JSON Schema.
 * E.g. { a: { b: 1 } } -> ['a', 'a.b']
 */
export function extractSchemaPaths(schema: TSchema, parentPath = ''): string[] {
  const paths = new Set<string>();

  // Base Path (if meaningful)
  if (parentPath) {
    paths.add(parentPath);
  }

  // Handle Unions (anyOf/oneOf/Optional)
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf || schema.oneOf) as TSchema[];
    for (const variant of variants) {
      if (variant.type === 'null') continue;
      const subPaths = extractSchemaPaths(variant, parentPath);
      subPaths.forEach((p) => paths.add(p));
    }
  }

  // Object Traverse
  if (schema.type === 'object' && schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties as Record<string, TSchema>)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      const subPaths = extractSchemaPaths(propSchema, currentPath);
      subPaths.forEach((p) => paths.add(p));
    }
  }

  // Array Traverse (Experimental/Partial)
  // If array, we generally map to the array itself (already added via parentPath).
  // Deep mapping into arrays (array[].prop) is not yet standard in this mapper.

  return Array.from(paths);
}
