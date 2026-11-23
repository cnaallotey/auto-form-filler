[![CI](https://github.com/cnaallotey/auto-form-filler/actions/workflows/ci.yml/badge.svg)](https://github.com/cnaallotey/auto-form-filler/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@cnaallotey/auto-form-filler.svg)](https://www.npmjs.com/package/@cnaallotey/auto-form-filler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# Auto Form Filler

A lightweight, zero-dependency JavaScript library that automatically fills and submits forms based on URL query parameters. Perfect for marketing campaigns, lead generation, and form automation.

## ✨ Features

- 🎯 **Smart Form Filling**: Automatically fills form fields based on URL query parameters
- 🔄 **Multiple Input Types**: Supports text, email, checkbox, radio, select, and more
- 🛠️ **Customizable**: Flexible field mappings and configuration options
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
| Checkbox | `true`, `1`, `yes`, `on` check it; `false`, `0`, `no`, `off` uncheck it; anything else is skipped |
| Radio | The radio in the same group whose `value` matches is checked; skipped if none match |
| Select | The option whose `value` matches, or whose text matches case-insensitively, is selected; skipped if none match |

Skipped fields don't count as filled, so they never trigger auto-submit on their own.

## 📤 Submission

With `autoSubmit: true`, the form is submitted `submitDelay` ms after at least one field is filled:

1. `onBeforeSubmit(form, data)` runs; returning `false` cancels the submission.
2. If `customSubmitFunction` is set, it is called instead of a native submit. If it returns a promise, `onAfterSubmit` runs when it resolves and `onError` runs if it rejects.
3. Otherwise the form is submitted with `form.requestSubmit()`, like a user clicking the submit button: browser validation runs and `submit` event handlers fire. If validation blocks the submission, `onError` is called instead of `onAfterSubmit`. Browsers without `requestSubmit` fall back to `form.submit()`.

## 🔒 Security Considerations

Anyone can create a link with query parameters for your page. With `autoSubmit` enabled, opening such a link submits your form from the visitor's browser, with their cookies and session, using values chosen by whoever made the link.

- Only enable `autoSubmit` on forms where that is harmless, such as newsletter or lead-capture forms.
- Never map query parameters to fields that change account state, such as passwords, payment details, or email changes on authenticated pages.
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
