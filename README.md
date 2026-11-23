[![CI](https://github.com/cnaallotey/auto-form-filler/actions/workflows/ci.yml/badge.svg)](https://github.com/cnaallotey/auto-form-filler/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@cnaallotey/auto-form-filler.svg)](https://www.npmjs.com/package/@cnaallotey/auto-form-filler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Auto Form Filler

**[Website and live demo](https://cnaallotey.github.io/auto-form-filler/)** | **[Documentation](https://cnaallotey.github.io/auto-form-filler/docs/)**

A lightweight, zero-dependency JavaScript library that automatically fills and submits forms based on URL query parameters. Perfect for marketing campaigns, lead generation, and form automation.

## ✨ Features

- 🎯 **Smart Form Filling**: Automatically fills form fields based on URL query parameters
- 🔄 **Multiple Input Types**: Supports text, email, checkbox, radio, select, and more
- 🛠️ **Customizable**: Flexible field mappings and configuration options
- 🏷️ **Match by Name**: Optionally fill any field whose `name` or `id` matches a parameter, with no mappings
- 🧭 **Campaign Tracking**: Remember UTM and other parameters across pages until the visitor reaches the form
- 🧹 **Clean URLs**: Optionally remove filled values from the address bar
- 🔗 **Link Builder**: `buildPrefillUrl()` makes correctly encoded links
- ⚡ **Auto-Submit**: Optional automatic form submission with configurable delay
- ⏳ **Late-Rendered Forms**: Optionally watches the DOM for forms rendered by frameworks after page load
- ⚛️ **Framework-Friendly**: Values are set so React and similar libraries pick up the change
- 🔄 **Custom Submission**: Support for both native form submission and custom submit functions
- 🔍 **Debug Mode**: Built-in debugging tools for development
- 📦 **Zero Dependencies**: Lightweight and fast
- 🎨 **TypeScript Support**: Full TypeScript definitions included
- 🎮 **Event Hooks**: Custom callbacks for form submission and error handling

## 📦 Installation

```bash
# Using npm
npm install @cnaallotey/auto-form-filler

# Using yarn
yarn add @cnaallotey/auto-form-filler

# Using pnpm
pnpm add @cnaallotey/auto-form-filler
```

Or load the UMD build from a CDN, which exposes a global `AutoFormFiller`:

```html
<script src="https://unpkg.com/@cnaallotey/auto-form-filler/dist/index.umd.js"></script>
<script>
  AutoFormFiller.autoFillForm({ formSelector: '#signup-form' });
</script>
```

## 🚀 Quick Start

```javascript
import { autoFillForm } from '@cnaallotey/auto-form-filler';

// Initialize with default settings
autoFillForm();
```

## ⚙️ Configuration

### Basic Configuration

```javascript
import { autoFillForm } from '@cnaallotey/auto-form-filler';

autoFillForm({
  formSelector: '#signup-form',
  autoSubmit: true
});
```

### Forms Rendered After Page Load

For single-page apps where the form appears after the page loads, turn on `observeDOM`. The library watches the DOM and retries until the form is filled, `maxDOMObserveRetries` attempts have been made, or `domObserverTimeout` milliseconds have passed.

```javascript
const filler = autoFillForm({
  formSelector: '#signup-form',
  observeDOM: true,
  domObserverTimeout: 10000,  // default
  maxDOMObserveRetries: 10    // default
});

// When the page or component that owns the form goes away:
filler.destroy();
```

### Advanced Configuration

```javascript
import { autoFillForm } from '@cnaallotey/auto-form-filler';

autoFillForm({
  formSelector: '#signup-form',
  fieldMappings: {
    custom_field: '#custom-input',
    another_field: 'input[name="another"]'
  },
  autoSubmit: true,
  submitDelay: 2000,
  debug: true,
  // Custom submit function (optional)
  customSubmitFunction: async (form, data) => {
    // Example: Custom AJAX submission
    const response = await fetch(form.action, {
      method: form.method,
      body: new FormData(form)
    });
    // Handle response
    if (!response.ok) {
      throw new Error('Form submission failed');
    }
  },
  onBeforeSubmit: (form, data) => {
    // Custom validation or processing before submit
    return true; // Return false to prevent submission
  },
  onAfterSubmit: (form, data) => {
    // Custom handling after submit
    console.log('Form submitted with data:', data);
  },
  onError: (error) => {
    // Custom error handling
    console.error('An error occurred:', error);
  }
});
```

## 🔗 URL Query Parameters

The library automatically maps URL query parameters to form fields inside the target form (including fields attached to it with the `form` attribute). For example:

```
https://example.com/signup?email=user@example.com&name=John%20Doe&company=Acme
```

This will automatically fill:
- Email field with "user@example.com"
- Name field with "John Doe"
- Company field with "Acme"

How values are applied:

| Field type | Behaviour |
|------------|-----------|
| Text, email, textarea, etc. | Value is set as-is |
| Checkbox | `true`, `1`, `yes`, `on` check it; `false`, `0`, `no`, `off` uncheck it; its own `value` checks it; anything else is skipped |
| Checkboxes sharing a name | Repeat the parameter (`?topics=code&topics=data`); matching boxes are checked, the rest unchecked |
| Radio | The radio in the same group whose `value` matches is checked; skipped if none match |
| Select | The option whose `value` matches, or whose text matches case-insensitively, is selected; skipped if none match |
| Multi-select | Repeat the parameter; every matching option is selected |
| Password, file, button | Never filled |

Skipped fields don't count as filled, so they never trigger auto-submit on their own. When a parameter repeats, checkbox groups and multi-selects use every value and other fields use the last one.

### Matching, filtering and cleaning up

```javascript
autoFillForm({
  matchByName: true,              // ?plan=team fills <input name="plan"> without a mapping
  allow: ['email', 'plan', 'utm_*'], // only these parameters can fill fields (* matches anything)
  prefix: 'ff_',                  // only read ?ff_email=..., ?ff_plan=...
  transform: {
    email: (value) => value.trim().toLowerCase(),
  },
  overwrite: false,               // leave fields that already have a value alone
  cleanUrl: true,                 // remove filled parameters from the address bar
});
```

### Keeping campaign values across pages

Run the library on every page with `persist`. Matching parameters are saved on any page and filled on the page that has the form. The URL wins over a saved value.

```javascript
const filler = autoFillForm({
  formSelector: '#signup-form',
  persist: ['utm_*', 'ref'],
  persistStorage: 'session', // or 'local' to keep them across visits
});

// After a successful signup
filler.clearPersisted();
```

### Building links

```javascript
import { buildPrefillUrl } from '@cnaallotey/auto-form-filler';

buildPrefillUrl('https://example.com/signup', {
  email: 'ada@example.com',
  topics: ['code', 'data'],
});
// https://example.com/signup?email=ada%40example.com&topics=code&topics=data
```

## 📤 Submission

With `autoSubmit: true`, the form is submitted `submitDelay` ms after at least one field is filled:

1. `onBeforeSubmit(form, data)` runs; returning `false` cancels the submission.
2. If `customSubmitFunction` is set, it is called instead of a native submit. If it returns a promise, `onAfterSubmit` runs when it resolves and `onError` runs if it rejects.
3. Otherwise the form is submitted with `form.requestSubmit()`, like a user clicking the submit button: browser validation runs and `submit` event handlers fire. If validation blocks the submission, `onError` is called instead of `onAfterSubmit`. Browsers without `requestSubmit` fall back to `form.submit()`.

## 🔒 Security Considerations

Anyone can create a link with query parameters for your page. With `autoSubmit` enabled, opening such a link submits your form from the visitor's browser, with their cookies and session, using values chosen by whoever made the link.

- Only enable `autoSubmit` on forms where that is harmless, such as newsletter or lead-capture forms.
- Never map query parameters to fields that change account state, such as payment details or email changes on authenticated pages. Password and file inputs are never filled. With `matchByName`, use `allow` to list exactly which parameters may fill fields.
- Use `cleanUrl: true` so personal data like an email doesn't stay in the address bar, browser history or copied links.
- Keep validating everything on the server; pre-filled values are untrusted user input.

## 🎯 Default Field Mappings

The library includes smart default mappings for common fields:

| Parameter | Selectors |
|-----------|-----------|
| `email` | `input[name="email"], input[type="email"], #email` |
| `name` | `input[name="name"], input[name="fullname"], #name, #fullname` |
| `firstname` | `input[name="firstname"], input[name="first_name"], #firstname` |
| `lastname` | `input[name="lastname"], input[name="last_name"], #lastname` |
| `phone` | `input[name="phone"], input[type="tel"], #phone` |
| `company` | `input[name="company"], input[name="organization"], #company` |
| `utm_source` | `input[name="utm_source"], #utm_source` |
| `utm_medium` | `input[name="utm_medium"], #utm_medium` |
| `utm_campaign` | `input[name="utm_campaign"], #utm_campaign` |

## 📚 API Reference

### `autoFillForm(config?: FormFillerConfig): AutoFormFiller`

Creates an `AutoFormFiller` and fills the form once the DOM is ready. Same as `AutoFormFiller.init(config)`.

### `new AutoFormFiller(config?: FormFillerConfig)`

Creates an instance without filling anything. Call `fillForm()` yourself.

### `filler.fillForm(formSelector?: string): boolean`

Fills the form matching `formSelector` (or `config.formSelector`). Returns `true` if at least one field was filled.

### `filler.destroy(): void`

Stops the DOM observer and cancels any pending fill or auto-submit. A destroyed instance does nothing.

### `filler.clearPersisted(): void`

Forgets the values saved with `persist`.

### `buildPrefillUrl(url: string, data: PrefillData, options?: { prefix?: string }): string`

Adds values to a URL's query string, encoded so the library reads them back exactly. Arrays become repeated parameters and `null`/`undefined` remove a parameter. Keeps the existing query string and hash, and works with relative URLs.

### Configuration Options

```typescript
interface FormFillerConfig {
  /** CSS selector for the form element (default: 'form') */
  formSelector?: string;
  
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
  
  /** Whether to automatically submit the form after filling (default: false) */
  autoSubmit?: boolean;
  
  /** Delay in milliseconds before auto-submitting (default: 1000) */
  submitDelay?: number;

  /** Watch the DOM and retry if the form or its fields aren't rendered yet (default: false) */
  observeDOM?: boolean;

  /** Stop watching the DOM after this many milliseconds (default: 10000) */
  domObserverTimeout?: number;

  /** Stop watching the DOM after this many fill attempts (default: 10) */
  maxDOMObserveRetries?: number;
  
  /** Custom submit function to handle form submission */
  customSubmitFunction?: (form: HTMLFormElement, data: Record<string, string>) => Promise<void> | void;
  
  /** Callback before form submission */
  onBeforeSubmit?: (form: HTMLFormElement, data: Record<string, string>) => boolean;
  
  /** Callback after form submission */
  onAfterSubmit?: (form: HTMLFormElement, data: Record<string, string>) => void;
  
  /** Error handling callback */
  onError?: (error: Error) => void;
  
  /** Enable debug mode */
  debug?: boolean;

  /** Fill fields whose name or id matches an unmapped parameter (default: false) */
  matchByName?: boolean;

  /** Only these parameters may fill fields; `*` matches anything (default: all) */
  allow?: string[];

  /** Only read parameters with this prefix, e.g. 'ff_' (default: '') */
  prefix?: string;

  /** Change values before they're filled, keyed by parameter name */
  transform?: Record<string, (value: string) => string>;

  /** Fill fields that already have a value (default: true) */
  overwrite?: boolean;

  /** Remove filled parameters from the address bar (default: false) */
  cleanUrl?: boolean;

  /** Parameters to remember across pages, e.g. ['utm_*'] (default: []) */
  persist?: string[];

  /** Where remembered parameters are kept (default: 'session') */
  persistStorage?: 'session' | 'local';
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Check that the built package loads via require() and import()
npm run build && npm run test:package
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Inspired by the need for simpler form automation solutions 
