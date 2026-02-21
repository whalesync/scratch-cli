import { SourceFkToDestFkOptions } from '@spinner/shared-types';
import { sourceFkToDestFkTransformer } from '../implementations/source-fk-to-dest-fk.transformer';
import { LookupTools, SyncRecord, TransformContext } from '../transformer.types';

const REFERENCED_FOLDER = 'dfd_dest_authors' as const;

function createLookupTools(mapping: Record<string, string> = {}): LookupTools {
  return {
    getDestinationPathForSourceFk: jest.fn((fk: string) => Promise.resolve(mapping[fk] ?? null)),
    lookupFieldFromFkRecord: jest.fn(),
  };
}

function createContext(
  sourceValue: unknown,
  lookupTools: LookupTools,
  options: SourceFkToDestFkOptions = { referencedDataFolderId: REFERENCED_FOLDER },
  phase: 'DATA' | 'FOREIGN_KEY_MAPPING' = 'FOREIGN_KEY_MAPPING',
): TransformContext {
  const sourceRecord: SyncRecord = { id: 'test', filePath: '/test.json', fields: { fk: sourceValue } };
  return { sourceRecord, sourceFieldPath: 'fk', sourceValue, lookupTools, options, phase };
}

describe('sourceFkToDestFkTransformer', () => {
  it('should have correct type', () => {
    expect(sourceFkToDestFkTransformer.type).toBe('source_fk_to_dest_fk');
  });

  it('should skip during DATA phase', async () => {
    const result = await sourceFkToDestFkTransformer.transform(
      createContext('src_1', createLookupTools(), undefined, 'DATA'),
    );
    expect(result).toEqual({ success: true, skip: true });
  });

  describe('null/undefined handling', () => {
    it('should return null for null input', async () => {
      const result = await sourceFkToDestFkTransformer.transform(createContext(null, createLookupTools()));
      expect(result).toEqual({ success: true, value: null });
    });

    it('should return null for undefined input', async () => {
      const result = await sourceFkToDestFkTransformer.transform(createContext(undefined, createLookupTools()));
      expect(result).toEqual({ success: true, value: null });
    });
  });

  describe('scalar resolution', () => {
    it('should resolve a string FK', async () => {
      const lookup = createLookupTools({ src_1: 'dest-authors/alice.json' });
      const result = await sourceFkToDestFkTransformer.transform(createContext('src_1', lookup));
      expect(result).toEqual({ success: true, value: '@/dest-authors/alice.json' });
    });

    it('should resolve a numeric FK', async () => {
      const lookup = createLookupTools({ '42': 'dest-authors/bob.json' });
      const result = await sourceFkToDestFkTransformer.transform(createContext(42, lookup));
      expect(result).toEqual({ success: true, value: '@/dest-authors/bob.json' });
    });

    it('should fail when FK cannot be resolved', async () => {
      const result = await sourceFkToDestFkTransformer.transform(createContext('missing', createLookupTools()));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Could not resolve foreign key "missing"');
      }
    });
  });

  describe('array resolution', () => {
    it('should resolve an array of FKs', async () => {
      const lookup = createLookupTools({ src_1: 'authors/alice.json', src_2: 'authors/bob.json' });
      const result = await sourceFkToDestFkTransformer.transform(createContext(['src_1', 'src_2'], lookup));
      expect(result).toEqual({ success: true, value: ['@/authors/alice.json', '@/authors/bob.json'] });
    });

    it('should skip null/undefined elements in arrays', async () => {
      const lookup = createLookupTools({ src_1: 'authors/alice.json' });
      const result = await sourceFkToDestFkTransformer.transform(createContext(['src_1', null, undefined], lookup));
      expect(result).toEqual({ success: true, value: ['@/authors/alice.json'] });
    });

    it('should fail if any array element cannot be resolved', async () => {
      const lookup = createLookupTools({ src_1: 'authors/alice.json' });
      const result = await sourceFkToDestFkTransformer.transform(createContext(['src_1', 'missing'], lookup));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Could not resolve foreign key "missing"');
      }
    });

    it('should fail for non-string/number array elements', async () => {
      const lookup = createLookupTools();
      const result = await sourceFkToDestFkTransformer.transform(createContext([{ id: 1 }], lookup));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected string or number for FK array element');
      }
    });
  });

  describe('error cases', () => {
    it('should fail for object input', async () => {
      const result = await sourceFkToDestFkTransformer.transform(createContext({ id: 1 }, createLookupTools()));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected string, number, or array');
      }
    });

    it('should fail for boolean input', async () => {
      const result = await sourceFkToDestFkTransformer.transform(createContext(true, createLookupTools()));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected string, number, or array');
      }
    });
  });
});
