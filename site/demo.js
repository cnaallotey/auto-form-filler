// Live demo: the query string in the URL bar becomes this page's real query
// string, and the actual library fills the form from it.
(function () {
  const lib = window.AutoFormFiller;
  const textarea = document.getElementById('query');
  const mirror = document.getElementById('query-mirror');
  const form = document.getElementById('demo-form');
  const status = document.getElementById('demo-status');
  const presets = Array.from(document.querySelectorAll('.preset'));
  if (!lib || !textarea || !form) return;

  const DEFAULT_KEYS = [
    'email', 'name', 'firstname', 'lastname', 'phone', 'company',
    'utm_source', 'utm_medium', 'utm_campaign'
  ];
  const EXTRA_MAPPINGS = {
    role: 'select[name="role"]',
    plan: 'input[name="plan"]',
    newsletter: 'input[name="newsletter"]'
  };
  const MAPPED = new Set(DEFAULT_KEYS.concat(Object.keys(EXTRA_MAPPINGS)));

  const filler = new lib.AutoFormFiller({
    formSelector: '#demo-form',
    fieldMappings: EXTRA_MAPPINGS,
    onError: (error) => console.warn(error)
  });

  let previousValues = snapshot();
  let typingTimer = null;

  function snapshot() {
    const values = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'radio') {
        if (el.checked) values[el.name] = el.value;
        else if (!(el.name in values)) values[el.name] = '';
      } else if (el.type === 'checkbox') {
        values[el.name] = el.checked ? 'on' : '';
      } else {
        values[el.name] = el.value;
      }
    });
    return values;
  }

  function decode(text) {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch (error) {
      return text;
    }
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function parse(raw) {
    if (!raw) return [];
    return raw.split('&').map((part) => {
      const i = part.indexOf('=');
      const rawKey = i < 0 ? part : part.slice(0, i);
      const rawValue = i < 0 ? '' : part.slice(i + 1);
      return { rawKey, rawValue, hasEquals: i >= 0, key: decode(rawKey), value: decode(rawValue) };
    });
  }

  function hasField(name) {
    return form.querySelector('[name="' + name.replace(/"/g, '\\"') + '"]') !== null;
  }

  function skipReason(key, value) {
    if (!hasField(key)) return 'this form has no field for it';
    if (key === 'plan') return 'there’s no “' + value + '” plan';
    if (key === 'newsletter') return '“' + value + '” isn’t yes or no';
    if (key === 'role') return 'no role matches “' + value + '”';
    return 'the value doesn’t fit the field';
  }

  function classify(params, changed) {
    // The library uses the last value when a key repeats.
    const lastIndex = {};
    params.forEach((p, i) => { lastIndex[p.key] = i; });
    return params.map((p, i) => {
      if (!p.key) return { state: 'none' };
      if (!MAPPED.has(p.key)) return { state: 'ignored', reason: 'no field is mapped to it' };
      if (lastIndex[p.key] !== i) return { state: 'ignored', reason: 'a later value replaces it' };
      if (changed.has(p.key)) return { state: 'filled' };
      return { state: 'skipped', reason: skipReason(p.key, p.value) };
    });
  }

  function renderMirror(params, results) {
    if (!params.length) {
      mirror.innerHTML = '​';
      return;
    }
    mirror.innerHTML = params.map((p, i) => {
      const state = results[i].state;
      const keyClass = state === 'ignored' ? 'q-key is-ignored' : 'q-key';
      const valueClass = state === 'filled' ? 'q-val is-filled' : state === 'skipped' ? 'q-val is-skipped' : 'q-val';
      let html = '<span class="' + keyClass + '">' + escapeHtml(p.rawKey) + '</span>';
      if (p.hasEquals) {
        html += '<span class="q-sep">=</span><span class="' + valueClass + '">' + escapeHtml(p.rawValue) + '</span>';
      }
      return html;
    }).join('<span class="q-sep">&amp;</span>') + '​';
  }

  function renderStatus(params, results) {
    const filled = [];
    const notes = [];
    params.forEach((p, i) => {
      const r = results[i];
      if (r.state === 'filled') filled.push(p.key);
      else if (r.state === 'skipped' || r.state === 'ignored') {
        notes.push({ cls: r.state === 'skipped' ? 'is-skipped' : 'is-ignored', key: p.key, verb: r.state === 'skipped' ? 'Skipped' : 'Ignored', reason: r.reason });
      }
    });

    const items = [];
    if (!params.length) {
      items.push('<li>The link has no query string, so nothing is filled. Pick an example or type one, like <code>firstname=Ada</code>.</li>');
    } else if (filled.length) {
      items.push('<li class="is-filled">Filled <strong>' + filled.map(escapeHtml).join(', ') + '</strong>.</li>');
    } else {
      items.push('<li>Nothing was filled.</li>');
    }
    notes.forEach((n) => {
      items.push('<li class="' + n.cls + '">' + n.verb + ' <strong>' + escapeHtml(n.key) + '</strong>: ' + escapeHtml(n.reason) + '.</li>');
    });
    status.innerHTML = items.join('');
  }

  function flashChanged(next) {
    Object.keys(next).forEach((name) => {
      if (next[name] === previousValues[name] || !next[name]) return;
      const el = form.querySelector('[name="' + name + '"]');
      const field = el && el.closest('.field');
      if (!field) return;
      field.classList.remove('flash');
      void field.offsetWidth;
      field.classList.add('flash');
    });
    previousValues = next;
  }

  function apply(raw) {
    const query = raw.replace(/^\?/, '');
    const url = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
    window.history.replaceState(null, '', url);

    form.reset();
    const changed = new Set();
    const onChange = (event) => changed.add(event.target.name);
    form.addEventListener('change', onChange);
    if (query) filler.fillForm();
    form.removeEventListener('change', onChange);

    const params = parse(query);
    const results = classify(params, changed);
    renderMirror(params, results);
    renderStatus(params, results);
    flashChanged(snapshot());

    presets.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.query === query)));
    form.dispatchEvent(new CustomEvent('demo:update'));
  }

  function normalizeInput(value) {
    let text = value.replace(/[\r\n]+/g, '');
    const q = text.indexOf('?');
    if (/^https?:\/\//i.test(text) && q >= 0) text = text.slice(q + 1);
    return text.replace(/^\?/, '').replace(/#.*$/, '');
  }

  function setQuery(value) {
    textarea.value = value;
    apply(value);
  }

  function stopTyping() {
    if (typingTimer !== null) {
      window.clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function typeOut(text) {
    let i = 0;
    const step = () => {
      i += 1;
      setQuery(text.slice(0, i));
      typingTimer = i < text.length ? window.setTimeout(step, 22) : null;
    };
    step();
  }

  textarea.addEventListener('keydown', (event) => {
    stopTyping();
    if (event.key === 'Enter') event.preventDefault();
  });

  textarea.addEventListener('pointerdown', stopTyping);

  textarea.addEventListener('input', () => {
    stopTyping();
    const clean = normalizeInput(textarea.value);
    if (clean !== textarea.value) {
      const caret = textarea.selectionStart - (textarea.value.length - clean.length);
      textarea.value = clean;
      textarea.setSelectionRange(Math.max(caret, 0), Math.max(caret, 0));
    }
    apply(clean);
  });

  presets.forEach((button) => {
    button.addEventListener('click', () => {
      stopTyping();
      setQuery(button.dataset.query);
    });
  });

  // Someone opened a shared demo link: show what it fills.
  const initial = window.location.search.replace(/^\?/, '');
  if (initial) {
    setQuery(initial);
    return;
  }

  const first = presets[0].dataset.query;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || document.hidden) {
    setQuery(first);
  } else {
    apply('');
    typingTimer = window.setTimeout(() => typeOut(first), 500);
  }
})();
