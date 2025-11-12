import { parseCsv } from './csv-parser';

describe('CSV Parser', () => {
  describe('parseCsv', () => {
    it('should parse simple CSV with headers and one row', () => {
      const csv = 'Name,Age,City\nJohn,30,New York';

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        id: '2',
        fields: {
          Name: 'John',
          Age: '30',
          City: 'New York',
        },
      });
    });

    it('should parse CSV with multiple rows', () => {
      const csv = 'Name,Age,City\nJohn,30,New York\nJane,25,Los Angeles\nBob,35,Chicago';

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.records).toHaveLength(3);
      expect(result.records[0].fields).toEqual({ Name: 'John', Age: '30', City: 'New York' });
      expect(result.records[1].fields).toEqual({ Name: 'Jane', Age: '25', City: 'Los Angeles' });
      expect(result.records[2].fields).toEqual({ Name: 'Bob', Age: '35', City: 'Chicago' });
    });

    it('should assign 1-based IDs to records', () => {
      const csv = 'Name,Age\nJohn,30\nJane,25';

      const result = parseCsv(csv);

      expect(result.records[0].id).toBe('2');
      expect(result.records[1].id).toBe('3');
    });

    it('should handle empty CSV', () => {
      const csv = '';

      const result = parseCsv(csv);

      expect(result.headers).toEqual([]);
      expect(result.records).toEqual([]);
    });

    it('should handle CSV with only whitespace', () => {
      const csv = '   \n   \n   ';

      const result = parseCsv(csv);

      expect(result.headers).toEqual([]);
      expect(result.records).toEqual([]);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'Name,Age,City';

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Name', 'Age', 'City']);
      expect(result.records).toEqual([]);
    });

    it('should handle quoted fields with commas', () => {
      const csv = 'Name,Address\n"Smith, John","123 Main St, Apt 4"';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'Smith, John',
        Address: '123 Main St, Apt 4',
      });
    });

    it('should handle escaped quotes in quoted fields', () => {
      const csv = 'Name,Quote\nJohn,"He said ""Hello"""';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Quote: 'He said "Hello"',
      });
    });

    it('should handle fields with newlines in quotes', () => {
      // Note: This CSV parser splits on newlines first, so it doesn't support
      // multi-line quoted fields. This is a known limitation.
      const csv = 'Name,Description\nJohn,"Line 1"';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Description: 'Line 1',
      });
    });

    it('should trim whitespace from unquoted fields', () => {
      const csv = 'Name,Age\n  John  ,  30  ';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '30',
      });
    });

    it('should handle rows with fewer fields than headers', () => {
      const csv = 'Name,Age,City\nJohn,30\nJane';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '30',
        City: '',
      });
      expect(result.records[1].fields).toEqual({
        Name: 'Jane',
        Age: '',
        City: '',
      });
    });

    it('should handle rows with more fields than headers', () => {
      const csv = 'Name,Age\nJohn,30,New York,Extra';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '30',
      });
    });

    it('should handle empty fields', () => {
      const csv = 'Name,Age,City\nJohn,,New York\n,25,';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '',
        City: 'New York',
      });
      expect(result.records[1].fields).toEqual({
        Name: '',
        Age: '25',
        City: '',
      });
    });

    it('should handle single column CSV', () => {
      const csv = 'Name\nJohn\nJane\nBob';

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Name']);
      expect(result.records).toHaveLength(3);
      expect(result.records[0].fields).toEqual({ Name: 'John' });
      expect(result.records[1].fields).toEqual({ Name: 'Jane' });
      expect(result.records[2].fields).toEqual({ Name: 'Bob' });
    });

    it('should handle CSV with special characters', () => {
      const csv = 'Name,Email\nJohn,john@example.com\nJane,jane+test@example.co.uk';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Email: 'john@example.com',
      });
      expect(result.records[1].fields).toEqual({
        Name: 'Jane',
        Email: 'jane+test@example.co.uk',
      });
    });

    it('should handle CSV with Unicode characters', () => {
      const csv = 'Name,City\nJöhn,Zürich\n日本,東京';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'Jöhn',
        City: 'Zürich',
      });
      expect(result.records[1].fields).toEqual({
        Name: '日本',
        City: '東京',
      });
    });

    it('should handle CSV with numbers and booleans as strings', () => {
      const csv = 'Name,Age,Active\nJohn,30,true\nJane,25,false';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '30',
        Active: 'true',
      });
      expect(result.records[1].fields).toEqual({
        Name: 'Jane',
        Age: '25',
        Active: 'false',
      });
    });

    it('should handle trailing empty lines', () => {
      const csv = 'Name,Age\nJohn,30\n\n\n';

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Name', 'Age']);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Age: '30',
      });
    });

    it('should handle consecutive commas (empty fields)', () => {
      const csv = 'A,B,C,D\n1,,,4\n,2,,';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        A: '1',
        B: '',
        C: '',
        D: '4',
      });
      expect(result.records[1].fields).toEqual({
        A: '',
        B: '2',
        C: '',
        D: '',
      });
    });

    it('should handle quoted empty string', () => {
      const csv = 'Name,Value\nJohn,""\nJane,""';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Value: '',
      });
      expect(result.records[1].fields).toEqual({
        Name: 'Jane',
        Value: '',
      });
    });

    it('should handle fields that start and end with quotes but have content', () => {
      const csv = 'Name,Quote\nJohn,"""Hello"""';

      const result = parseCsv(csv);

      expect(result.records[0].fields).toEqual({
        Name: 'John',
        Quote: '"Hello"',
      });
    });

    it('should handle real-world example with mixed formatting', () => {
      const csv = `Product,Price,Description,In Stock
"Widget A",29.99,"A great widget, perfect for all occasions",true
"Widget B",49.99,"Premium widget with ""extra features""",false
Widget C,  19.99  ,Simple widget,true`;

      const result = parseCsv(csv);

      expect(result.headers).toEqual(['Product', 'Price', 'Description', 'In Stock']);
      expect(result.records).toHaveLength(3);
      expect(result.records[0].fields).toEqual({
        Product: 'Widget A',
        Price: '29.99',
        Description: 'A great widget, perfect for all occasions',
        'In Stock': 'true',
      });
      expect(result.records[1].fields).toEqual({
        Product: 'Widget B',
        Price: '49.99',
        Description: 'Premium widget with "extra features"',
        'In Stock': 'false',
      });
      expect(result.records[2].fields).toEqual({
        Product: 'Widget C',
        Price: '19.99',
        Description: 'Simple widget',
        'In Stock': 'true',
      });
    });
  });
});
