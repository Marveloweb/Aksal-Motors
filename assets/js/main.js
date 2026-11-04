// Aksal Motors: logo intro, mobile menu, call bar and small helpers
(function () {
  var root = document.documentElement;

  // Logo intro: CSS plays and hides it on its own; this only adds skip + cleanup.
  var intro = document.getElementById('intro');
  if (intro && root.classList.contains('intro-on')) {
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      root.classList.remove('intro-on');
      intro.remove();
      document.removeEventListener('keydown', skip);
    }
    function skip() {
      if (finished) return;
      intro.classList.add('is-leaving');
      setTimeout(finish, 460);
    }
    intro.addEventListener('animationend', function (e) {
      if (e.target === intro) finish();
    });
    intro.addEventListener('click', skip);
    document.addEventListener('keydown', skip);
    setTimeout(finish, 3600); // safety net
  } else if (intro) {
    intro.remove();
  }

  // Mobile menu
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

  // Mobile call bar: shows after the hero's call button scrolls away,
  // and hides again once the red footer (with its own call button) is on screen.
  var bar = document.querySelector('.call-bar');
  var heroCall = document.querySelector('.hero-ctas .btn-red');
  var footer = document.querySelector('.footer');
  if (bar && heroCall && footer) {
    var ticking = false;
    function update() {
      ticking = false;
      var pastHero = heroCall.getBoundingClientRect().bottom < 0;
      var footerOn = footer.getBoundingClientRect().top < window.innerHeight - 40;
      bar.classList.toggle('show', pastHero && !footerOn);
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  } else if (bar) {
    bar.classList.add('show');
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
