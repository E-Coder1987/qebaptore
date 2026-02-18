/**
 * Modern Gallery with Swiper.js + PhotoSwipe
 * Features: Auto-scroll, thumbnails, lightbox, responsive
 */

(function() {
  'use strict';

  let mainSwiper = null;
  let thumbSwiper = null;
  let lightbox = null;
  let images = []; // built in setupLightbox, referenced in Swiper onClick

  function initGallery() {
    if (!document.getElementById('gallery-main')) {
      return;
    }

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
        // Use Swiper's own click callback — on mobile this fires from touchend,
        // not from the browser's synthetic click event, so there is no ghost-click
        // that would land on the PhotoSwipe backdrop and close the lightbox.
        click: function(swiper, event) {
          if (event.target.closest('.gallery-button-next') ||
              event.target.closest('.gallery-button-prev') ||
              event.target.closest('.gallery-pagination')) {
            return;
          }
          if (!lightbox || !images.length) return;
          // Stop propagation so the click doesn't reach PhotoSwipe's own document
          // listeners — without this, the controls (X, zoom, counter) can be
          // toggled/hidden immediately after opening.
          event.stopPropagation();
          lightbox.loadAndOpen(swiper.realIndex);
        }
      }
    });

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
