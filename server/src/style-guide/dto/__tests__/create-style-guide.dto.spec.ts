/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CreateStyleGuideDto } from '@spinner/shared-types';
import { validate } from 'class-validator';

describe('CreateStyleGuideDto', () => {
  describe('valid DTOs', () => {
    it('should validate a complete valid DTO', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test Style Guide';
      dto.body = 'This is the content';
      dto.autoInclude = true;
      dto.sourceUrl = 'https://example.com';
      dto.contentType = 'markdown';
      dto.tags = ['tag1', 'tag2'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate a DTO with only required fields', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Minimal Style Guide';
      dto.body = 'Content';
      dto.autoInclude = false;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid contentType values', async () => {
      const contentTypes = ['markdown', 'json', 'text'];

      for (const contentType of contentTypes) {
        const dto = new CreateStyleGuideDto();
        dto.name = 'Test';
        dto.body = 'Content';
        dto.autoInclude = true;
        dto.contentType = contentType;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should validate with empty tags array', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.tags = [];

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid DTOs', () => {
    it('should fail validation when name is empty', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = '';
      dto.body = 'Content';
      dto.autoInclude = true;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when name is not a string', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 123 as any;
      dto.body = 'Content';
      dto.autoInclude = true;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when body is not a string', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 123 as any;
      dto.autoInclude = true;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('body');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when autoInclude is not a boolean', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = 'true' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('autoInclude');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation when sourceUrl is not a string', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.sourceUrl = 123 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sourceUrl');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when contentType is invalid', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.contentType = 'invalid' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('contentType');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation when contentType is not a string', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.contentType = 123 as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('contentType');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when tags is not an array', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.tags = 'not-an-array' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('tags');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should fail with multiple validation errors', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = '';
      dto.body = 123 as any;
      dto.autoInclude = 'yes' as any;
      dto.contentType = 'invalid' as any;

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(1);
      const properties = errors.map((e) => e.property);
      expect(properties).toContain('name');
      expect(properties).toContain('body');
      expect(properties).toContain('autoInclude');
      expect(properties).toContain('contentType');
    });
  });

  describe('optional fields', () => {
    it('should validate when optional fields are undefined', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      // sourceUrl, contentType, and tags are undefined

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow null for optional fields', async () => {
      const dto = new CreateStyleGuideDto();
      dto.name = 'Test';
      dto.body = 'Content';
      dto.autoInclude = true;
      dto.sourceUrl = null as any;
      dto.contentType = null as any;
      dto.tags = null as any;

      const errors = await validate(dto);
      // class-validator's @IsOptional() allows null values
      expect(errors).toHaveLength(0);
    });
  });
});
