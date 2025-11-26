# Wrappers Module

## Overview

The wrappers module provides utility wrapper functions for external libraries used throughout the server application.

## Purpose

This module abstracts away direct dependencies on third-party libraries, making it easier to maintain, test, and potentially replace external dependencies without affecting dependent code.

## Current Wrappers

### html-minify

Wraps the `html-minifier-terser` library for HTML content minification.

#### minifyHtml() Function

Async utility that minifies HTML strings while preserving semantic meaning.

**Features:**

- Aggressive whitespace collapsing
- Boolean attribute shorthand
- Normalized attribute spacing
- Configurable options
- Comprehensive documentation

**Minification Strategies:**

1. Collapse non-semantic whitespace between tags
2. Convert redundant boolean attributes to shorthand
   - Example: `disabled="disabled"` → `disabled`
3. Normalize attribute spacing

**Configuration:**

- Currently uses minimal settings
- Documented options for future expansion
- Balance of size reduction and readability

## Integration

### Webflow Connector

Primary consumer of HTML minification:

**Use Case:**

- Minify HTML content when syncing rich-text fields
- Reduce payload size for Webflow API
- Ensure consistent formatting
- Convert markdown to HTML then minify

**When Applied:**

- Creating records with HTML content
- Updating records with rich-text fields
- Converting markdown to HTML
- API payload optimization

## Benefits

### Abstraction

- Hides library-specific details
- Single place to manage dependencies
- Easy to swap implementations

### Maintainability

- Centralized library usage
- Version upgrades in one place
- Consistent configuration

### Testability

- Easy to mock wrappers
- Test dependent code without library
- Isolated unit tests

## Extensibility

### Adding New Wrappers

The module is designed as an extensible architecture:

1. Add new wrapper file
2. Import external library
3. Create wrapper function
4. Export from wrappers module
5. Use throughout application

### Future Wrappers

Could include:

- PDF generation
- Image processing
- Text transformation
- Data validation
- Format conversion
- External API clients

## Design Pattern

### Wrapper Functions

- Simple function interfaces
- Hide complexity
- Document configuration
- Handle errors gracefully

### Configuration Management

- Centralized settings
- Environment-specific options
- Documented defaults
- Easy to modify

## Current Dependencies

- `html-minifier-terser`: HTML minification

## Usage Example

```typescript
import { minifyHtml } from './wrappers/html-minify';

const html = '<div>  <p>Hello World</p>  </div>';
const minified = await minifyHtml(html);
// Result: '<div><p>Hello World</p></div>'
```

## Configuration Documentation

The module includes comprehensive inline documentation:

- Available options
- Default values
- Trade-offs
- Performance considerations
- Use case recommendations

## Error Handling

Wrappers handle library-specific errors:

- Invalid input
- Configuration errors
- Library failures
- Graceful degradation

## Performance

### HTML Minification

- Async processing
- Memory efficient
- Fast processing
- Minimal overhead

## Future Enhancements

Potential additions:

- Image optimization wrappers
- PDF generation utilities
- Email template processing
- Markdown conversion
- Syntax highlighting
- Code formatting

## Best Practices

### When to Create Wrappers

- External library usage in multiple places
- Library interface is complex
- Likely to change implementation
- Need consistent configuration
- Want to simplify testing

### Wrapper Design

- Keep interfaces simple
- Document thoroughly
- Handle errors appropriately
- Make configuration explicit
- Consider performance

## Integration Points

Current integrations:

- **Webflow Connector**: HTML minification

Future integrations could include:

- Other connectors
- Export services
- Content processing
- Data transformation

## Maintenance

### Dependency Updates

- Update library versions centrally
- Test wrapper behavior
- Document breaking changes
- Update configuration as needed

### Adding Features

- Extend wrapper interfaces
- Maintain backward compatibility
- Document new options
- Test thoroughly
