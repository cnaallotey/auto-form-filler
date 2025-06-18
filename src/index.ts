export interface FormFillerConfig {
  formSelector?: string;
  fieldMappings?: Record<string, string>;
  autoSubmit?: boolean;
  submitDelay?: number;
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

  constructor(config: FormFillerConfig = {}) {
    this.config = {
      formSelector: config.formSelector || 'form',
      fieldMappings: { ...this.defaultFieldMappings, ...config.fieldMappings },
      autoSubmit: config.autoSubmit ?? false,
      submitDelay: config.submitDelay ?? 1000,
      onBeforeSubmit: config.onBeforeSubmit || (() => true),
      onAfterSubmit: config.onAfterSubmit || (() => {}),
      onError: config.onError || ((error) => console.error('AutoFormFiller Error:', error)),
      debug: config.debug ?? false,
      customSubmitFunction: config.customSubmitFunction
    };
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[AutoFormFiller] ${message}`, data || '');
    }
  }

  private getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    urlParams.forEach((value, key) => {
      params[key] = decodeURIComponent(value);
    });
    
    return params;
  }

  private findFormField(selectors: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
    const selectorList = selectors.split(',').map(s => s.trim());
    
    for (const selector of selectorList) {
      const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (element) {
        return element;
      }
    }
    
    return null;
  }

  private fillField(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): boolean {
    try {
      if (field.type === 'checkbox') {
        (field as HTMLInputElement).checked = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      } else if (field.type === 'radio') {
        const radioGroup = document.querySelectorAll(`input[name="${field.name}"]`) as NodeListOf<HTMLInputElement>;
        radioGroup.forEach(radio => {
          if (radio.value === value) {
            radio.checked = true;
          }
        });
      } else if (field.tagName === 'SELECT') {
        const select = field as HTMLSelectElement;
        const option = Array.from(select.options).find(opt => 
          opt.value === value || opt.text.toLowerCase() === value.toLowerCase()
        );
        if (option) {
          select.value = option.value;
        }
      } else {
        field.value = value;
      }

      // Trigger change events
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    } catch (error) {
      this.config.onError(error as Error);
      return false;
    }
  }

  public fillForm(formSelector?: string): boolean {
    try {
      const selector = formSelector || this.config.formSelector;
      const form = document.querySelector(selector) as HTMLFormElement;
      
      if (!form) {
        this.log(`Form not found with selector: ${selector}`);
        return false;
      }

      const queryParams = this.getQueryParams();
      this.log('Query parameters found:', queryParams);

      if (Object.keys(queryParams).length === 0) {
        this.log('No query parameters found');
        return false;
      }

      let fieldsFilledCount = 0;
      const filledData: Record<string, string> = {};

      // Fill fields based on mappings
      Object.entries(queryParams).forEach(([param, value]) => {
        const fieldSelectors = this.config.fieldMappings[param];
        
        if (fieldSelectors) {
          const field = this.findFormField(fieldSelectors);
          
          if (field) {
            const success = this.fillField(field, value);
            if (success) {
              fieldsFilledCount++;
              filledData[param] = value;
              this.log(`Filled field for ${param}:`, value);
            }
          } else {
            this.log(`Field not found for parameter: ${param}`);
          }
        }
      });

      if (fieldsFilledCount > 0) {
        this.log(`Successfully filled ${fieldsFilledCount} fields`);
        
        if (this.config.autoSubmit) {
          setTimeout(() => {
            this.submitForm(form, filledData);
          }, this.config.submitDelay);
        }
        
        return true;
      } else {
        this.log('No fields were filled');
        return false;
      }
      
    } catch (error) {
      this.config.onError(error as Error);
      return false;
    }
  }

  private submitForm(form: HTMLFormElement, data: Record<string, string>): void {
    try {
      const shouldSubmit = this.config.onBeforeSubmit(form, data);
      
      if (shouldSubmit) {
        this.log('Submitting form', data);
        
        if (this.config.customSubmitFunction) {
          const result = this.config.customSubmitFunction(form, data);
          if (result instanceof Promise) {
            result
              .then(() => this.config.onAfterSubmit(form, data))
              .catch(error => this.config.onError(error));
          } else {
            this.config.onAfterSubmit(form, data);
          }
        } else {
          form.submit();
          this.config.onAfterSubmit(form, data);
        }
      } else {
        this.log('Form submission cancelled by onBeforeSubmit callback');
      }
    } catch (error) {
      this.config.onError(error as Error);
    }
  }

  public static init(config: FormFillerConfig = {}): AutoFormFiller {
    const filler = new AutoFormFiller(config);
    
    // Auto-fill when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        filler.fillForm();
      });
    } else {
      // DOM is already ready
      setTimeout(() => filler.fillForm(), 100);
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