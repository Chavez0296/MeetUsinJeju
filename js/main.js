/* Meet Us in Jeju: intro envelope, text reveals, scroll fades (letter, gallery photos), and photo lightbox. */

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

  /* ---------- Text: each block rises into place as it scrolls into view ---------- */

  // The fade and rise themselves are CSS (.reveal in css/style.css). Each block
  // plays once, the first time it comes into view. Blocks that arrive together go
  // in reading order, a beat apart, so the opening letter writes itself in line
  // by line.
  function initReveals() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!blocks.length) return;
    document.documentElement.classList.add("has-reveals");

    function reveal(block) {
      block.classList.add("is-revealed");
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      blocks.forEach(reveal);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      var arriving = 0;
      // Entries come in the order the blocks were observed: document order.
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        entry.target.style.setProperty("--reveal-delay", Math.min(arriving++, 5) * 200 + "ms");
        reveal(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });

    blocks.forEach(function (block) { observer.observe(block); });
  }

  /* ---------- Scroll fades: the opening letter and the gallery photos ---------- */

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function initScrollFades() {
    var letter = document.querySelector(".letter");
    var photos = Array.prototype.slice.call(document.querySelectorAll(".gallery__item"));
    if (reduceMotion || (!letter && !photos.length)) return;

    var header = document.querySelector(".site-header");
    var ticking = false;

    document.documentElement.classList.add("has-scroll-fades");

    function update() {
      ticking = false;
      // The readable area starts below the pinned header. The header is
      // see-through, so fade-outs run on behind it to the top of the screen.
      var top = header ? header.offsetHeight : 0;
      var vh = window.innerHeight - top;

      // The opening letter fades from the first bit of scroll, gone by the time its
      // last line (the signature) slips behind the header to the top of the screen,
      // and returns on the way back up.
      if (letter) {
        var letterBottom = letter.getBoundingClientRect().bottom;
        var fullDistance = letterBottom + window.scrollY;
        letter.style.opacity = clamp01(fullDistance > 0 ? letterBottom / fullDistance : 1).toFixed(3);
      }

      // Gallery photos fade in as they rise from the bottom of the screen and fade
      // out as they pass behind the header, every time, in either scroll direction.
      // A small drift (rising into place, then on up) goes with the fade.
      photos.forEach(function (photo) {
        var rect = photo.getBoundingClientRect();
        if (rect.bottom < top - vh || rect.top > top + vh * 2) return; // far off screen
        var fadeIn = clamp01((top + vh - rect.top) / (vh * 0.25));
        var fadeOut = clamp01(rect.bottom / (top + vh * 0.25));
        photo.style.opacity = Math.min(fadeIn, fadeOut).toFixed(3);
        photo.style.transform = "translateY(" + ((1 - fadeIn) * 24 - (1 - fadeOut) * 24).toFixed(1) + "px)";
      });
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pageshow", requestUpdate);
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
  initReveals();
  initScrollFades();
  initLightbox();
})();
