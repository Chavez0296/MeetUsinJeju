/* Meet Us in Jeju: intro envelope, scroll fades (sheets, letter, gallery photos), and photo lightbox. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touchFirst = window.matchMedia("(hover: none)").matches;
  var verb = touchFirst ? "Tap" : "Click";

  /* ---------- Intro: the envelope opens on its own; tap the card to enter ---------- */

  function initIntro() {
    var root = document.querySelector(".envelope");
    if (!root) return;

    var stage = root.querySelector(".envelope__stage");
    var video = root.querySelector(".envelope__video");
    var hint = root.querySelector(".envelope__hint");
    // waiting -> playing -> open. "closed" is the fallback when the browser
    // refuses to autoplay at all (e.g. iOS Low Power Mode): the guest taps to start.
    var state = "waiting";
    var autoplayTimer;

    function showCard() {
      if (state === "open") return;
      state = "open";
      root.classList.remove("is-playing");
      stage.setAttribute("aria-label", "Enter the website");
      hint.innerHTML = '<a class="envelope__enter" href="home.html"></a>';
      hint.firstChild.textContent = verb + " the card to enter";
    }

    // Without the animation (reduced motion, or the clip can't play) cross-fade
    // straight to the opened envelope instead.
    function showCardStill() {
      root.classList.add("is-open-still");
      showCard();
    }

    function enter() {
      root.classList.add("is-leaving");
      window.setTimeout(function () {
        window.location.href = "home.html";
      }, reduceMotion ? 0 : 700);
    }

    function play(withSound) {
      state = "playing";
      root.classList.add("is-playing");
      video.muted = !withSound;
      return video.play();
    }

    function waitForTap() {
      state = "closed";
      root.classList.remove("is-playing");
      hint.textContent = verb + " to open";
    }

    // Browsers only allow sound once the guest has interacted with the site, so
    // try with sound first and fall back to a muted autoplay.
    function autoplay() {
      if (state !== "waiting") return;
      play(true)
        .catch(function () { return play(false); })
        .catch(waitForTap);
    }

    video.addEventListener("ended", showCard);
    video.addEventListener("error", function () {
      if (state !== "open") showCardStill();
    });

    stage.addEventListener("click", function () {
      if (state === "waiting" || state === "closed") {
        window.clearTimeout(autoplayTimer);
        if (reduceMotion) {
          showCardStill();
          return;
        }
        play(true).catch(showCardStill);
      } else if (state === "open") {
        enter();
      }
    });

    // Coming back with the browser's back button restores this page from the
    // back/forward cache mid-fade; bring the card back into view.
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) root.classList.remove("is-leaving");
    });

    hint.textContent = "";
    if (reduceMotion) {
      waitForTap();
    } else {
      // A beat on the closed envelope before it opens.
      root.classList.add("is-playing");
      autoplayTimer = window.setTimeout(autoplay, 700);
    }
  }

  /* ---------- Home: each sheet fades in as the one above it fades out ---------- */

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function initSheets() {
    var sheets = Array.prototype.slice.call(document.querySelectorAll(".sheet"));
    if (!sheets.length) return;

    var header = document.querySelector(".site-header");
    var letter = document.querySelector(".letter");
    var photos = Array.prototype.slice.call(document.querySelectorAll(".gallery__item"));
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[href^="#"]'));
    var fades = !reduceMotion;
    var current = null;
    var ticking = false;

    if (fades) document.documentElement.classList.add("has-sheet-fades");

    function measureHeader() {
      document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
    }

    function update() {
      ticking = false;
      var top = header.offsetHeight; // the readable area starts below the pinned header
      var vh = window.innerHeight - top;
      var active = sheets[0];

      sheets.forEach(function (sheet) {
        var rect = sheet.getBoundingClientRect();
        if (rect.top <= top + vh * 0.4) active = sheet;
        if (!fades) return;
        // A sheet fades in while its top edge rises from the bottom of the screen
        // to 40% down, and fades out while its bottom edge rises from 60% down to
        // the header. At a break the two overlap, so one hands off to the next.
        var fadeIn = clamp01((top + vh * 0.95 - rect.top) / (vh * 0.55));
        var fadeOut = clamp01((rect.bottom - top - vh * 0.05) / (vh * 0.55));
        var t = Math.min(fadeIn, fadeOut);
        sheet.style.opacity = (t * t * (3 - 2 * t)).toFixed(3);
      });

      // The opening letter fades from the first bit of scroll, gone by the time its
      // last line (the signature) reaches the header, and returns on the way back up.
      if (fades && letter) {
        var letterRect = letter.getBoundingClientRect();
        var end = vh * 0.05;
        var fullDistance = letterRect.bottom + window.scrollY - top - end;
        var remaining = letterRect.bottom - top - end;
        letter.style.opacity = clamp01(fullDistance > 0 ? remaining / fullDistance : 1).toFixed(3);
      }

      // Gallery photos fade in as they rise from the bottom of the screen and fade
      // out as they approach the header, every time, in either scroll direction.
      // A small drift (rising into place, then on up) goes with the fade.
      if (fades) {
        photos.forEach(function (photo) {
          var rect = photo.getBoundingClientRect();
          if (rect.bottom < top - vh || rect.top > top + vh * 2) return; // far off screen
          var fadeIn = clamp01((top + vh - rect.top) / (vh * 0.25));
          var fadeOut = clamp01((rect.bottom - top) / (vh * 0.25));
          photo.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
          photo.style.transform = "translateY(" + ((1 - fadeIn) * 24 - (1 - fadeOut) * 24).toFixed(1) + "px)";
        });
      }

      if (active !== current) {
        current = active;
        document.body.setAttribute("data-sheet", active.id);
        navLinks.forEach(function (link) {
          if (link.getAttribute("href") === "#" + active.id) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    measureHeader();
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", function () {
      measureHeader();
      requestUpdate();
    });
    window.addEventListener("pageshow", requestUpdate);

    // The web fonts arrive after the first layout and change every sheet's height,
    // so a link straight to a section (e.g. "Go back" to #travel) can land short.
    // Re-land once they're in, unless the guest has already started scrolling.
    var target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && document.fonts && document.fonts.ready) {
      var userScrolled = false;
      var markScrolled = function () { userScrolled = true; };
      ["wheel", "touchstart", "keydown"].forEach(function (type) {
        window.addEventListener(type, markScrolled, { once: true, passive: true });
      });
      document.fonts.ready.then(function () {
        if (userScrolled) return;
        try {
          target.scrollIntoView({ behavior: "instant", block: "start" });
        } catch (err) {
          target.scrollIntoView(true);
        }
      });
    }
  }

  /* ---------- Gallery: lightbox ---------- */

  function initLightbox() {
    var dialog = document.querySelector(".lightbox");
    if (!dialog || typeof dialog.showModal !== "function") return; // links still open the photo

    var links = Array.prototype.slice.call(document.querySelectorAll(".gallery__button"));
    var image = dialog.querySelector(".lightbox__image");
    var current = 0;

    function show(index) {
      current = (index + links.length) % links.length;
      var link = links[current];
      image.src = link.getAttribute("href");
      image.alt = link.querySelector("img").alt;
    }

    links.forEach(function (link, index) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        show(index);
        dialog.showModal();
      });
    });

    dialog.querySelector(".lightbox__close").addEventListener("click", function () { dialog.close(); });
    dialog.querySelector(".lightbox__prev").addEventListener("click", function () { show(current - 1); });
    dialog.querySelector(".lightbox__next").addEventListener("click", function () { show(current + 1); });

    // A click on the backdrop (not the photo or a control) closes the viewer.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") show(current - 1);
      else if (event.key === "ArrowRight") show(current + 1);
    });

    var touchStartX = null;
    dialog.addEventListener("touchstart", function (event) {
      touchStartX = event.touches[0].clientX;
    }, { passive: true });
    dialog.addEventListener("touchend", function (event) {
      if (touchStartX === null) return;
      var dx = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    });

    dialog.addEventListener("close", function () {
      image.removeAttribute("src");
    });
  }

  initIntro();
  initSheets();
  initLightbox();
})();
