import { AutoFormFiller, FormFillerConfig } from '../index';

describe('AutoFormFiller', () => {
  let mockForm: HTMLFormElement;
  let mockInput: HTMLInputElement;
  let mockSelect: HTMLSelectElement;
  let mockCheckbox: HTMLInputElement;
  let mockRadio: HTMLInputElement;

  beforeEach(() => {
    // Reset the DOM
    document.body.innerHTML = '';

    // Create mock form elements
    mockForm = document.createElement('form');
    mockForm.id = 'test-form';

    mockInput = document.createElement('input');
    mockInput.type = 'text';
    mockInput.name = 'test-input';
    mockInput.id = 'test-input';

    mockSelect = document.createElement('select');
    mockSelect.name = 'test-select';
    mockSelect.id = 'test-select';
    const option1 = document.createElement('option');
    option1.value = 'option1';
    option1.text = 'Option 1';
    const option2 = document.createElement('option');
    option2.value = 'option2';
    option2.text = 'Option 2';
    mockSelect.appendChild(option1);
    mockSelect.appendChild(option2);

    mockCheckbox = document.createElement('input');
    mockCheckbox.type = 'checkbox';
    mockCheckbox.name = 'test-checkbox';
    mockCheckbox.id = 'test-checkbox';

    mockRadio = document.createElement('input');
    mockRadio.type = 'radio';
    mockRadio.name = 'test-radio';
    mockRadio.value = 'radio1';
    mockRadio.id = 'test-radio';

    // Add elements to form
    mockForm.appendChild(mockInput);
    mockForm.appendChild(mockSelect);
    mockForm.appendChild(mockCheckbox);
    mockForm.appendChild(mockRadio);
    document.body.appendChild(mockForm);

    // Mock URLSearchParams
    const mockSearchParams = new URLSearchParams();
    mockSearchParams.set('test-input', 'test value');
    mockSearchParams.set('test-select', 'option1');
    mockSearchParams.set('test-checkbox', 'true');
    mockSearchParams.set('test-radio', 'radio1');

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        search: mockSearchParams.toString()
      },
      writable: true
    });
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const filler = new AutoFormFiller();
      expect(filler).toBeInstanceOf(AutoFormFiller);
    });

    it('should merge custom config with defaults', () => {
      const customConfig: FormFillerConfig = {
        formSelector: '#custom-form',
        autoSubmit: true,
        submitDelay: 2000
      };

      const filler = new AutoFormFiller(customConfig);
      expect(filler).toBeInstanceOf(AutoFormFiller);
    });
  });

  describe('fillForm', () => {
    it('should fill text input fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: {
          'test-input': '#test-input'
        }
      });

      const result = filler.fillForm('#test-form');
      expect(result).toBe(true);
      expect(mockInput.value).toBe('test value');
    });

    it('should fill select fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: {
          'test-select': '#test-select'
        }
      });

      const result = filler.fillForm('#test-form');
      expect(result).toBe(true);
      expect(mockSelect.value).toBe('option1');
    });

    it('should handle checkbox fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: {
          'test-checkbox': '#test-checkbox'
        }
      });

      const result = filler.fillForm('#test-form');
      expect(result).toBe(true);
      expect(mockCheckbox.checked).toBe(true);
    });

    it('should handle radio fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: {
          'test-radio': '#test-radio'
        }
      });

      const result = filler.fillForm('#test-form');
      expect(result).toBe(true);
      expect(mockRadio.checked).toBe(true);
    });

    it('should return false when form is not found', () => {
      const filler = new AutoFormFiller();
      const result = filler.fillForm('#non-existent-form');
      expect(result).toBe(false);
    });

    it('should return false when no query parameters are present', () => {
      // Clear URL search params
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true
      });

      const filler = new AutoFormFiller();
      const result = filler.fillForm('#test-form');
      expect(result).toBe(false);
    });
  });

  describe('autoSubmit', () => {
    it('should auto submit form when configured', () => {
      jest.useFakeTimers();

      const mockSubmit = jest.fn();
      mockForm.submit = mockSubmit;

      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        fieldMappings: {
          'test-input': '#test-input'
        }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(mockSubmit).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should not auto submit form when not configured', () => {
      jest.useFakeTimers();

      const mockSubmit = jest.fn();
      mockForm.submit = mockSubmit;

      const filler = new AutoFormFiller({
        autoSubmit: false,
        fieldMappings: {
          'test-input': '#test-input'
        }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(mockSubmit).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('callbacks', () => {
    it('should call onBeforeSubmit callback', () => {
      jest.useFakeTimers();
      const onBeforeSubmit = jest.fn().mockReturnValue(true);
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onBeforeSubmit,
        fieldMappings: {
          'test-input': '#test-input'
        }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onBeforeSubmit).toHaveBeenCalled();
    });

    it('should call onAfterSubmit callback', () => {
      jest.useFakeTimers();
      const onAfterSubmit = jest.fn();
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onAfterSubmit,
        fieldMappings: {
          'test-input': '#test-input'
        }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onAfterSubmit).toHaveBeenCalled();
    });

    it('should call onError callback when error occurs', () => {
      jest.useFakeTimers();
      const onError = jest.fn();
      // Mock form.submit to throw
      mockForm.submit = jest.fn(() => { throw new Error('submit error'); });
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onError,
        fieldMappings: {
          'test-input': '#test-input'
        }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('static init', () => {
    it('should initialize and fill form when DOM is ready', () => {
      jest.useFakeTimers();
      const filler = AutoFormFiller.init({
        fieldMappings: {
          'test-input': '#test-input'
        }
      });
      jest.advanceTimersByTime(200); // Allow setTimeout in init to run
      expect(filler).toBeInstanceOf(AutoFormFiller);
      expect(mockInput.value).toBe('test value');
    });
  });
}); 