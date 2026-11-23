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
  /** Fill fields whose `name` or `id` matches a parameter that has no mapping. */
  matchByName?: boolean;
  /** Remove the parameters that filled a field from the address bar. */
  cleanUrl?: boolean;
  /** Parameters to remember across pages, e.g. `['utm_*']`. `*` matches anything. */
  persist?: string[];
  /** Where remembered parameters are kept: this tab only, or across visits. */
  persistStorage?: 'session' | 'local';
  /** Fill fields that already have a value. Set to false to leave them alone. */
  overwrite?: boolean;
  /** Only read parameters that start with this prefix, e.g. `'ff_'` reads `?ff_email=`. */
  prefix?: string;
  /** Change values before they're filled, keyed by parameter name. */
  transform?: Record<string, (value: string) => string>;
  /** Only these parameters may fill fields. `*` matches anything. */
  allow?: string[];
}

type RequiredFormFillerConfig = Omit<Required<FormFillerConfig>, 'customSubmitFunction' | 'allow'> & {
  customSubmitFunction?: (form: HTMLFormElement, data: Record<string, string>) => Promise<void> | void;
  allow?: string[];
};

export interface FieldMapping {
  [queryParam: string]: string; // query param -> form field selector
}

export type PrefillValue = string | number | boolean;
export type PrefillData = Record<string, PrefillValue | PrefillValue[] | null | undefined>;

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const TRUTHY_VALUES = ['true', '1', 'yes', 'on'];
const FALSY_VALUES = ['false', '0', 'no', 'off'];
/** Input types the library never fills. */
const BLOCKED_INPUT_TYPES = ['password', 'file', 'submit', 'reset', 'button', 'image'];
const OBSERVER_DEBOUNCE_MS = 500;
export const PERSIST_STORAGE_KEY = 'auto-form-filler:persisted';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a matcher for names like `utm_*`, where `*` matches any characters. */
function toMatcher(patterns: string[]): (name: string) => boolean {
  const regexes = patterns.map(p => new RegExp('^' + p.split('*').map(escapeRegExp).join('.*') + '$'));
  return name => regexes.some(r => r.test(name));
}

function isFormField(el: Element): el is FormField {
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
}

function last<T>(items: T[]): T {
  return items[items.length - 1];
}

/**
 * Sets `value` / `checked` / `selected` through the element prototype's native
 * setter. Frameworks such as React wrap these properties on the instance to
 * track changes; assigning through the instance would make them ignore the
 * subsequent input/change events.
 */
function setNativeProperty(el: Element, prop: 'value' | 'checked' | 'selected', value: string | boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), prop);
  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    (el as unknown as Record<string, unknown>)[prop] = value;
  }
}

function dispatchChange(el: Element): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Adds values to a URL's query string, encoded so the library reads them back
 * exactly. Arrays become repeated parameters; `null` and `undefined` remove
 * the parameter. Works with absolute and relative URLs.
 */
export function buildPrefillUrl(url: string, data: PrefillData, options: { prefix?: string } = {}): string {
  const prefix = options.prefix ?? '';
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const params = new URLSearchParams(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '');

  Object.keys(data).forEach((key) => {
    const name = prefix + key;
    const raw = data[key];
    params.delete(name);
    if (raw === null || raw === undefined) {
      return;
    }
    (Array.isArray(raw) ? raw : [raw]).forEach(value => params.append(name, String(value)));
  });

  const query = params.toString();
  return path + (query ? '?' + query : '') + hash;
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
  private isAllowed: (name: string) => boolean;
  private shouldPersist: (name: string) => boolean;
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
      customSubmitFunction: config.customSubmitFunction,
      matchByName: config.matchByName ?? false,
      cleanUrl: config.cleanUrl ?? false,
      persist: config.persist ?? [],
      persistStorage: config.persistStorage ?? 'session',
      overwrite: config.overwrite ?? true,
      prefix: config.prefix ?? '',
      transform: config.transform ?? {},
      allow: config.allow
    };
    this.isAllowed = this.config.allow ? toMatcher(this.config.allow) : () => true;
    this.shouldPersist = toMatcher(this.config.persist);
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[AutoFormFiller] ${message}`, data ?? '');
    }
  }

  // ---------- Reading parameters ----------

  /** Parameters from the URL, keyed by name without the prefix. Repeated parameters keep every value. */
  private readUrlParams(): Map<string, string[]> {
    const params = new Map<string, string[]>();
    const prefix = this.config.prefix;
    // URLSearchParams already percent-decodes keys and values.
    new URLSearchParams(window.location.search).forEach((value, rawKey) => {
      if (prefix && !rawKey.startsWith(prefix)) {
        return;
      }
      const key = rawKey.slice(prefix.length);
      if (!key) {
        return;
      }
      const values = params.get(key);
      if (values) {
        values.push(value);
      } else {
        params.set(key, [value]);
      }
    });
    return params;
  }

  private getStorage(): Storage | null {
    try {
      return this.config.persistStorage === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  }

  private readPersisted(): Record<string, string[]> {
    const storage = this.getStorage();
    if (!storage) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(storage.getItem(PERSIST_STORAGE_KEY) || '{}');
      const result: Record<string, string[]> = {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach((key) => {
          const values = (parsed as Record<string, unknown>)[key];
          if (Array.isArray(values) && values.every(v => typeof v === 'string')) {
            result[key] = values as string[];
          }
        });
      }
      return result;
    } catch {
      return {};
    }
  }

  /** Saves URL parameters that match `persist` so later pages can use them. */
  private savePersisted(urlParams: Map<string, string[]>): void {
    if (!this.config.persist.length) {
      return;
    }
    const toSave: Record<string, string[]> = {};
    urlParams.forEach((values, key) => {
      if (this.shouldPersist(key) && this.isAllowed(key)) {
        toSave[key] = values;
      }
    });
    if (!Object.keys(toSave).length) {
      return;
    }
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(PERSIST_STORAGE_KEY, JSON.stringify({ ...this.readPersisted(), ...toSave }));
      this.log('Remembered parameters:', toSave);
    } catch (error) {
      this.config.onError(toError(error));
    }
  }

  /** URL parameters merged over remembered ones (URL wins), filtered by `allow`. */
  private collectParams(): { params: Map<string, string[]>; fromUrl: Set<string> } {
    const urlParams = this.readUrlParams();
    this.savePersisted(urlParams);

    const params = new Map<string, string[]>();
    if (this.config.persist.length) {
      const persisted = this.readPersisted();
      Object.keys(persisted).forEach((key) => {
        if (this.shouldPersist(key) && this.isAllowed(key)) {
          params.set(key, persisted[key]);
        }
      });
    }
    urlParams.forEach((values, key) => {
      if (this.isAllowed(key)) {
        params.set(key, values);
      } else {
        this.log(`Ignored parameter not in allow list: ${key}`);
      }
    });
    return { params, fromUrl: new Set(urlParams.keys()) };
  }

  /** Forgets parameters remembered with `persist`. */
  public clearPersisted(): void {
    const storage = this.getStorage();
    try {
      storage?.removeItem(PERSIST_STORAGE_KEY);
    } catch (error) {
      this.config.onError(toError(error));
    }
  }

  // ---------- Finding fields ----------

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

  private findFieldByName(form: HTMLFormElement, key: string): FormField | null {
    const fields = Array.from(form.elements).filter(isFormField);
    return fields.find(el => el.name === key) ?? fields.find(el => el.id === key) ?? null;
  }

  private resolveField(form: HTMLFormElement, key: string): FormField | null {
    if (hasOwn(this.config.fieldMappings, key)) {
      const mapped = this.findFormField(form, this.config.fieldMappings[key]);
      if (mapped) {
        return mapped;
      }
    }
    return this.config.matchByName ? this.findFieldByName(form, key) : null;
  }

  /** Other inputs of the same type and name in the same form (radio or checkbox groups). */
  private groupOf(field: HTMLInputElement): HTMLInputElement[] {
    const pool: Element[] = field.form
      ? Array.from(field.form.elements)
      : Array.from(document.querySelectorAll('input'));
    return pool.filter((el): el is HTMLInputElement =>
      el.tagName === 'INPUT'
      && (el as HTMLInputElement).type === field.type
      && (el as HTMLInputElement).name === field.name
      && (el as HTMLInputElement).form === field.form
    );
  }

  /** True when the field's value differs from what the page's HTML set. */
  private hasExistingValue(field: FormField): boolean {
    if (field.type === 'checkbox' || field.type === 'radio') {
      const group = field.name ? this.groupOf(field as HTMLInputElement) : [field as HTMLInputElement];
      return group.some(el => el.checked !== el.defaultChecked);
    }
    if (field.tagName === 'SELECT') {
      const select = field as HTMLSelectElement;
      const options = Array.from(select.options);
      if (select.multiple) {
        return options.some(opt => opt.selected !== opt.defaultSelected);
      }
      const defaultIndex = options.findIndex(opt => opt.defaultSelected);
      return select.selectedIndex !== (defaultIndex >= 0 ? defaultIndex : Math.min(0, options.length - 1));
    }
    return field.value !== '';
  }

  // ---------- Filling ----------

  private applyTransform(key: string, values: string[]): string[] | null {
    if (!hasOwn(this.config.transform, key)) {
      return values;
    }
    try {
      return values.map(value => String(this.config.transform[key](value)));
    } catch (error) {
      this.config.onError(toError(error));
      return null;
    }
  }

  /**
   * Fills the field and returns the value it now holds (comma-separated for
   * checkbox groups and multi-selects), or null if nothing was filled.
   */
  private fillField(field: FormField, values: string[]): string | null {
    try {
      if (field.tagName === 'INPUT' && BLOCKED_INPUT_TYPES.includes(field.type)) {
        this.log(`Never fills ${field.type} fields: "${field.name}"`);
        return null;
      }
      if (!this.config.overwrite && this.hasExistingValue(field)) {
        this.log(`Left "${field.name}" alone because it already has a value`);
        return null;
      }

      const value = last(values);

      if (field.type === 'checkbox') {
        return this.fillCheckbox(field as HTMLInputElement, values);
      }

      if (field.type === 'radio') {
        const radio = this.groupOf(field as HTMLInputElement).find(r => r.value === value);
        if (!radio) {
          this.log(`No radio option "${value}" in group "${field.name}"`);
          return null;
        }
        setNativeProperty(radio, 'checked', true);
        dispatchChange(radio);
        return value;
      }

      if (field.tagName === 'SELECT') {
        return this.fillSelect(field as HTMLSelectElement, values);
      }

      setNativeProperty(field, 'value', value);
      dispatchChange(field);
      return value;
    } catch (error) {
      this.config.onError(toError(error));
      return null;
    }
  }

  private fillCheckbox(field: HTMLInputElement, values: string[]): string | null {
    const group = field.name ? this.groupOf(field) : [field];

    // A group of checkboxes sharing a name: check the ones whose value was given.
    if (group.length > 1) {
      const matched = group.filter(cb => values.includes(cb.value));
      if (!matched.length) {
        this.log(`No checkbox in group "${field.name}" matches`, values);
        return null;
      }
      group.forEach((cb) => {
        const checked = values.includes(cb.value);
        if (cb.checked !== checked) {
          setNativeProperty(cb, 'checked', checked);
          dispatchChange(cb);
        }
      });
      return matched.map(cb => cb.value).join(',');
    }

    // A single checkbox: yes/no style values, or its own value.
    const value = last(values);
    const normalized = value.toLowerCase();
    let checked: boolean;
    if (TRUTHY_VALUES.includes(normalized)) {
      checked = true;
    } else if (FALSY_VALUES.includes(normalized)) {
      checked = false;
    } else if (field.hasAttribute('value') && value === field.value) {
      checked = true;
    } else {
      this.log(`Unrecognised checkbox value "${value}" for field "${field.name}"`);
      return null;
    }
    setNativeProperty(field, 'checked', checked);
    dispatchChange(field);
    return value;
  }

  private fillSelect(select: HTMLSelectElement, values: string[]): string | null {
    const options = Array.from(select.options);
    const matches = (opt: HTMLOptionElement, value: string) =>
      opt.value === value || opt.text.toLowerCase() === value.toLowerCase();

    if (select.multiple) {
      const chosen = options.filter(opt => values.some(value => matches(opt, value)));
      if (!chosen.length) {
        this.log(`No select option matches for field "${select.name}"`, values);
        return null;
      }
      options.forEach(opt => setNativeProperty(opt, 'selected', chosen.includes(opt)));
      dispatchChange(select);
      return chosen.map(opt => opt.value).join(',');
    }

    const value = last(values);
    const option = options.find(opt => matches(opt, value));
    if (!option) {
      this.log(`No select option "${value}" for field "${select.name}"`);
      return null;
    }
    setNativeProperty(select, 'value', option.value);
    dispatchChange(select);
    return option.value;
  }

  /** Removes the given parameters from the address bar without reloading. */
  private removeFromUrl(keys: string[]): void {
    if (!keys.length) {
      return;
    }
    try {
      const url = new URL(window.location.href);
      keys.forEach(key => url.searchParams.delete(this.config.prefix + key));
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      this.log('Removed parameters from the URL:', keys);
    } catch (error) {
      this.config.onError(toError(error));
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
      const { params, fromUrl } = this.collectParams();
      if (this.config.debug) {
        const found: Record<string, string[]> = {};
        params.forEach((values, key) => { found[key] = values; });
        this.log('Parameters found:', found);
      }

      if (params.size === 0) {
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

      params.forEach((rawValues, key) => {
        const field = this.resolveField(form, key);
        if (!field) {
          this.log(`Field not found for parameter: ${key}`);
          return;
        }
        const values = this.applyTransform(key, rawValues);
        if (!values || !values.length) {
          return;
        }
        const applied = this.fillField(field, values);
        if (applied !== null) {
          filledData[key] = applied;
          this.log(`Filled field for ${key}:`, applied);
        }
      });

      const filledKeys = Object.keys(filledData);

      if (filledKeys.length > 0) {
        this.log(`Successfully filled ${filledKeys.length} fields`);
        this.stopDOMObserver();

        if (this.config.cleanUrl) {
          this.removeFromUrl(filledKeys.filter(key => fromUrl.has(key)));
        }

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

  // ---------- Submitting ----------

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

  // ---------- Watching for late forms ----------

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
