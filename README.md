# Auto Form Filler

A lightweight JavaScript library that automatically fills and submits forms based on URL query parameters.

## Features

- Automatically fills form fields based on URL query parameters
- Supports various input types (text, email, checkbox, radio, select)
- Customizable field mappings
- Optional auto-submit functionality
- Event callbacks for form submission
- Debug mode for development
- TypeScript support
- No dependencies

## Installation

```bash
npm install auto-form-filler
```

## Usage

### Basic Usage

```javascript
import { autoFillForm } from 'auto-form-filler';

// Initialize with default settings
autoFillForm();
```

### Advanced Configuration

```javascript
import { autoFillForm } from 'auto-form-filler';

autoFillForm({
  formSelector: '#signup-form', // Custom form selector
  fieldMappings: {
    // Custom field mappings
    custom_field: '#custom-input',
    another_field: 'input[name="another"]'
  },
  autoSubmit: true, // Automatically submit the form after filling
  submitDelay: 2000, // Wait 2 seconds before submitting
  debug: true, // Enable debug logging
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

### URL Query Parameters

The library will automatically map URL query parameters to form fields. For example:

```
https://example.com/signup?email=user@example.com&name=John%20Doe&company=Acme
```

This will fill:
- Email field with "user@example.com"
- Name field with "John Doe"
- Company field with "Acme"

### Default Field Mappings

The library includes default mappings for common fields:

- `email`: `input[name="email"], input[type="email"], #email`
- `name`: `input[name="name"], input[name="fullname"], #name, #fullname`
- `firstname`: `input[name="firstname"], input[name="first_name"], #firstname`
- `lastname`: `input[name="lastname"], input[name="last_name"], #lastname`
- `phone`: `input[name="phone"], input[type="tel"], #phone`
- `company`: `input[name="company"], input[name="organization"], #company`
- `utm_source`: `input[name="utm_source"], #utm_source`
- `utm_medium`: `input[name="utm_medium"], #utm_medium`
- `utm_campaign`: `input[name="utm_campaign"], #utm_campaign`

## API

### `autoFillForm(config?: FormFillerConfig): AutoFormFiller`

Initializes the form filler with optional configuration.

### `FormFillerConfig` Interface

```typescript
interface FormFillerConfig {
  formSelector?: string;
  fieldMappings?: Record<string, string>;
  autoSubmit?: boolean;
  submitDelay?: number;
  onBeforeSubmit?: (form: HTMLFormElement, data: Record<string, string>) => boolean;
  onAfterSubmit?: (form: HTMLFormElement, data: Record<string, string>) => void;
  onError?: (error: Error) => void;
  debug?: boolean;
}
```

## License

MIT 