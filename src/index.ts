export interface FormFillerConfig {
  formSelector?: string;
  fieldMappings?: Record<string, string>;
  autoSubmit?: boolean;
  submitDelay?: number;
  observeDOM?: boolean;
  domObserverTimeout?: number;
  maxDOMObserveRetries?: number;
  onBeforeSubmit?: (form: HTMLFormElement, data: Record<string, string>) => boolean;
  onAfterSubmit?: (form: HTMLFormElement, data: Record<string, string>) => void;
  onError?: (error: Error) => void;
  debug?: boolean;
  customSubmitFunction?: (form: HTMLFormElement, data: Record<string, string>) => Promise<void> | void;
}

type RequiredFormFillerConfig = Omit<Required<FormFillerConfig>, 'customSubmitFunction'> & {
  customSubmitFunction?: (form: HTMLFormElement, data: Record<string, string>) => Promise<void> | void;
};

export interface FieldMapping {
  [queryParam: string]: string; // query param -> form field selector
}

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const TRUTHY_VALUES = ['true', '1', 'yes', 'on'];
const FALSY_VALUES = ['false', '0', 'no', 'off'];
const OBSERVER_DEBOUNCE_MS = 500;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Sets `value` / `checked` through the element prototype's native setter.
 * Frameworks such as React wrap these properties on the instance to track
 * changes; assigning through the instance would make them ignore the
 * subsequent input/change events.
 */
function setNativeProperty(el: FormField, prop: 'value' | 'checked', value: string | boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), prop);
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    (el as unknown as Record<string, unknown>)[prop] = value;
  }
}

export class AutoFormFiller {
  private config: RequiredFormFillerConfig;
  private defaultFieldMappings: FieldMapping = {
    email: 'input[name="email"], input[type="email"], #email',
    name: 'input[name="name"], input[name="fullname"], #name, #fullname',
    firstname: 'input[name="firstname"], input[name="first_name"], #firstname',
    lastname: 'input[name="lastname"], input[name="last_name"], #lastname',
    phone: 'input[name="phone"], input[type="tel"], #phone',
    company: 'input[name="company"], input[name="organization"], #company',
    utm_source: 'input[name="utm_source"], #utm_source',
    utm_medium: 'input[name="utm_medium"], #utm_medium',
    utm_campaign: 'input[name="utm_campaign"], #utm_campaign'
  };
  private observer: MutationObserver | null = null;
  private observerDebounceTimer: number | null = null;
  private observerStopTimer: number | null = null;
  private submitTimer: number | null = null;
  private initTimer: number | null = null;
  private readyListener: (() => void) | null = null;
  private fillRetries = 0;
  private destroyed = false;

  constructor(config: FormFillerConfig = {}) {
    this.config = {
      formSelector: config.formSelector || 'form',
      fieldMappings: { ...this.defaultFieldMappings, ...config.fieldMappings },
      autoSubmit: config.autoSubmit ?? false,
      submitDelay: config.submitDelay ?? 1000,
      observeDOM: config.observeDOM ?? false,
      domObserverTimeout: config.domObserverTimeout ?? 10000,
      maxDOMObserveRetries: config.maxDOMObserveRetries ?? 10,
      onBeforeSubmit: config.onBeforeSubmit || (() => true),
      onAfterSubmit: config.onAfterSubmit || (() => {}),
      onError: config.onError || ((error) => console.error('AutoFormFiller Error:', error)),
      debug: config.debug ?? false,
      customSubmitFunction: config.customSubmitFunction
    };
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[AutoFormFiller] ${message}`, data ?? '');
    }
  }

  private getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    // URLSearchParams already percent-decodes keys and values.
    new URLSearchParams(window.location.search).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  /**
   * Finds the first field matching the comma-separated selectors that belongs
   * to `form` — either nested inside it or associated via the `form` attribute.
   */
  private findFormField(form: HTMLFormElement, selectors: string): FormField | null {
    const selectorList = selectors.split(',').map(s => s.trim()).filter(Boolean);

    for (const selector of selectorList) {
      try {
        const inside = form.querySelector<FormField>(selector);
        if (inside) {
          return inside;
        }
        const associated = Array.from(document.querySelectorAll<FormField>(selector))
          .find(el => el.form === form);
        if (associated) {
          return associated;
        }
      } catch (error) {
        this.config.onError(toError(error));
      }
    }

    return null;
  }

  /** Returns true only if the field actually took the given value. */
  private fillField(field: FormField, value: string): boolean {
    try {
      let target: FormField = field;
      const normalized = value.toLowerCase();

      if (field.type === 'checkbox') {
        if (TRUTHY_VALUES.includes(normalized)) {
          setNativeProperty(field, 'checked', true);
        } else if (FALSY_VALUES.includes(normalized)) {
          setNativeProperty(field, 'checked', false);
        } else {
          this.log(`Unrecognised checkbox value "${value}" for field "${field.name}"`);
          return false;
        }
      } else if (field.type === 'radio') {
        const scope: ParentNode = field.form ?? document;
        const radio = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
          .find(r => r.name === field.name && r.form === field.form && r.value === value);
        if (!radio) {
          this.log(`No radio option "${value}" in group "${field.name}"`);
          return false;
        }
        setNativeProperty(radio, 'checked', true);
        target = radio;
      } else if (field.tagName === 'SELECT') {
        const select = field as HTMLSelectElement;
        const option = Array.from(select.options).find(opt =>
          opt.value === value || opt.text.toLowerCase() === normalized
        );
        if (!option) {
          this.log(`No select option "${value}" for field "${field.name}"`);
          return false;
        }
        setNativeProperty(select, 'value', option.value);
      } else {
        setNativeProperty(field, 'value', value);
      }

      // Trigger change events so frameworks pick up the new value
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    } catch (error) {
      this.config.onError(toError(error));
      return false;
    }
  }

  private shouldObserve(): boolean {
    return !this.destroyed
      && this.config.observeDOM
      && this.fillRetries < this.config.maxDOMObserveRetries;
  }

  public fillForm(formSelector?: string): boolean {
    if (this.destroyed) {
      this.log('fillForm called on a destroyed instance');
      return false;
    }

    try {
      const queryParams = this.getQueryParams();
      this.log('Query parameters found:', queryParams);

      if (Object.keys(queryParams).length === 0) {
        this.log('No query parameters found');
        this.stopDOMObserver();
        return false;
      }

      const selector = formSelector || this.config.formSelector;
      const form = document.querySelector<HTMLFormElement>(selector);

      if (!form) {
        this.log(`Form not found with selector: ${selector}`);
        if (this.shouldObserve()) {
          this.startDOMObserver();
        }
        return false;
      }

      const filledData: Record<string, string> = {};

      Object.entries(queryParams).forEach(([param, value]) => {
        if (!hasOwn(this.config.fieldMappings, param)) {
          return;
        }
        const field = this.findFormField(form, this.config.fieldMappings[param]);
        if (!field) {
          this.log(`Field not found for parameter: ${param}`);
          return;
        }
        if (this.fillField(field, value)) {
          filledData[param] = value;
          this.log(`Filled field for ${param}:`, value);
        }
      });

      const fieldsFilledCount = Object.keys(filledData).length;

      if (fieldsFilledCount > 0) {
        this.log(`Successfully filled ${fieldsFilledCount} fields`);
        this.stopDOMObserver();

        if (this.config.autoSubmit) {
          this.clearSubmitTimer();
          this.submitTimer = window.setTimeout(() => {
            this.submitTimer = null;
            this.submitForm(form, filledData);
          }, this.config.submitDelay);
        }

        return true;
      }

      this.log('No fields were filled');
      if (this.shouldObserve()) {
        this.startDOMObserver();
      }
      return false;
    } catch (error) {
      this.config.onError(toError(error));
      return false;
    }
  }

  /**
   * Submits like a user clicking a submit button: runs constraint validation
   * and fires the `submit` event so framework handlers run. Returns false if
   * validation blocked the submission.
   */
  private nativeSubmit(form: HTMLFormElement): boolean {
    if (typeof form.requestSubmit !== 'function') {
      form.submit();
      return true;
    }

    let submitEventFired = false;
    const listener = () => {
      submitEventFired = true;
    };
    form.addEventListener('submit', listener, true);
    try {
      form.requestSubmit();
    } finally {
      form.removeEventListener('submit', listener, true);
    }
    return submitEventFired;
  }

  private submitForm(form: HTMLFormElement, data: Record<string, string>): void {
    if (this.destroyed) {
      return;
    }

    try {
      if (!this.config.onBeforeSubmit(form, data)) {
        this.log('Form submission cancelled by onBeforeSubmit callback');
        return;
      }

      this.log('Submitting form', data);

      if (this.config.customSubmitFunction) {
        const result = this.config.customSubmitFunction(form, data);
        if (result instanceof Promise) {
          result
            .then(() => this.config.onAfterSubmit(form, data))
            .catch(error => this.config.onError(toError(error)));
        } else {
          this.config.onAfterSubmit(form, data);
        }
        return;
      }

      if (this.nativeSubmit(form)) {
        this.config.onAfterSubmit(form, data);
      } else {
        this.config.onError(new Error('Form submission blocked: the form failed validation'));
      }
    } catch (error) {
      this.config.onError(toError(error));
    }
  }

  private startDOMObserver(): void {
    if (this.observer) {
      return;
    }

    const root = document.body ?? document.documentElement;
    if (!root) {
      return;
    }

    this.log('Starting DOM observer');

    this.observer = new MutationObserver((mutations) => {
      if (!mutations.some(m => m.addedNodes.length > 0)) {
        return;
      }
      this.log('DOM changed, attempting to fill form again.');

      // Debounce the fill attempt
      if (this.observerDebounceTimer !== null) {
        window.clearTimeout(this.observerDebounceTimer);
      }

      this.observerDebounceTimer = window.setTimeout(() => {
        this.observerDebounceTimer = null;
        this.fillRetries++;
        const filled = this.fillForm();
        if (!filled && this.observer && this.fillRetries >= this.config.maxDOMObserveRetries) {
          this.log(`Giving up after ${this.fillRetries} retries.`);
          this.stopDOMObserver();
        }
      }, OBSERVER_DEBOUNCE_MS);
    });

    this.observer.observe(root, {
      childList: true,
      subtree: true,
    });

    // Stop observing after a while
    this.observerStopTimer = window.setTimeout(() => {
      this.observerStopTimer = null;
      this.log('DOM observer timed out.');
      this.stopDOMObserver();
    }, this.config.domObserverTimeout);
  }

  private stopDOMObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.log('Stopped DOM observer.');
    }
    if (this.observerDebounceTimer !== null) {
      window.clearTimeout(this.observerDebounceTimer);
      this.observerDebounceTimer = null;
    }
    if (this.observerStopTimer !== null) {
      window.clearTimeout(this.observerStopTimer);
      this.observerStopTimer = null;
    }
  }

  private clearSubmitTimer(): void {
    if (this.submitTimer !== null) {
      window.clearTimeout(this.submitTimer);
      this.submitTimer = null;
    }
  }

  /**
   * Cancels any pending fill, DOM observation and auto-submit. Call this when
   * the page or component that owns the form goes away.
   */
  public destroy(): void {
    this.destroyed = true;
    this.stopDOMObserver();
    this.clearSubmitTimer();
    if (this.initTimer !== null) {
      window.clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    if (this.readyListener) {
      document.removeEventListener('DOMContentLoaded', this.readyListener);
      this.readyListener = null;
    }
  }

  public static init(config: FormFillerConfig = {}): AutoFormFiller {
    const filler = new AutoFormFiller(config);

    if (document.readyState === 'loading') {
      filler.readyListener = () => {
        filler.readyListener = null;
        filler.fillForm();
      };
      document.addEventListener('DOMContentLoaded', filler.readyListener, { once: true });
    } else {
      filler.initTimer = window.setTimeout(() => {
        filler.initTimer = null;
        filler.fillForm();
      }, 100);
    }

    return filler;
  }
}

// Convenience function for quick setup
export function autoFillForm(config: FormFillerConfig = {}): AutoFormFiller {
  return AutoFormFiller.init(config);
}

// Default export
export default AutoFormFiller;
