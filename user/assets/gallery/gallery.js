/**
 * Modern Gallery with Swiper.js + PhotoSwipe
 * Features: Auto-scroll, thumbnails, lightbox, responsive
 */

(function() {
  'use strict';

  let mainSwiper = null;
  let thumbSwiper = null;
  let lightbox = null;

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
      loopAdditionalSlides: 3,
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
        }
      }
    });

    // Initialize PhotoSwipe Lightbox - Simple approach
    // Wait a bit for Swiper to fully render in loop mode
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
  }

  function setupLightbox() {
    // Simple click-to-lightbox implementation
    const galleryContainer = document.getElementById('gallery-main');

    if (!galleryContainer) return;

    // Make slides look clickable
    const allSlides = document.querySelectorAll('#gallery-main .swiper-slide');
    allSlides.forEach(function(slide) {
      slide.style.cursor = 'pointer';
    });

    // Create data source from all slides
    const slides = document.querySelectorAll('#gallery-main .swiper-slide');
    const images = [];

    slides.forEach(function(slide) {
      const original = slide.dataset.original;
      const img = slide.querySelector('img');

      if (original) {
        images.push({
          src: original,
          width: parseInt(slide.dataset.width) || 1920,
          height: parseInt(slide.dataset.height) || 1080,
          alt: img ? img.alt : 'Gallery Image'
        });
      }
    });

    // Check if PhotoSwipe is available
    if (typeof window.PhotoSwipeLightbox === 'undefined' || typeof window.PhotoSwipe === 'undefined') {
      console.warn('PhotoSwipe not loaded. Retrying...');
      setTimeout(setupLightbox, 500);
      return;
    }

    console.log('PhotoSwipe loaded successfully!');

    // Initialize lightbox
    lightbox = new window.PhotoSwipeLightbox({
      dataSource: images,
      pswpModule: window.PhotoSwipe,
      bgOpacity: 0.95,
      loop: true,
      padding: { top: 40, bottom: 40, left: 20, right: 20 },
      wheelToZoom: true,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      tapAction: 'close',
      doubleTapAction: 'zoom'
    });

    lightbox.init();

    // Add click handlers to all slides
    galleryContainer.addEventListener('click', function(e) {
      // Check if clicked on a slide (not navigation buttons)
      const slide = e.target.closest('.swiper-slide');

      if (!slide) return;

      // Don't open if clicking on buttons
      if (e.target.closest('.gallery-button-next') ||
          e.target.closest('.gallery-button-prev') ||
          e.target.closest('.gallery-pagination')) {
        return;
      }

      // Get current slide index
      const currentIndex = mainSwiper ? mainSwiper.realIndex : 0;

      // Open lightbox at current image
      lightbox.loadAndOpen(currentIndex);
    });

    // Pause autoplay when lightbox opens
    lightbox.on('afterInit', function() {
      if (mainSwiper && mainSwiper.autoplay) {
        mainSwiper.autoplay.stop();
      }
    });

    // Resume autoplay when lightbox closes
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
  window.addEventListener('beforeunload', () => {
    if (mainSwiper) mainSwiper.destroy(true, true);
    if (thumbSwiper) thumbSwiper.destroy(true, true);
    if (lightbox) lightbox.destroy();
  });

})();
