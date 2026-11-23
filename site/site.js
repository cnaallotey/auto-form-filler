// Shared behaviour: copy buttons on code blocks and on [data-copy] buttons.
(function () {
  function copyText(text, button) {
    const done = () => {
      const label = button.dataset.label || button.textContent;
      button.dataset.label = label;
      button.textContent = 'Copied';
      button.setAttribute('data-copied', '');
      window.setTimeout(() => {
        button.textContent = label;
        button.removeAttribute('data-copied');
      }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    } else {
      fallback(text, done);
    }
  }

  function fallback(text, done) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      area.remove();
    }
  }

  document.querySelectorAll('.code').forEach((block) => {
    const pre = block.querySelector('pre');
    if (!pre || block.querySelector('.copy')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code');
    button.addEventListener('click', () => copyText(pre.innerText.trimEnd(), button));
    block.appendChild(button);
  });

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.copy === 'location' ? window.location.href : button.dataset.copy;
      copyText(value, button);
    });
  });

  // Marks the link for the section currently in view in any [data-scrollspy] nav.
  document.querySelectorAll('[data-scrollspy]').forEach((nav) => {
    const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    const sections = links
      .map((link) => document.getElementById(link.hash.slice(1)))
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const visible = new Set();
    const setCurrent = (id) => {
      links.forEach((link) => {
        if (link.hash === '#' + id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      const first = sections.find((section) => visible.has(section.id));
      if (first) setCurrent(first.id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    sections.forEach((section) => observer.observe(section));
    setCurrent(sections[0].id);
  });

  window.copyText = copyText;
})();
