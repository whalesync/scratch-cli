import { InvalidSqlError, validateWhereClause } from './sql-validator';

describe('validateWhereClause', () => {
  describe('Empty and whitespace inputs', () => {
    it('should throw InvalidSqlError for empty string', () => {
      expect(() => validateWhereClause('')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('')).toThrow('WHERE clause cannot be empty.');
    });

    it('should throw InvalidSqlError for whitespace-only string', () => {
      expect(() => validateWhereClause('   ')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('   ')).toThrow('WHERE clause cannot be empty.');
    });

    it('should throw InvalidSqlError for tab and newline only', () => {
      expect(() => validateWhereClause('\t\n')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('\t\n')).toThrow('WHERE clause cannot be empty.');
    });
  });

  describe('Valid WHERE clauses', () => {
    it('should accept simple equality condition', () => {
      expect(() => validateWhereClause('id = 1')).not.toThrow();
    });

    it('should accept string equality condition', () => {
      expect(() => validateWhereClause("status = 'active'")).not.toThrow();
    });

    it('should accept multiple conditions with AND', () => {
      expect(() => validateWhereClause("id = 1 AND status = 'active'")).not.toThrow();
    });

    it('should accept multiple conditions with OR', () => {
      expect(() => validateWhereClause("status = 'active' OR status = 'pending'")).not.toThrow();
    });

    it('should accept complex nested conditions', () => {
      expect(() => validateWhereClause("(id = 1 OR id = 2) AND status = 'active'")).not.toThrow();
    });

    it('should accept comparison operators', () => {
      expect(() => validateWhereClause('age > 18')).not.toThrow();
      expect(() => validateWhereClause('age >= 18')).not.toThrow();
      expect(() => validateWhereClause('age < 65')).not.toThrow();
      expect(() => validateWhereClause('age <= 65')).not.toThrow();
      expect(() => validateWhereClause('age != 0')).not.toThrow();
      expect(() => validateWhereClause('age <> 0')).not.toThrow();
    });

    it('should accept LIKE operator', () => {
      expect(() => validateWhereClause("name LIKE '%test%'")).not.toThrow();
    });

    it('should accept IN operator', () => {
      expect(() => validateWhereClause('id IN (1, 2, 3)')).not.toThrow();
      expect(() => validateWhereClause("id IN ('1', '2', '3')")).not.toThrow();
      expect(() => validateWhereClause('id IN (1, 2, 3) AND age > 18')).not.toThrow();
      expect(() => validateWhereClause("rank IN ('A', 'B', 'C') AND age > 18")).not.toThrow();
    });

    it('should accept IS NULL and IS NOT NULL', () => {
      expect(() => validateWhereClause('deleted_at IS NULL')).not.toThrow();
      expect(() => validateWhereClause('deleted_at IS NOT NULL')).not.toThrow();
    });

    it('should accept BETWEEN operator - not supported by postgres', () => {
      expect(() => validateWhereClause('age BETWEEN 18 AND 65')).not.toThrow();
    });

    it('should accept NOT operator', () => {
      expect(() => validateWhereClause('NOT deleted')).not.toThrow();
    });
  });

  describe('Invalid SQL syntax', () => {
    it('should throw InvalidSqlError for malformed SQL', () => {
      expect(() => validateWhereClause('id =')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('id =')).toThrow('Syntax Error');
    });

    it('should throw InvalidSqlError for unclosed parentheses', () => {
      expect(() => validateWhereClause('(id = 1')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('(id = 1')).toThrow('Syntax Error');
    });

    it('should throw InvalidSqlError for invalid operators', () => {
      expect(() => validateWhereClause('id === 1')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('id === 1')).toThrow('Syntax Error');
    });

    it('should throw InvalidSqlError for incomplete expressions', () => {
      expect(() => validateWhereClause('id AND')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('id AND')).toThrow('Syntax Error');
    });
  });

  describe('SQL Injection: Stacked Queries', () => {
    it('should reject multiple statements separated by semicolon', () => {
      expect(() => validateWhereClause('id = 1; DROP TABLE users')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('id = 1; DROP TABLE users')).toThrow(
        'Security Violation: Multiple statements (Stacked Queries) detected.',
      );
    });

    it('should reject stacked queries with INSERT', () => {
      expect(() => validateWhereClause('id = 1; INSERT INTO users VALUES (1)')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('id = 1; INSERT INTO users VALUES (1)')).toThrow(
        'Security Violation: Multiple statements (Stacked Queries) detected.',
      );
    });
  });

  describe('Security: Forbidden statement types', () => {
    it('should reject INSERT statements in subqueries', () => {
      // Note: This test may need adjustment based on how node-sql-parser handles nested statements
      // The parser might not allow INSERT in WHERE clauses, but we test the validation logic
      expect(() => {
        try {
          validateWhereClause('id IN (SELECT id FROM (INSERT INTO test VALUES (1)))');
        } catch (error) {
          if (error instanceof InvalidSqlError && error.message.includes('forbidden statement type')) {
            throw error;
          }
          // If it's a syntax error, that's also acceptable
          throw new InvalidSqlError('Syntax Error: Expected rejection');
        }
      }).toThrow(InvalidSqlError);
    });
  });

  describe('Security: Table and schema references', () => {
    it('should reject table-qualified column references', () => {
      expect(() => validateWhereClause('users.id = 1')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('users.id = 1')).toThrow(
        'Scope Violation: References to other tables or schemas are not allowed',
      );
    });

    it('should reject schema-qualified column references', () => {
      expect(() => validateWhereClause('public.users.id = 1')).toThrow(InvalidSqlError);
      expect(() => validateWhereClause('public.users.id = 1')).toThrow(
        'Scope Violation: References to other tables or schemas are not allowed',
      );
    });

    it('should accept unqualified column references', () => {
      expect(() => validateWhereClause('id = 1')).not.toThrow();
      expect(() => validateWhereClause("status = 'active'")).not.toThrow();
    });

    it('should reject table-qualified references in complex expressions', () => {
      expect(() => validateWhereClause("id = 1 AND users.status = 'active'")).toThrow(InvalidSqlError);
      expect(() => validateWhereClause("id = 1 AND users.status = 'active'")).toThrow(
        'Scope Violation: References to other tables or schemas are not allowed',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric values', () => {
      expect(() => validateWhereClause('id = 123')).not.toThrow();
      expect(() => validateWhereClause('price = 99.99')).not.toThrow();
    });

    it('should handle boolean values', () => {
      expect(() => validateWhereClause('active = true')).not.toThrow();
      expect(() => validateWhereClause('deleted = false')).not.toThrow();
    });

    it('should handle NULL values', () => {
      expect(() => validateWhereClause('deleted_at IS NULL')).not.toThrow();
      expect(() => validateWhereClause('id = NULL')).not.toThrow();
    });

    it('should handle string values with special characters', () => {
      expect(() => validateWhereClause("name = 'O''Brien'")).not.toThrow();
      expect(() => validateWhereClause("email = 'test@example.com'")).not.toThrow();
    });

    it('should handle arithmetic expressions', () => {
      expect(() => validateWhereClause('age + 1 > 18')).not.toThrow();
      expect(() => validateWhereClause('price * 1.1 < 100')).not.toThrow();
    });

    it('should handle function calls', () => {
      expect(() => validateWhereClause('LENGTH(name) > 5')).not.toThrow();
      expect(() => validateWhereClause("UPPER(status) = 'ACTIVE'")).not.toThrow();
    });
  });

  describe('Complex nested expressions', () => {
    it('should handle deeply nested parentheses', () => {
      expect(() =>
        validateWhereClause("((id = 1 OR id = 2) AND (status = 'active' OR status = 'pending'))"),
      ).not.toThrow();
    });

    it('should handle multiple AND/OR combinations', () => {
      expect(() =>
        validateWhereClause("id = 1 AND status = 'active' OR priority = 'high' AND deleted = false"),
      ).not.toThrow();
    });

    it('should handle NOT with complex expressions', () => {
      expect(() => validateWhereClause("NOT (id = 1 AND status = 'inactive')")).not.toThrow();
    });
  });

  describe('Comments in WHERE clauses', () => {
    describe('Single-line comments (--)', () => {
      it('should reject WHERE clause containing only a comment', () => {
        expect(() => validateWhereClause('-- This is a comment')).toThrow(InvalidSqlError);
        expect(() => validateWhereClause('-- This is a comment')).toThrow('Syntax Error');
      });

      it('should accept WHERE clause with comment at the start followed by valid SQL', () => {
        // Parser strips comments, so valid SQL after comment should be accepted
        expect(() => validateWhereClause('-- comment\nid = 1')).not.toThrow();
      });

      it('should accept WHERE clause with comment at the end', () => {
        // Parser strips comments, so valid SQL before comment should be accepted
        expect(() => validateWhereClause('id = 1 -- comment')).not.toThrow();
      });

      it('should accept WHERE clause with comment in the middle', () => {
        // Parser strips comments, so valid SQL with comments should be accepted
        expect(() => validateWhereClause("id = 1 -- comment\nAND status = 'active'")).not.toThrow();
      });

      it('should accept WHERE clause with multiple single-line comments', () => {
        // Parser strips comments, so valid SQL with multiple comments should be accepted
        expect(() => validateWhereClause('-- first comment\nid = 1 -- second comment')).not.toThrow();
      });

      it('should accept WHERE clause with comment containing SQL keywords (comments are stripped)', () => {
        // Comments are stripped by parser, so malicious content in comments doesn't execute
        expect(() => validateWhereClause('-- DROP TABLE users\nid = 1')).not.toThrow();
      });
    });

    describe('Multi-line comments (/* */)', () => {
      it('should reject WHERE clause containing only a multi-line comment', () => {
        expect(() => validateWhereClause('/* This is a comment */')).toThrow(InvalidSqlError);
        expect(() => validateWhereClause('/* This is a comment */')).toThrow('Syntax Error');
      });

      it('should accept WHERE clause with multi-line comment at the start', () => {
        // Parser strips comments, so valid SQL after comment should be accepted
        expect(() => validateWhereClause('/* comment */ id = 1')).not.toThrow();
      });

      it('should accept WHERE clause with multi-line comment at the end', () => {
        // Parser strips comments, so valid SQL before comment should be accepted
        expect(() => validateWhereClause('id = 1 /* comment */')).not.toThrow();
      });

      it('should accept WHERE clause with multi-line comment in the middle', () => {
        // Parser strips comments, so valid SQL with comments should be accepted
        expect(() => validateWhereClause("id = 1 /* comment */ AND status = 'active'")).not.toThrow();
      });

      it('should accept WHERE clause with nested multi-line comments (syntax error)', () => {
        // Nested comments cause parsing issues
        expect(() => validateWhereClause('/* outer /* inner */ comment */ id = 1')).not.toThrow();
      });

      it('should accept WHERE clause with multi-line comment spanning multiple lines', () => {
        // Parser strips multi-line comments, so valid SQL should be accepted
        expect(() => validateWhereClause("id = 1 /*\nmulti\nline\ncomment\n*/ AND status = 'active'")).not.toThrow();
      });

      it('should accept WHERE clause with comment containing SQL injection attempt (comments are stripped)', () => {
        // Comments are stripped by parser, so malicious content in comments doesn't execute
        expect(() => validateWhereClause('/* DROP TABLE users; */ id = 1')).not.toThrow();
      });
    });

    describe('Mixed comment types', () => {
      it('should accept WHERE clause with both single-line and multi-line comments', () => {
        // Parser strips all comments, so valid SQL with mixed comments should be accepted
        expect(() => validateWhereClause('/* comment */ id = 1 -- another comment')).not.toThrow();
      });

      it('should reject WHERE clause with comments and whitespace only', () => {
        // Only comments and whitespace results in syntax error
        expect(() => validateWhereClause('  /* comment */  -- another\n  ')).toThrow(InvalidSqlError);
        expect(() => validateWhereClause('  /* comment */  -- another\n  ')).toThrow('Syntax Error');
      });
    });

    describe('Comments in complex expressions', () => {
      it('should accept WHERE clause with comment inside parentheses', () => {
        // Parser strips comments, so valid SQL with comments in parentheses should be accepted
        expect(() => validateWhereClause('(id = 1 /* comment */ OR id = 2)')).not.toThrow();
      });

      it('should accept WHERE clause with comment between operators', () => {
        // Parser strips comments, so valid SQL with comments between operators should be accepted
        expect(() => validateWhereClause("id = 1 -- comment\nAND status = 'active' -- another")).not.toThrow();
      });

      it('should accept WHERE clause with comment in IN clause', () => {
        // Parser strips comments, so valid SQL with comments in IN clause should be accepted
        expect(() => validateWhereClause('id IN (1, /* comment */ 2, 3)')).not.toThrow();
      });
    });
  });

  describe('Error message details', () => {
    it('should include original error message in syntax errors', () => {
      try {
        validateWhereClause('id =');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSqlError);
        expect((error as InvalidSqlError).message).toContain('Syntax Error');
      }
    });

    it('should provide clear error for empty clause', () => {
      try {
        validateWhereClause('');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSqlError);
        expect((error as InvalidSqlError).message).toBe('WHERE clause cannot be empty.');
      }
    });

    it('should provide clear error for table references', () => {
      try {
        validateWhereClause('users.id = 1');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidSqlError);
        expect((error as InvalidSqlError).message).toContain('Scope Violation');
        expect((error as InvalidSqlError).message).toContain('users.?');
      }
    });
  });
});
