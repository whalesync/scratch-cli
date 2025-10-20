// File explanation!
// This is written by ai, don't believe the comments too much.
// I am migrating us from an old html-minifier library to a newer html-minify-terser library
// The expectations here are taken from the old library's output.

import { minifyHtml } from './html-minify';

describe('wrappers/html-minify', () => {
  // Basic whitespace tests
  it('removes extra spaces between tags', async () => {
    expect(await minifyHtml('<div>  <p>  hello  </p>  </div>')).toBe('<div><p>hello</p></div>');
  });

  it('preserves necessary spaces between text', async () => {
    expect(await minifyHtml('<p>hello  world</p>')).toBe('<p>hello world</p>');
  });

  it('removes multiple newlines', async () => {
    expect(await minifyHtml('<div>\n\n\n<p>hello</p>\n\n</div>')).toBe('<div><p>hello</p></div>');
  });

  // Boolean attribute tests
  it('collapses boolean attributes', async () => {
    expect(await minifyHtml('<input disabled="disabled">')).toBe('<input disabled>');
  });

  it('collapses multiple boolean attributes', async () => {
    expect(await minifyHtml('<input disabled="disabled" checked="checked" readonly="readonly">')).toBe(
      '<input disabled checked readonly>',
    );
  });

  it('handles custom boolean attributes', async () => {
    expect(await minifyHtml('<div hidden="hidden" data-visible="visible"></div>')).toBe(
      '<div hidden data-visible="visible"></div>',
    );
  });

  // Nested element handling
  it('handles deeply nested elements', async () => {
    expect(await minifyHtml('<div>  <p>  <span>  hello  </span>  </p>  </div>')).toBe(
      '<div><p><span>hello</span></p></div>',
    );
  });

  it('preserves nested spaces in text content', async () => {
    expect(await minifyHtml('<div><p>hello  <span>beautiful</span>  world</p></div>')).toBe(
      '<div><p>hello <span>beautiful</span> world</p></div>',
    );
  });

  // Attribute handling
  it('preserves attribute values with spaces', async () => {
    expect(await minifyHtml('<div class="foo  bar   baz"></div>')).toBe('<div class="foo bar baz"></div>');
  });

  it('handles empty attributes', async () => {
    expect(await minifyHtml('<div id=""  class=""  style=""></div>')).toBe('<div id="" class="" style=""></div>');
  });

  // Script and style handling
  it('preserves content in script tags', async () => {
    expect(await minifyHtml('<script>  function foo() {  return true;  }  </script>')).toBe(
      '<script>function foo() {  return true;  }</script>',
    );
  });

  it('preserves content in style tags', async () => {
    expect(await minifyHtml('<style>  .foo {  color: red;  }  </style>')).toBe('<style>.foo {  color: red;  }</style>');
  });

  // Special elements
  it('handles pre tags correctly', async () => {
    expect(await minifyHtml('<pre>  foo  bar  </pre>')).toBe('<pre>  foo  bar  </pre>');
  });

  it('handles textarea tags correctly', async () => {
    expect(await minifyHtml('<textarea>  foo  bar  </textarea>')).toBe('<textarea>  foo  bar  </textarea>');
  });

  // HTML5 elements
  it('handles HTML5 semantic elements', async () => {
    expect(await minifyHtml('<article>  <section>  <header>  hello  </header>  </section>  </article>')).toBe(
      '<article><section><header>hello</header></section></article>',
    );
  });

  it('handles self-closing HTML5 elements', async () => {
    expect(await minifyHtml('<img   src="test.jpg"   alt="test"  />')).toBe('<img src="test.jpg" alt="test">');
  });

  // Custom elements
  it('handles custom elements', async () => {
    expect(await minifyHtml('<custom-element>  <shadow-root>  hello  </shadow-root>  </custom-element>')).toBe(
      '<custom-element><shadow-root>hello</shadow-root></custom-element>',
    );
  });

  // Table structures
  it('handles table structures', async () => {
    expect(await minifyHtml('<table>  <tr>  <td>  foo  </td>  </tr>  </table>')).toBe(
      '<table><tr><td>foo</td></tr></table>',
    );
  });

  // List structures
  it('handles list structures', async () => {
    expect(await minifyHtml('<ul>  <li>  foo  </li>  <li>  bar  </li>  </ul>')).toBe(
      '<ul><li>foo</li><li>bar</li></ul>',
    );
  });

  // Form elements
  it('handles form elements', async () => {
    expect(await minifyHtml('<form>  <input   type="text"   value="foo"  />  </form>')).toBe(
      '<form><input type="text" value="foo"></form>',
    );
  });

  // Mixed content
  it('handles mixed content correctly', async () => {
    expect(await minifyHtml('text  <span>  foo  </span>  text')).toBe('text <span>foo </span>text');
  });

  // Special characters
  it('preserves special characters', async () => {
    expect(await minifyHtml('<p>  &nbsp;  &lt;  &gt;  &amp;  </p>')).toBe('<p>&nbsp; &lt; &gt; &amp;</p>');
  });

  // Comments
  it('handles HTML comments', async () => {
    expect(await minifyHtml('<!-- comment -->  <p>  hello  </p>  <!-- comment -->')).toBe(
      '<!-- comment --><p>hello</p><!-- comment -->',
    );
  });

  // Inline elements
  it('handles inline elements correctly', async () => {
    expect(await minifyHtml('<p>  <strong>  bold  </strong>  and  <em>  italic  </em>  </p>')).toBe(
      '<p><strong>bold </strong>and <em>italic</em></p>',
    );
  });

  // Whitespace in attributes
  it('normalizes whitespace in attributes', async () => {
    expect(await minifyHtml('<div  class = "foo"   id = "bar"   style = "color: red"  ></div>')).toBe(
      '<div class="foo" id="bar" style="color: red"></div>',
    );
  });

  // Multiple boolean attributes
  it('handles multiple boolean attributes with values', async () => {
    expect(
      await minifyHtml(
        '<input type="checkbox" checked="checked" disabled="disabled" readonly="readonly" required="required">',
      ),
    ).toBe('<input type="checkbox" checked disabled readonly required>');
  });

  // Empty elements
  it('handles empty elements', async () => {
    expect(await minifyHtml('<div>  </div>  <p>  </p>  <span>  </span>')).toBe('<div></div><p></p><span></span>');
  });

  // Meta tags
  it('handles meta tags', async () => {
    expect(await minifyHtml('<meta  name="description"   content="foo bar"  >')).toBe(
      '<meta name="description" content="foo bar">',
    );
  });

  // Link tags
  it('handles link tags', async () => {
    expect(await minifyHtml('<link  rel="stylesheet"   href="style.css"  >')).toBe(
      '<link rel="stylesheet" href="style.css">',
    );
  });

  // Data attributes
  it('handles data attributes', async () => {
    expect(await minifyHtml('<div  data-test="foo"   data-value="bar"  ></div>')).toBe(
      '<div data-test="foo" data-value="bar"></div>',
    );
  });

  // Multiple classes
  it('handles multiple classes', async () => {
    expect(await minifyHtml('<div  class="foo   bar   baz"  ></div>')).toBe('<div class="foo bar baz"></div>');
  });

  // Mixed case tags
  it('handles mixed case tags', async () => {
    expect(await minifyHtml('<DiV>  <SpAn>  hello  </SpAn>  </DiV>')).toBe('<div><span>hello</span></div>');
  });

  // Doctype
  it('handles doctype', async () => {
    expect(await minifyHtml('<!DOCTYPE html>  <html>  <body>  hello  </body>  </html>')).toBe(
      '<!DOCTYPE html><html><body>hello</body></html>',
    );
  });

  // SVG content
  it('handles SVG content', async () => {
    expect(await minifyHtml('<svg>  <circle  cx="50"   cy="50"   r="40"  />  </svg>')).toBe(
      '<svg><circle cx="50" cy="50" r="40"/></svg>',
    );
  });

  // Conditional comments
  it('preserves conditional comments', async () => {
    expect(await minifyHtml('<!--[if IE]>  <div>  IE  </div>  <![endif]-->')).toBe(
      '<!--[if IE]>  <div>  IE  </div>  <![endif]-->',
    );
  });

  // Multiple consecutive spaces in text
  it('collapses multiple consecutive spaces in text', async () => {
    expect(await minifyHtml('<p>foo     bar     baz</p>')).toBe('<p>foo bar baz</p>');
  });

  // Spaces around inline elements
  it('handles spaces around inline elements', async () => {
    expect(await minifyHtml('<p>text  <a href="#">  link  </a>  text</p>')).toBe(
      '<p>text <a href="#">link </a>text</p>',
    );
  });

  // Multiple head elements
  it('handles multiple head elements', async () => {
    expect(await minifyHtml('<head>  <title>  Test  </title>  <meta charset="utf-8">  </head>')).toBe(
      '<head><title>Test</title><meta charset="utf-8"></head>',
    );
  });

  // Complex nested structure
  it('handles complex nested structure', async () => {
    expect(
      await minifyHtml(`
        <div class="container">
          <header class="header">
            <nav>
              <ul>
                <li>  Item 1  </li>
                <li>  Item 2  </li>
              </ul>
            </nav>
          </header>
          <main>
            <article>
              <h1>  Title  </h1>
              <p>  Content  </p>
            </article>
          </main>
        </div>
      `),
    ).toBe(
      '<div class="container"><header class="header"><nav><ul><li>Item 1</li><li>Item 2</li></ul></nav></header><main><article><h1>Title</h1><p>Content</p></article></main></div>',
    );
  });

  // Aria attributes
  it('handles aria attributes', async () => {
    expect(await minifyHtml('<button  aria-label="Close"   aria-expanded="false"  >  Close  </button>')).toBe(
      '<button aria-label="Close" aria-expanded="false">Close</button>',
    );
  });

  // Role attributes
  it('handles role attributes', async () => {
    expect(await minifyHtml('<div  role="alert"   aria-live="assertive"  >  Message  </div>')).toBe(
      '<div role="alert" aria-live="assertive">Message</div>',
    );
  });

  // Input elements with multiple attributes
  it('handles input elements with multiple attributes', async () => {
    expect(
      await minifyHtml('<input  type="text"   value="test"   placeholder="Enter text"   required="required"  >'),
    ).toBe('<input type="text" value="test" placeholder="Enter text" required>');
  });

  // Form elements with event handlers
  it('handles form elements with event handlers', async () => {
    expect(
      await minifyHtml('<form  onsubmit="return false;"   action="/submit"  >  <input  type="submit"  >  </form>'),
    ).toBe('<form onsubmit="return false;" action="/submit"><input type="submit"></form>');
  });

  // CSS classes with special characters
  it('handles CSS classes with special characters', async () => {
    expect(await minifyHtml('<div  class="foo@bar   foo:bar   foo_bar"  ></div>')).toBe(
      '<div class="foo@bar foo:bar foo_bar"></div>',
    );
  });

  // Multi-line attributes
  it('handles multi-line attributes', async () => {
    expect(await minifyHtml('<div  data-content="\n  foo\n  bar\n  "  ></div>')).toBe(
      '<div data-content="\n  foo\n  bar\n  "></div>',
    );
  });

  // XML namespaces
  it('handles XML namespaces', async () => {
    expect(
      await minifyHtml('<xml:namespace  prefix="o"   ns="urn:schemas-microsoft-com:office:office"  ></xml:namespace>'),
    ).toBe('<xml:namespace prefix="o" ns="urn:schemas-microsoft-com:office:office"></xml:namespace>');
  });

  // Custom data attributes with values
  it('handles custom data attributes with values', async () => {
    expect(await minifyHtml('<div  data-config=\'{"foo": "bar"}\'   data-index="123"  ></div>')).toBe(
      '<div data-config=\'{"foo": "bar"}\' data-index="123"></div>',
    );
  });

  // Picture element with sources
  it('handles picture element with sources', async () => {
    expect(
      await minifyHtml(`
        <picture>
          <source  media="(min-width: 800px)"   srcset="large.jpg"  >
          <source  media="(min-width: 400px)"   srcset="medium.jpg"  >
          <img  src="small.jpg"   alt="Test"  >
        </picture>
      `),
    ).toBe(
      '<picture><source media="(min-width: 800px)" srcset="large.jpg"><source media="(min-width: 400px)" srcset="medium.jpg"><img src="small.jpg" alt="Test"></picture>',
    );
  });

  // Template tags
  it('handles template tags', async () => {
    expect(await minifyHtml('<template>  <div>  content  </div>  </template>')).toBe(
      '<template><div>content</div></template>',
    );
  });

  // Multiple adjacent inline elements
  it('handles multiple adjacent inline elements', async () => {
    expect(await minifyHtml('<p><strong>bold</strong>  <em>italic</em>  <span>span</span></p>')).toBe(
      '<p><strong>bold</strong> <em>italic</em> <span>span</span></p>',
    );
  });

  // Elements with lang attribute
  it('handles elements with lang attribute', async () => {
    expect(await minifyHtml('<div  lang="en-US"  >  Hello  <span  lang="es"  >  Hola  </span>  </div>')).toBe(
      '<div lang="en-US">Hello <span lang="es">Hola</span></div>',
    );
  });

  // Complex conditional structures
  it('handles nested conditional comments correctly', async () => {
    await expect(
      minifyHtml(`
        <!--[if IE 9]>
          <div>IE9 Content</div>
          <!--[if gte IE 9]>
            <div>  Nested   IE  Content  </div>
          <![endif]-->
        <![endif]-->
      `),
    ).rejects.toThrow('Parse Error: <![endif]-->');
  });

  // Custom elements with shadow DOM
  it('handles custom elements with shadow DOM syntax', async () => {
    expect(
      await minifyHtml(`
        <my-element>
          #shadow-root
            <style>
              .foo   {  color:   red;  }
            </style>
            <div   class="foo">  Shadow  content  </div>
          /shadow-root
        </my-element>
      `),
    ).toBe(
      '<my-element>#shadow-root<style>.foo   {  color:   red;  }</style><div class="foo">Shadow content</div>/shadow-root</my-element>',
    );
  });

  // Complex form structures
  it('handles nested form elements with varied attributes', async () => {
    expect(
      await minifyHtml(`
        <form   method="post"   action="/submit"   enctype="multipart/form-data">
          <fieldset    disabled="disabled">
            <legend>  Personal   Info  </legend>
            <input   type="text"   required="required"   pattern="[A-Za-z]{3,}"   title="Three letter minimum">
            <textarea   rows="4"   cols="50"   maxlength="200"   placeholder="Enter  description"></textarea>
          </fieldset>
        </form>
      `),
    ).toBe(
      '<form method="post" action="/submit" enctype="multipart/form-data"><fieldset disabled><legend>Personal Info</legend><input type="text" required pattern="[A-Za-z]{3,}" title="Three letter minimum"> <textarea rows="4" cols="50" maxlength="200" placeholder="Enter  description"></textarea></fieldset></form>',
    );
  });

  // SVG with complex attributes
  it('handles SVG with complex attributes and namespaces', async () => {
    expect(
      await minifyHtml(`
        <svg   xmlns="http://www.w3.org/2000/svg"   xmlns:xlink="http://www.w3.org/1999/xlink"   viewBox="0 0 100 100">
          <defs>
            <linearGradient    id="grad1"    x1="0%"    y1="0%"    x2="100%"    y2="0%">
              <stop   offset="0%"   style="stop-color:rgb(255,255,0);stop-opacity:1" />
              <stop   offset="100%"   style="stop-color:rgb(255,0,0);stop-opacity:1" />
            </linearGradient>
          </defs>
          <circle   cx="50"   cy="50"   r="40"   stroke="black"   stroke-width="3"   fill="url(#grad1)" />
        </svg>
      `),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1"/><stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1"/></linearGradient></defs><circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="url(#grad1)"/></svg>',
    );
  });

  // Complex table structure with colgroups and multiple sections
  it('handles complex table structures', async () => {
    expect(
      await minifyHtml(`
        <table   cellspacing="0"   cellpadding="0"   border="1">
          <colgroup>
            <col   span="2"   style="background-color:   #ff0000">
            <col   style="background-color:   #00ff00">
          </colgroup>
          <thead>
            <tr>
              <th   colspan="2"   rowspan="2">  Header  1  </th>
              <th>  Header   2  </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>  Data   1  </td>
              <td>  Data   2  </td>
              <td>  Data   3  </td>
            </tr>
          </tbody>
        </table>
      `),
    ).toBe(
      '<table cellspacing="0" cellpadding="0" border="1"><colgroup><col span="2" style="background-color:   #ff0000"><col style="background-color:   #00ff00"></colgroup><thead><tr><th colspan="2" rowspan="2">Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Data 1</td><td>Data 2</td><td>Data 3</td></tr></tbody></table>',
    );
  });

  // MathML content
  it('handles MathML content', async () => {
    expect(
      await minifyHtml(`
        <math   xmlns="http://www.w3.org/1998/Math/MathML">
          <mrow>
            <msup>
              <mi>  x  </mi>
              <mn>  2  </mn>
            </msup>
            <mo>  +  </mo>
            <mn>  4  </mn>
            <mo>  =  </mo>
            <mn>  0  </mn>
          </mrow>
        </math>
      `),
    ).toBe(
      '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>4</mn><mo>=</mo><mn>0</mn></mrow></math>',
    );
  });

  // Complex iframe with srcdoc
  it('handles iframe with complex srcdoc content', async () => {
    expect(
      await minifyHtml(`
        <iframe   srcdoc="
          <html>
            <head>
              <style>
                body   {   margin:   0;   }
              </style>
            </head>
            <body>
              <div   class='content'>  Hello   World  </div>
            </body>
          </html>
        "></iframe>
      `),
    ).toBe(
      '<iframe srcdoc="\n          <html>\n            <head>\n              <style>\n                body   {   margin:   0;   }\n              </style>\n            </head>\n            <body>\n              <div   class=\'content\'>  Hello   World  </div>\n            </body>\n          </html>\n        "></iframe>',
    );
  });

  // Complex data attributes with JSON
  it('handles complex data attributes with JSON content', async () => {
    expect(
      await minifyHtml(`
        <div   data-config='{"theme":  "dark",  "settings":  {"fontSize":  14,  "fontFamily":  "Arial"}}'
              data-user='{"name":  "John",  "role":  "admin"}'
              data-permissions="[  &quot;read&quot;,  &quot;write&quot;,  &quot;delete&quot;  ]">
          <span>  Content  </span>
        </div>
      `),
    ).toBe(
      '<div data-config=\'{"theme":  "dark",  "settings":  {"fontSize":  14,  "fontFamily":  "Arial"}}\' data-user=\'{"name":  "John",  "role":  "admin"}\' data-permissions="[  &quot;read&quot;,  &quot;write&quot;,  &quot;delete&quot;  ]"><span>Content</span></div>',
    );
  });

  // Mixed content with special characters and entities
  it('handles mixed content with special characters and entities', async () => {
    expect(
      await minifyHtml(`
        <div   class="special-content">
          Text   with   &copy;   and   &reg;   symbols
          <span>  More   text   with   &trade;  </span>
          <pre>    Preserved     whitespace    &gt;    here    </pre>
          <code>  var   x   =   &lt;   10;  </code>
        </div>
      `),
    ).toBe(
      '<div class="special-content">Text with &copy; and &reg; symbols <span>More text with &trade;</span><pre>    Preserved     whitespace    &gt;    here    </pre><code>var x = &lt; 10;</code></div>',
    );
  });

  // Complex form validation attributes
  it('handles complex form validation attributes', async () => {
    expect(
      await minifyHtml(`
        <form   novalidate="novalidate">
          <input   type="text"
                  required="required"
                  pattern="[A-Za-z]{3,}"
                  title="Three letter minimum"
                  minlength="3"
                  maxlength="10"
                  data-validation-message="Please   enter   valid   text">
          <input   type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  data-validation-type="decimal">
        </form>
      `),
    ).toBe(
      '<form novalidate><input type="text" required pattern="[A-Za-z]{3,}" title="Three letter minimum" minlength="3" maxlength="10" data-validation-message="Please   enter   valid   text"> <input type="number" min="0" max="100" step="0.1" data-validation-type="decimal"></form>',
    );
  });

  // Complex WAI-ARIA attributes
  it('handles complex WAI-ARIA attributes', async () => {
    expect(
      await minifyHtml(`
        <div   role="tablist"   aria-label="Entertainment">
          <button   role="tab"
                  aria-selected="true"
                  aria-controls="panel-1"
                  id="tab-1"
                  tabindex="0">
            Movies
          </button>
          <div   role="tabpanel"
                aria-labelledby="tab-1"
                id="panel-1"
                tabindex="0">
            <p>  Movie   content   here  </p>
          </div>
        </div>
      `),
    ).toBe(
      '<div role="tablist" aria-label="Entertainment"><button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1" tabindex="0">Movies</button><div role="tabpanel" aria-labelledby="tab-1" id="panel-1" tabindex="0"><p>Movie content here</p></div></div>',
    );
  });

  // Picture element with multiple sources and media queries
  it('handles picture element with complex sources', async () => {
    expect(
      await minifyHtml(`
        <picture>
          <source   media="(min-width: 1200px)"
                  srcset="large.jpg   1200w,
                          larger.jpg   1800w"
                  sizes="(min-width: 1200px) 1200px,
                         100vw">
          <source   media="(min-width: 800px)"
                  srcset="medium.jpg"
                  type="image/jpeg">
          <img   src="small.jpg"
                alt="Complex   responsive   image"
                loading="lazy"
                decoding="async">
        </picture>
      `),
    ).toBe(
      '<picture><source media="(min-width: 1200px)" srcset="large.jpg 1200w, larger.jpg 1800w" sizes="(min-width: 1200px) 1200px,\n                         100vw"><source media="(min-width: 800px)" srcset="medium.jpg" type="image/jpeg"><img src="small.jpg" alt="Complex   responsive   image" loading="lazy" decoding="async"></picture>',
    );
  });

  // Complex meta tags
  it('handles complex meta tags', async () => {
    expect(
      await minifyHtml(`
        <head>
          <meta   charset="utf-8">
          <meta   http-equiv="X-UA-Compatible"   content="IE=edge">
          <meta   name="viewport"   content="width=device-width,   initial-scale=1.0,   maximum-scale=1.0">
          <meta   name="description"   content="Page   description   here">
          <meta   property="og:title"   content="Open   Graph   Title">
          <meta   property="og:description"   content="Open   Graph   Description">
        </head>
      `),
    ).toBe(
      '<head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="description" content="Page   description   here"><meta property="og:title" content="Open   Graph   Title"><meta property="og:description" content="Open   Graph   Description"></head>',
    );
  });

  // Complex CSS custom properties
  it('handles CSS custom properties in style attributes', async () => {
    expect(
      await minifyHtml(`
        <div   style="--custom-color:   #ff0000;   --custom-spacing:   20px;">
          <span   style="color:   var(--custom-color);   margin:   var(--custom-spacing);">
            Text   with   custom   properties
          </span>
        </div>
      `),
    ).toBe(
      '<div style="--custom-color:   #ff0000;   --custom-spacing:   20px;"><span style="color:   var(--custom-color);   margin:   var(--custom-spacing);">Text with custom properties</span></div>',
    );
  });
});
