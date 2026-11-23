// Collapses the table of contents on small screens, and again after a link is chosen.
(function () {
  const details = document.querySelector('.toc-details');
  if (!details) return;
  const mobile = window.matchMedia('(max-width: 899px)');
  const sync = () => { details.open = !mobile.matches; };
  sync();
  mobile.addEventListener('change', sync);
  details.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (mobile.matches) details.open = false;
    });
  });
})();
