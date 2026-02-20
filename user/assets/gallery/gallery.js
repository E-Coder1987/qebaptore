/**
 * Modern Gallery with Swiper.js + PhotoSwipe
 * Features: Auto-scroll, thumbnails, lightbox, responsive
 */

(function() {
  'use strict';

  let mainSwiper = null;
  let thumbSwiper = null;
  let lightbox = null;
  let images = []; // built in setupLightbox, referenced in click/touch handlers

  function initGallery() {
    if (!document.getElementById('gallery-main')) {
      return;
    }

    // Tracks when the touchend handler last opened the lightbox so that
    // Swiper's onClick (which fires from the delayed synthetic click on
    // touch devices) does not double-open it.
    var lastTouchOpen = 0;

    // Initialize thumbnail swiper first
    thumbSwiper = new Swiper('#gallery-thumbs', {
      spaceBetween: 10,
      slidesPerView: 7,
      freeMode: true,
      watchSlidesProgress: true,
      centerInsufficientSlides: true,
      breakpoints: {
        320: {
          slidesPerView: 3,
          spaceBetween: 5
        },
        480: {
          slidesPerView: 4,
          spaceBetween: 8
        },
        768: {
          slidesPerView: 5,
          spaceBetween: 10
        },
        1024: {
          slidesPerView: 7,
          spaceBetween: 10
        }
      }
    });

    // Initialize main swiper
    mainSwiper = new Swiper('#gallery-main', {
      spaceBetween: 10,
      loop: true,
      watchSlidesProgress: true,
      observer: true,
      observeParents: true,
      autoplay: {
        delay: 10000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      },
      speed: 300,
      effect: 'fade',
      fadeEffect: {
        crossFade: true
      },
      navigation: {
        nextEl: '.gallery-button-next',
        prevEl: '.gallery-button-prev',
        disabledClass: 'swiper-button-disabled'
      },
      pagination: {
        el: '.gallery-pagination',
        type: 'fraction'
      },
      thumbs: {
        swiper: thumbSwiper
      },
      preloadImages: false,
      allowTouchMove: true,
      touchRatio: 1,
      touchAngle: 45,
      slideToClickedSlide: false,
      preventInteractionOnTransition: false,
      preventClicks: false,
      preventClicksPropagation: false,
      longSwipesMs: 300,
      on: {
        init: function() {
          updateActiveThumb(this.realIndex);
        },
        slideChange: function() {
          updateActiveThumb(this.realIndex);
        },
        // Desktop fallback: Swiper's onClick fires from the mouse click event.
        // On touch devices it may fire from the ~300ms synthetic click AFTER
        // the touchend handler below has already opened the lightbox — guard
        // against that with the lastTouchOpen timestamp.
        click: function(swiper, event) {
          if (Date.now() - lastTouchOpen < 800) return; // already handled by touchend
          if (event.target.closest('.gallery-button-next') ||
              event.target.closest('.gallery-button-prev') ||
              event.target.closest('.gallery-pagination')) {
            return;
          }
          if (!lightbox || !images.length) return;
          event.stopPropagation();
          lightbox.loadAndOpen(swiper.realIndex);
        }
      }
    });

    // ------------------------------------------------------------------
    // Touch/mobile: open the lightbox directly from the touchend event.
    //
    // Why: Swiper's onClick fires from the browser's ~300ms synthetic click
    // (not from touchend), which can reach PhotoSwipe's own document-level
    // capture-phase listeners even after stopPropagation().  By handling
    // taps in touchend we fire BEFORE the synthetic click, and calling
    // e.preventDefault() cancels that synthetic click entirely so PhotoSwipe
    // never receives an unexpected tap on its open backdrop.
    // ------------------------------------------------------------------
    var galleryEl = document.getElementById('gallery-main');
    var tapStart = null;

    galleryEl.addEventListener('touchstart', function(e) {
      tapStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }, { passive: true });

    galleryEl.addEventListener('touchend', function(e) {
      if (!tapStart) return;
      var touch = e.changedTouches[0];
      var dx = Math.abs(touch.clientX - tapStart.x);
      var dy = Math.abs(touch.clientY - tapStart.y);
      tapStart = null;

      console.log('[Gallery] touchend dx=' + dx + ' dy=' + dy + ' lightbox=' + !!lightbox + ' images=' + images.length);

      // Ignore swipe gestures — only react to stationary taps
      if (dx > 15 || dy > 15) return;

      // Ignore navigation controls and pagination
      if (touch.target.closest('.gallery-button-next') ||
          touch.target.closest('.gallery-button-prev') ||
          touch.target.closest('.gallery-pagination')) return;

      if (!lightbox || !images.length) {
        console.warn('[Gallery] cannot open: lightbox=' + !!lightbox + ' images=' + images.length);
        return;
      }

      var idx = mainSwiper.realIndex;
      console.log('[Gallery] opening index', idx, 'src:', images[idx] && images[idx].src);

      // Cancel the synthetic click that the browser fires ~300ms after
      // touchend so it cannot interact with the already-open PhotoSwipe.
      e.preventDefault();

      lastTouchOpen = Date.now();
      lightbox.loadAndOpen(idx);
    }, { passive: false });

    // Build images array and initialise PhotoSwipe after Swiper has fully rendered
    setTimeout(function() {
      setupLightbox();
    }, 300);
  }

  function updateActiveThumb(index) {
    // Highlight active thumbnail
    const thumbs = document.querySelectorAll('#gallery-thumbs .swiper-slide');
    thumbs.forEach((thumb, i) => {
      if (i === index) {
        thumb.classList.add('active-thumb');
      } else {
        thumb.classList.remove('active-thumb');
      }
    });

    // Scroll thumb swiper so the active thumb is always visible
    if (thumbSwiper && typeof thumbSwiper.slideTo === 'function') {
      thumbSwiper.slideTo(index, 300, false);
    }
  }

  function setupLightbox() {
    if (!document.getElementById('gallery-main')) return;

    // Check if PhotoSwipe is available; retry if scripts haven't loaded yet
    if (typeof window.PhotoSwipeLightbox === 'undefined' || typeof window.PhotoSwipe === 'undefined') {
      console.warn('PhotoSwipe not loaded. Retrying...');
      setTimeout(setupLightbox, 500);
      return;
    }

    // Build dataSource from real slides only (not Swiper loop clones)
    images = [];
    Array.from(document.querySelectorAll('#gallery-main .swiper-slide'))
      .filter(function(slide) {
        return !slide.classList.contains('swiper-slide-duplicate');
      })
      .forEach(function(slide) {
        const img = slide.querySelector('img');
        // data-display is set by the Twig template (reliable on all browsers);
        // fall back to the img src attribute or data-original if not present.
        const src = slide.dataset.display
          || (img && img.getAttribute('src'))
          || slide.dataset.original;

        if (src) {
          const w = (img && img.naturalWidth) || parseInt(slide.dataset.width) || 1920;
          const h = (img && img.naturalHeight) || parseInt(slide.dataset.height) || 1080;
          images.push({ src: src, width: w, height: h, alt: (img && img.alt) || '' });
        }
      });

    console.log('[Gallery] setupLightbox: built', images.length, 'images');
    if (images.length) console.log('[Gallery] first image src:', images[0].src, 'size:', images[0].width + 'x' + images[0].height);

    // Initialize PhotoSwipe lightbox
    lightbox = new window.PhotoSwipeLightbox({
      dataSource: images,
      pswpModule: window.PhotoSwipe,
      bgOpacity: 0.95,
      loop: true,
      padding: { top: 40, bottom: 40, left: 20, right: 20 },
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: false,
      closeOnBackdropClick: false,
      tapAction: 'none',
      doubleTapAction: 'zoom',
      showHideAnimationType: 'fade',
      errorMsg: 'Bild konnte nicht geladen werden'
    });

    lightbox.init();

    // Diagnostic: track PhotoSwipe lifecycle events
    lightbox.on('change', function() {
      console.log('[Gallery] pswp change → currIndex', lightbox.pswp && lightbox.pswp.currIndex);
    });
    lightbox.on('loadComplete', function(e, slide) {
      console.log('[Gallery] pswp loadComplete slide', slide && slide.index);
    });
    lightbox.on('loadError', function(e, slide) {
      console.warn('[Gallery] pswp loadError slide', slide && slide.index, slide && slide.data && slide.data.src);
    });

    // Workaround: if the browser defers load events (Edge lazy-image intervention),
    // PhotoSwipe's <img> stays at opacity:0 indefinitely. After a short delay, force
    // any opacity:0 PhotoSwipe image to be visible.
    lightbox.on('afterInit', function() {
      console.log('[Gallery] pswp afterInit opened');
      setTimeout(function() {
        var pswpEl = document.querySelector('.pswp');
        if (!pswpEl) return;
        var imgs = pswpEl.querySelectorAll('.pswp__img');
        imgs.forEach(function(img) {
          if (img.style.opacity === '0' || window.getComputedStyle(img).opacity === '0') {
            console.log('[Gallery] forcing opacity on img:', img.src);
            img.style.opacity = '1';
          }
        });
      }, 1000);
    });

    // Pause autoplay while lightbox is open
    lightbox.on('afterInit', function() {
      if (mainSwiper && mainSwiper.autoplay) {
        mainSwiper.autoplay.stop();
      }
    });

    lightbox.on('close', function() {
      if (mainSwiper && mainSwiper.autoplay) {
        mainSwiper.autoplay.start();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGallery);
  } else {
    initGallery();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (mainSwiper) mainSwiper.destroy(true, true);
    if (thumbSwiper) thumbSwiper.destroy(true, true);
    if (lightbox) lightbox.destroy();
  });

})();
