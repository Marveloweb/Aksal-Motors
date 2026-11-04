// Aksal Motors: mobile menu and small helpers
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    var use = btn.querySelector('use');
    function setOpen(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (use) use.setAttribute('href', open ? '#i-close' : '#i-menu');
    }
    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // Mobile call bar: appears once the hero's own call button has scrolled away
  var bar = document.querySelector('.call-bar');
  var heroCall = document.querySelector('.hero-ctas .btn-red');
  if (bar && heroCall && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      bar.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(heroCall);
  } else if (bar) {
    bar.classList.add('show');
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
