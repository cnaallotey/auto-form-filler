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

The library automatically maps URL query parameters to form fields. For example:

```
https://example.com/signup?email=user@example.com&name=John%20Doe&company=Acme
```

This will automatically fill:
- Email field with "user@example.com"
- Name field with "John Doe"
- Company field with "Acme"

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

Initializes the form filler with optional configuration.

### Configuration Options

```typescript
interface FormFillerConfig {
  /** CSS selector for the form element */
  formSelector?: string;
  
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
  
  /** Whether to automatically submit the form after filling */
  autoSubmit?: boolean;
  
  /** Delay in milliseconds before auto-submitting */
  submitDelay?: number;
  
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
