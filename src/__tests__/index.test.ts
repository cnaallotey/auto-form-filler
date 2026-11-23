import { AutoFormFiller, FormFillerConfig, autoFillForm } from '../index';

function setQuery(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true
  });
}

/** Lets pending MutationObserver callbacks run. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

/** Records native submissions without letting jsdom attempt navigation. */
function trackSubmits(form: HTMLFormElement): jest.Mock {
  const onSubmit = jest.fn((event: Event) => event.preventDefault());
  form.addEventListener('submit', onSubmit);
  return onSubmit;
}

describe('AutoFormFiller', () => {
  let mockForm: HTMLFormElement;
  let mockInput: HTMLInputElement;
  let mockSelect: HTMLSelectElement;
  let mockCheckbox: HTMLInputElement;
  let mockRadio: HTMLInputElement;
  let mockRadio2: HTMLInputElement;

  beforeEach(() => {
    document.body.innerHTML = '';

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

    mockRadio2 = document.createElement('input');
    mockRadio2.type = 'radio';
    mockRadio2.name = 'test-radio';
    mockRadio2.value = 'radio2';
    mockRadio2.id = 'test-radio-2';

    mockForm.appendChild(mockInput);
    mockForm.appendChild(mockSelect);
    mockForm.appendChild(mockCheckbox);
    mockForm.appendChild(mockRadio);
    mockForm.appendChild(mockRadio2);
    document.body.appendChild(mockForm);

    const mockSearchParams = new URLSearchParams();
    mockSearchParams.set('test-input', 'test value');
    mockSearchParams.set('test-select', 'option1');
    mockSearchParams.set('test-checkbox', 'true');
    mockSearchParams.set('test-radio', 'radio1');
    setQuery(mockSearchParams.toString());
  });

  afterEach(() => {
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
        fieldMappings: { 'test-input': '#test-input' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockInput.value).toBe('test value');
    });

    it('should fill select fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-select': '#test-select' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockSelect.value).toBe('option1');
    });

    it('should match select options by visible text', () => {
      setQuery('test-select=option%202');
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-select': '#test-select' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockSelect.value).toBe('option2');
    });

    it('should handle checkbox fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-checkbox': '#test-checkbox' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockCheckbox.checked).toBe(true);
    });

    it('should uncheck a checkbox for a falsy value', () => {
      setQuery('test-checkbox=no');
      mockCheckbox.checked = true;
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-checkbox': '#test-checkbox' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockCheckbox.checked).toBe(false);
    });

    it('should not count an unrecognised checkbox value as filled', () => {
      setQuery('test-checkbox=maybe');
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-checkbox': '#test-checkbox' }
      });

      expect(filler.fillForm('#test-form')).toBe(false);
      expect(mockCheckbox.checked).toBe(false);
    });

    it('should handle radio fields', () => {
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-radio': '#test-radio' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockRadio.checked).toBe(true);
    });

    it('should check the matching radio in the group and fire events on it', () => {
      setQuery('test-radio=radio2');
      const onChange = jest.fn();
      mockRadio2.addEventListener('change', onChange);
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-radio': '#test-radio' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockRadio2.checked).toBe(true);
      expect(onChange).toHaveBeenCalled();
    });

    it('should not count an unmatched radio value as filled', () => {
      setQuery('test-radio=nope');
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-radio': '#test-radio' }
      });

      expect(filler.fillForm('#test-form')).toBe(false);
    });

    it('should not count an unmatched select option as filled', () => {
      setQuery('test-select=zz');
      const filler = new AutoFormFiller({
        fieldMappings: { 'test-select': '#test-select' }
      });

      expect(filler.fillForm('#test-form')).toBe(false);
      expect(mockSelect.value).toBe('option1');
    });

    it('should return false when form is not found', () => {
      const filler = new AutoFormFiller();
      expect(filler.fillForm('#non-existent-form')).toBe(false);
    });

    it('should return false when no query parameters are present', () => {
      setQuery('');
      const filler = new AutoFormFiller();
      expect(filler.fillForm('#test-form')).toBe(false);
    });

    it('should keep literal percent signs in values', () => {
      setQuery('test-input=100%25%20off');
      const onError = jest.fn();
      const filler = new AutoFormFiller({
        onError,
        fieldMappings: { 'test-input': '#test-input' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockInput.value).toBe('100% off');
      expect(onError).not.toHaveBeenCalled();
    });

    it('should ignore params named after Object.prototype members', () => {
      setQuery('constructor=1&toString=2&__proto__=3&test-input=hello');
      const onError = jest.fn();
      const filler = new AutoFormFiller({
        onError,
        fieldMappings: { 'test-input': '#test-input' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockInput.value).toBe('hello');
      expect(onError).not.toHaveBeenCalled();
    });

    it('should only fill fields that belong to the target form', () => {
      document.body.innerHTML = `
        <form id="newsletter"><input name="email"></form>
        <form id="signup"><input name="email"></form>
      `;
      setQuery('email=a%40b.c');
      const filler = new AutoFormFiller({ formSelector: '#signup' });

      expect(filler.fillForm()).toBe(true);
      expect(document.querySelector<HTMLInputElement>('#newsletter input')!.value).toBe('');
      expect(document.querySelector<HTMLInputElement>('#signup input')!.value).toBe('a@b.c');
    });

    it('should fill fields associated with the form via the form attribute', () => {
      document.body.innerHTML = `
        <input name="email" form="signup">
        <form id="signup"></form>
      `;
      setQuery('email=a%40b.c');
      const filler = new AutoFormFiller({ formSelector: '#signup' });

      expect(filler.fillForm()).toBe(true);
      expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('a@b.c');
    });

    it('should use the default mappings', () => {
      document.body.innerHTML = `
        <form><input type="email" id="work-email"><input name="first_name"></form>
      `;
      setQuery('email=a%40b.c&firstname=Ada');
      const filler = new AutoFormFiller();

      expect(filler.fillForm()).toBe(true);
      expect(document.querySelector<HTMLInputElement>('#work-email')!.value).toBe('a@b.c');
      expect(document.querySelector<HTMLInputElement>('[name="first_name"]')!.value).toBe('Ada');
    });

    it('should report an invalid selector and still fill other fields', () => {
      setQuery('bad=1&test-input=ok');
      const onError = jest.fn();
      const filler = new AutoFormFiller({
        onError,
        fieldMappings: { bad: 'input[[', 'test-input': '#test-input' }
      });

      expect(filler.fillForm('#test-form')).toBe(true);
      expect(mockInput.value).toBe('ok');
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should bypass instance-level value setters (React value tracking)', () => {
      // React installs an instance property that records the last value set
      // through it, and ignores input events whose value matches that record.
      let trackedValue = '';
      const protoDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
      Object.defineProperty(mockInput, 'value', {
        configurable: true,
        get() { return protoDescriptor.get!.call(this); },
        set(v: string) { trackedValue = v; protoDescriptor.set!.call(this, v); }
      });

      const filler = new AutoFormFiller({
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.fillForm('#test-form');

      expect(mockInput.value).toBe('test value');
      expect(trackedValue).toBe('');
    });
  });

  describe('autoSubmit', () => {
    it('should auto submit form when configured', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);

      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(999);
      expect(onSubmit).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not auto submit form when not configured', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);

      const filler = new AutoFormFiller({
        autoSubmit: false,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not auto submit when nothing was actually filled', () => {
      jest.useFakeTimers();
      setQuery('test-select=zz');
      const onSubmit = trackSubmits(mockForm);

      const filler = new AutoFormFiller({
        autoSubmit: true,
        fieldMappings: { 'test-select': '#test-select' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(2000);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should submit only once when fillForm is called repeatedly', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);

      const filler = new AutoFormFiller({
        autoSubmit: true,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(2000);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('should run constraint validation and report a blocked submission', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);
      const required = document.createElement('input');
      required.name = 'required-field';
      required.required = true;
      mockForm.appendChild(required);

      const onError = jest.fn();
      const onAfterSubmit = jest.fn();
      const filler = new AutoFormFiller({
        autoSubmit: true,
        onError,
        onAfterSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onAfterSubmit).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('failed validation')
      }));
    });

    it('should fall back to form.submit() when requestSubmit is unavailable', () => {
      jest.useFakeTimers();
      const submit = jest.fn();
      Object.defineProperty(mockForm, 'requestSubmit', { value: undefined });
      mockForm.submit = submit;

      const filler = new AutoFormFiller({
        autoSubmit: true,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(submit).toHaveBeenCalled();
    });
  });

  describe('customSubmitFunction', () => {
    it('should call a sync custom submit function instead of submitting', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);
      const customSubmitFunction = jest.fn();
      const onAfterSubmit = jest.fn();

      const filler = new AutoFormFiller({
        autoSubmit: true,
        customSubmitFunction,
        onAfterSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);

      expect(customSubmitFunction).toHaveBeenCalledWith(mockForm, { 'test-input': 'test value' });
      expect(onAfterSubmit).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onAfterSubmit after an async custom submit resolves', async () => {
      jest.useFakeTimers();
      const onAfterSubmit = jest.fn();

      const filler = new AutoFormFiller({
        autoSubmit: true,
        customSubmitFunction: () => Promise.resolve(),
        onAfterSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      await flushMicrotasks();

      expect(onAfterSubmit).toHaveBeenCalled();
    });

    it('should call onError when an async custom submit rejects', async () => {
      jest.useFakeTimers();
      const onError = jest.fn();
      const onAfterSubmit = jest.fn();

      const filler = new AutoFormFiller({
        autoSubmit: true,
        customSubmitFunction: () => Promise.reject('network down'),
        onError,
        onAfterSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      await flushMicrotasks();

      expect(onAfterSubmit).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(new Error('network down'));
    });
  });

  describe('callbacks', () => {
    it('should call onBeforeSubmit callback', () => {
      jest.useFakeTimers();
      trackSubmits(mockForm);
      const onBeforeSubmit = jest.fn().mockReturnValue(true);
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onBeforeSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onBeforeSubmit).toHaveBeenCalled();
    });

    it('should not submit when onBeforeSubmit returns false', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);
      const filler = new AutoFormFiller({
        autoSubmit: true,
        onBeforeSubmit: () => false,
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should call onAfterSubmit callback', () => {
      jest.useFakeTimers();
      trackSubmits(mockForm);
      const onAfterSubmit = jest.fn();
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onAfterSubmit,
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onAfterSubmit).toHaveBeenCalled();
    });

    it('should call onError callback when error occurs', () => {
      jest.useFakeTimers();
      const onError = jest.fn();
      mockForm.requestSubmit = jest.fn(() => { throw new Error('submit error'); });
      const filler = new AutoFormFiller({
        autoSubmit: true,
        submitDelay: 1000,
        onError,
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.fillForm('#test-form');
      jest.advanceTimersByTime(1000);
      expect(onError).toHaveBeenCalledWith(new Error('submit error'));
    });
  });

  describe('observeDOM', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="root"></div>';
      setQuery('email=a%40b.c');
    });

    function addNode(html: string): void {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.getElementById('root')!.appendChild(wrapper);
    }

    it('should fill a form that is rendered later', async () => {
      jest.useFakeTimers();
      const filler = new AutoFormFiller({ formSelector: '#late', observeDOM: true });

      expect(filler.fillForm()).toBe(false);
      addNode('<form id="late"><input name="email"></form>');
      await flushMicrotasks();
      jest.advanceTimersByTime(500);

      expect(document.querySelector<HTMLInputElement>('#late input')!.value).toBe('a@b.c');
    });

    it('should stop retrying after maxDOMObserveRetries', async () => {
      jest.useFakeTimers();
      const filler = new AutoFormFiller({
        formSelector: '#late',
        observeDOM: true,
        maxDOMObserveRetries: 2,
        domObserverTimeout: 60000
      });
      const spy = jest.spyOn(filler, 'fillForm');

      filler.fillForm();
      for (let i = 0; i < 5; i++) {
        addNode('<span></span>');
        await flushMicrotasks();
        jest.advanceTimersByTime(500);
      }

      // 1 initial call + 2 retries
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('should stop observing after domObserverTimeout', async () => {
      jest.useFakeTimers();
      const filler = new AutoFormFiller({
        formSelector: '#late',
        observeDOM: true,
        domObserverTimeout: 1000
      });
      const spy = jest.spyOn(filler, 'fillForm');

      filler.fillForm();
      jest.advanceTimersByTime(1000);
      addNode('<form id="late"><input name="email"></form>');
      await flushMicrotasks();
      jest.advanceTimersByTime(500);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(document.querySelector<HTMLInputElement>('#late input')!.value).toBe('');
    });

    it('should not let a stale timeout stop a newer observer', async () => {
      jest.useFakeTimers();
      setQuery('email=a%40b.c');
      document.body.innerHTML = '<div id="root"></div>';
      const filler = new AutoFormFiller({
        formSelector: '#late',
        observeDOM: true,
        domObserverTimeout: 2000
      });

      // t=0: first observer starts (its timeout is due at t=2000). The form
      // appears and is filled at t=500, which stops that observer.
      filler.fillForm();
      addNode('<form id="late"><input name="email"></form>');
      await flushMicrotasks();
      jest.advanceTimersByTime(500);
      expect(document.querySelector<HTMLInputElement>('#late input')!.value).toBe('a@b.c');

      // t=1500: form is gone; a manual fill starts a second observer
      // (timeout due at t=3500).
      jest.advanceTimersByTime(1000);
      document.getElementById('root')!.innerHTML = '';
      filler.fillForm();

      // t=2100: past the first observer's stale timeout.
      jest.advanceTimersByTime(600);
      addNode('<form id="late"><input name="email"></form>');
      await flushMicrotasks();
      jest.advanceTimersByTime(500);

      expect(document.querySelector<HTMLInputElement>('#late input')!.value).toBe('a@b.c');
    });

    it('should not observe when there are no query parameters', async () => {
      jest.useFakeTimers();
      setQuery('');
      const filler = new AutoFormFiller({ formSelector: '#late', observeDOM: true });
      const spy = jest.spyOn(filler, 'fillForm');

      filler.fillForm();
      addNode('<form id="late"><input name="email"></form>');
      await flushMicrotasks();
      jest.advanceTimersByTime(500);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('should cancel a pending auto-submit', () => {
      jest.useFakeTimers();
      const onSubmit = trackSubmits(mockForm);
      const filler = new AutoFormFiller({
        autoSubmit: true,
        fieldMappings: { 'test-input': '#test-input' }
      });

      filler.fillForm('#test-form');
      filler.destroy();
      jest.advanceTimersByTime(2000);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should stop the DOM observer', async () => {
      jest.useFakeTimers();
      document.body.innerHTML = '<div id="root"></div>';
      setQuery('email=a%40b.c');
      const filler = new AutoFormFiller({ formSelector: '#late', observeDOM: true });

      filler.fillForm();
      filler.destroy();
      document.getElementById('root')!.innerHTML = '<form id="late"><input name="email"></form>';
      await flushMicrotasks();
      jest.advanceTimersByTime(500);

      expect(document.querySelector<HTMLInputElement>('#late input')!.value).toBe('');
    });

    it('should cancel the fill scheduled by init', () => {
      jest.useFakeTimers();
      const filler = AutoFormFiller.init({
        fieldMappings: { 'test-input': '#test-input' }
      });
      filler.destroy();
      jest.advanceTimersByTime(200);

      expect(mockInput.value).toBe('');
    });
  });

  describe('static init', () => {
    it('should initialize and fill form when DOM is ready', () => {
      jest.useFakeTimers();
      const filler = AutoFormFiller.init({
        fieldMappings: { 'test-input': '#test-input' }
      });
      jest.advanceTimersByTime(200);
      expect(filler).toBeInstanceOf(AutoFormFiller);
      expect(mockInput.value).toBe('test value');
    });

    it('should expose autoFillForm as a shortcut for init', () => {
      jest.useFakeTimers();
      const filler = autoFillForm({
        fieldMappings: { 'test-input': '#test-input' }
      });
      jest.advanceTimersByTime(200);
      expect(filler).toBeInstanceOf(AutoFormFiller);
      expect(mockInput.value).toBe('test value');
    });
  });
});
