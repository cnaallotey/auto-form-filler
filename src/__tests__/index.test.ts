import { AutoFormFiller, FormFillerConfig, autoFillForm, buildPrefillUrl, PERSIST_STORAGE_KEY } from '../index';

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

describe('fill options', () => {
  function setLocation(href: string): void {
    const url = new URL(href);
    Object.defineProperty(window, 'location', {
      value: { href: url.href, search: url.search, pathname: url.pathname, hash: url.hash },
      writable: true
    });
  }

  function render(html: string): HTMLFormElement {
    document.body.innerHTML = html;
    return document.querySelector('form')!;
  }

  function field<T extends Element = HTMLInputElement>(selector: string): T {
    return document.querySelector(selector) as unknown as T;
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  describe('matchByName', () => {
    it('is off by default', () => {
      render('<form><input name="plan"></form>');
      setLocation('https://example.com/?plan=team');

      expect(new AutoFormFiller().fillForm()).toBe(false);
      expect(field('input').value).toBe('');
    });

    it('fills a field whose name matches an unmapped parameter', () => {
      render('<form><input name="plan"><input id="seats"></form>');
      setLocation('https://example.com/?plan=team&seats=5');

      expect(new AutoFormFiller({ matchByName: true }).fillForm()).toBe(true);
      expect(field('[name="plan"]').value).toBe('team');
      expect(field('#seats').value).toBe('5');
    });

    it('prefers an explicit mapping over a name match', () => {
      render('<form><input name="plan"><input id="chosen-plan"></form>');
      setLocation('https://example.com/?plan=team');

      new AutoFormFiller({ matchByName: true, fieldMappings: { plan: '#chosen-plan' } }).fillForm();
      expect(field('#chosen-plan').value).toBe('team');
      expect(field('[name="plan"]').value).toBe('');
    });

    it('only matches fields that belong to the form', () => {
      render('<input name="plan"><form></form>');
      setLocation('https://example.com/?plan=team');

      expect(new AutoFormFiller({ matchByName: true }).fillForm()).toBe(false);
    });

    it('never fills password or file fields', () => {
      render('<form><input type="password" name="password"><input type="file" name="avatar"></form>');
      setLocation('https://example.com/?password=hunter2&avatar=x');

      expect(new AutoFormFiller({ matchByName: true }).fillForm()).toBe(false);
      expect(field('[name="password"]').value).toBe('');
    });

    it('never fills a password field through a mapping either', () => {
      render('<form><input type="password" id="pw"></form>');
      setLocation('https://example.com/?pw=hunter2');

      expect(new AutoFormFiller({ fieldMappings: { pw: '#pw' } }).fillForm()).toBe(false);
      expect(field('#pw').value).toBe('');
    });
  });

  describe('cleanUrl', () => {
    it('removes the parameters that filled a field and keeps the rest', () => {
      render('<form><input name="email"></form>');
      setLocation('https://example.com/signup?email=a%40b.c&ref=hn#top');
      const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      new AutoFormFiller({ cleanUrl: true }).fillForm();

      expect(field('input').value).toBe('a@b.c');
      expect(replaceState).toHaveBeenCalledWith(window.history.state, '', '/signup?ref=hn#top');
    });

    it('leaves the URL alone when it is off', () => {
      render('<form><input name="email"></form>');
      setLocation('https://example.com/signup?email=a%40b.c');
      const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      new AutoFormFiller().fillForm();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('keeps parameters that were skipped', () => {
      render('<form><select name="role"><option value="dev">Dev</option></select></form>');
      setLocation('https://example.com/?role=ceo');
      const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      new AutoFormFiller({ cleanUrl: true, matchByName: true }).fillForm();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('removes the prefixed name when a prefix is set', () => {
      render('<form><input name="email"></form>');
      setLocation('https://example.com/?ff_email=a%40b.c&page=2');
      const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      new AutoFormFiller({ cleanUrl: true, prefix: 'ff_' }).fillForm();
      expect(replaceState).toHaveBeenCalledWith(window.history.state, '', '/?page=2');
    });
  });

  describe('persist', () => {
    it('remembers matching parameters and fills them on a later page', () => {
      document.body.innerHTML = '<p>Blog post</p>';
      setLocation('https://example.com/blog?utm_source=newsletter&utm_campaign=spring&q=forms');
      expect(new AutoFormFiller({ persist: ['utm_*'] }).fillForm()).toBe(false);

      const stored = JSON.parse(window.sessionStorage.getItem(PERSIST_STORAGE_KEY)!);
      expect(stored).toEqual({ utm_source: ['newsletter'], utm_campaign: ['spring'] });

      render('<form><input name="utm_source" type="hidden"><input name="utm_campaign" type="hidden"></form>');
      setLocation('https://example.com/signup');
      expect(new AutoFormFiller({ persist: ['utm_*'] }).fillForm()).toBe(true);
      expect(field('[name="utm_source"]').value).toBe('newsletter');
      expect(field('[name="utm_campaign"]').value).toBe('spring');
    });

    it('prefers a value in the current URL over a remembered one', () => {
      window.sessionStorage.setItem(PERSIST_STORAGE_KEY, JSON.stringify({ utm_source: ['old'] }));
      render('<form><input name="utm_source"></form>');
      setLocation('https://example.com/?utm_source=new');

      new AutoFormFiller({ persist: ['utm_*'] }).fillForm();
      expect(field('input').value).toBe('new');
    });

    it('ignores remembered values when persist is off', () => {
      window.sessionStorage.setItem(PERSIST_STORAGE_KEY, JSON.stringify({ utm_source: ['old'] }));
      render('<form><input name="utm_source"></form>');
      setLocation('https://example.com/');

      expect(new AutoFormFiller().fillForm()).toBe(false);
    });

    it('can use localStorage', () => {
      document.body.innerHTML = '';
      setLocation('https://example.com/?utm_medium=email');
      new AutoFormFiller({ persist: ['utm_medium'], persistStorage: 'local' }).fillForm();

      expect(JSON.parse(window.localStorage.getItem(PERSIST_STORAGE_KEY)!)).toEqual({ utm_medium: ['email'] });
      expect(window.sessionStorage.getItem(PERSIST_STORAGE_KEY)).toBeNull();
    });

    it('forgets remembered values with clearPersisted()', () => {
      setLocation('https://example.com/?utm_source=x');
      const filler = new AutoFormFiller({ persist: ['utm_*'] });
      filler.fillForm();
      filler.clearPersisted();

      expect(window.sessionStorage.getItem(PERSIST_STORAGE_KEY)).toBeNull();
    });

    it('ignores corrupted storage', () => {
      window.sessionStorage.setItem(PERSIST_STORAGE_KEY, '{not json');
      render('<form><input name="utm_source"></form>');
      setLocation('https://example.com/');
      const onError = jest.fn();

      expect(new AutoFormFiller({ persist: ['utm_*'], onError }).fillForm()).toBe(false);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('overwrite: false', () => {
    it('skips text fields that already have a value and fills empty ones', () => {
      render('<form><input name="email"><input name="firstname"></form>');
      field('[name="email"]').value = 'typed@me.com';
      setLocation('https://example.com/?email=a%40b.c&firstname=Ada');

      new AutoFormFiller({ overwrite: false }).fillForm();
      expect(field('[name="email"]').value).toBe('typed@me.com');
      expect(field('[name="firstname"]').value).toBe('Ada');
    });

    it('skips a select the visitor changed and fills one left at its default', () => {
      render(`<form>
        <select name="role"><option value="">Pick</option><option value="dev">Dev</option><option value="pm">PM</option></select>
        <select name="team"><option value="">Pick</option><option value="a">A</option></select>
      </form>`);
      field<HTMLSelectElement>('[name="role"]').value = 'pm';
      setLocation('https://example.com/?role=dev&team=a');

      new AutoFormFiller({ overwrite: false, matchByName: true }).fillForm();
      expect(field<HTMLSelectElement>('[name="role"]').value).toBe('pm');
      expect(field<HTMLSelectElement>('[name="team"]').value).toBe('a');
    });

    it('skips a checkbox the visitor changed', () => {
      render('<form><input type="checkbox" name="newsletter"></form>');
      field('input').checked = true;
      setLocation('https://example.com/?newsletter=no');

      new AutoFormFiller({ overwrite: false, matchByName: true }).fillForm();
      expect(field('input').checked).toBe(true);
    });

    it('overwrites by default', () => {
      render('<form><input name="email"></form>');
      field('input').value = 'typed@me.com';
      setLocation('https://example.com/?email=a%40b.c');

      new AutoFormFiller().fillForm();
      expect(field('input').value).toBe('a@b.c');
    });
  });

  describe('repeated parameters', () => {
    it('checks every checkbox in a group whose value is given', () => {
      render(`<form>
        <input type="checkbox" name="topics" value="design" checked>
        <input type="checkbox" name="topics" value="code">
        <input type="checkbox" name="topics" value="data">
      </form>`);
      setLocation('https://example.com/?topics=code&topics=data');
      const onBeforeSubmit = jest.fn().mockReturnValue(false);
      jest.useFakeTimers();

      new AutoFormFiller({ matchByName: true, autoSubmit: true, onBeforeSubmit }).fillForm();
      jest.advanceTimersByTime(1000);
      jest.useRealTimers();

      const checked = Array.from(document.querySelectorAll<HTMLInputElement>('input:checked')).map(i => i.value);
      expect(checked).toEqual(['code', 'data']);
      expect(onBeforeSubmit).toHaveBeenCalledWith(expect.anything(), { topics: 'code,data' });
    });

    it('skips a checkbox group when no value matches', () => {
      render(`<form>
        <input type="checkbox" name="topics" value="design" checked>
        <input type="checkbox" name="topics" value="code">
      </form>`);
      setLocation('https://example.com/?topics=music');

      expect(new AutoFormFiller({ matchByName: true }).fillForm()).toBe(false);
      expect(field('[value="design"]').checked).toBe(true);
    });

    it('selects every matching option in a multi-select', () => {
      render(`<form><select name="langs" multiple>
        <option value="js">JavaScript</option><option value="py">Python</option><option value="go">Go</option>
      </select></form>`);
      setLocation('https://example.com/?langs=js&langs=Go');

      new AutoFormFiller({ matchByName: true }).fillForm();
      const selected = Array.from(field<HTMLSelectElement>('select').selectedOptions).map(o => o.value);
      expect(selected).toEqual(['js', 'go']);
    });

    it('uses the last value for a single field', () => {
      render('<form><input name="email"></form>');
      setLocation('https://example.com/?email=first%40x.com&email=last%40x.com');

      new AutoFormFiller().fillForm();
      expect(field('input').value).toBe('last@x.com');
    });

    it('checks a single checkbox when the value matches its own value', () => {
      render('<form><input type="checkbox" name="terms" value="accepted"></form>');
      setLocation('https://example.com/?terms=accepted');

      expect(new AutoFormFiller({ matchByName: true }).fillForm()).toBe(true);
      expect(field('input').checked).toBe(true);
    });
  });

  describe('prefix', () => {
    it('only reads parameters with the prefix', () => {
      render('<form><input name="email"><input name="page"></form>');
      setLocation('https://example.com/?ff_email=a%40b.c&page=2&email=ignored%40x.com');

      new AutoFormFiller({ prefix: 'ff_', matchByName: true }).fillForm();
      expect(field('[name="email"]').value).toBe('a@b.c');
      expect(field('[name="page"]').value).toBe('');
    });
  });

  describe('transform', () => {
    it('changes values before filling', () => {
      render('<form><input name="email"><input name="phone"></form>');
      setLocation('https://example.com/?email=%20Ada%40Example.COM%20&phone=%2B1%20(555)%20010-0000');

      new AutoFormFiller({
        transform: {
          email: v => v.trim().toLowerCase(),
          phone: v => v.replace(/[^\d+]/g, '')
        }
      }).fillForm();
      expect(field('[name="email"]').value).toBe('ada@example.com');
      expect(field('[name="phone"]').value).toBe('+15550100000');
    });

    it('reports a transform that throws and still fills other fields', () => {
      render('<form><input name="email"><input name="firstname"></form>');
      setLocation('https://example.com/?email=x&firstname=Ada');
      const onError = jest.fn();

      new AutoFormFiller({
        onError,
        transform: { email: () => { throw new Error('bad email'); } }
      }).fillForm();
      expect(onError).toHaveBeenCalledWith(new Error('bad email'));
      expect(field('[name="email"]').value).toBe('');
      expect(field('[name="firstname"]').value).toBe('Ada');
    });
  });

  describe('allow', () => {
    it('only fills allowed parameters', () => {
      render('<form><input name="email"><input name="plan"><input name="utm_source"></form>');
      setLocation('https://example.com/?email=a%40b.c&plan=team&utm_source=x');

      new AutoFormFiller({ matchByName: true, allow: ['email', 'utm_*'] }).fillForm();
      expect(field('[name="email"]').value).toBe('a@b.c');
      expect(field('[name="utm_source"]').value).toBe('x');
      expect(field('[name="plan"]').value).toBe('');
    });

    it('does not remember parameters outside the allow list', () => {
      setLocation('https://example.com/?utm_source=x&utm_term=y');
      new AutoFormFiller({ persist: ['utm_*'], allow: ['utm_source'] }).fillForm();

      expect(JSON.parse(window.sessionStorage.getItem(PERSIST_STORAGE_KEY)!)).toEqual({ utm_source: ['x'] });
    });
  });
});

describe('buildPrefillUrl', () => {
  it('adds encoded values to an absolute URL, keeping its query and hash', () => {
    expect(buildPrefillUrl('https://example.com/signup?ref=hn#form', { email: 'ada@example.com', name: 'Ada Lovelace' }))
      .toBe('https://example.com/signup?ref=hn&email=ada%40example.com&name=Ada+Lovelace#form');
  });

  it('works with relative URLs', () => {
    expect(buildPrefillUrl('/signup', { plan: 'team' })).toBe('/signup?plan=team');
    expect(buildPrefillUrl('signup', { plan: 'team' })).toBe('signup?plan=team');
  });

  it('repeats arrays, stringifies numbers and booleans, and drops null', () => {
    expect(buildPrefillUrl('/s?plan=solo', { topics: ['code', 'data'], seats: 5, newsletter: true, plan: null }))
      .toBe('/s?topics=code&topics=data&seats=5&newsletter=true');
  });

  it('adds a prefix', () => {
    expect(buildPrefillUrl('/s', { email: 'a@b.c' }, { prefix: 'ff_' })).toBe('/s?ff_email=a%40b.c');
  });

  it('produces values the library reads back exactly', () => {
    const tricky = '100% off & free, "quoted" + more';
    const url = buildPrefillUrl('https://example.com/', { message: tricky });
    document.body.innerHTML = '<form><textarea name="message"></textarea></form>';
    Object.defineProperty(window, 'location', { value: { search: new URL(url).search }, writable: true });

    new AutoFormFiller({ matchByName: true }).fillForm();
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(tricky);
  });
});
