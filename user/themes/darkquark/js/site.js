var isTouch = window.DocumentTouch && document instanceof DocumentTouch;

function scrollHeader() {
    // DEAKTIVIERT - Header soll nicht schrumpfen
}

function parallaxBackground() {
    $('.parallax').css('background-positionY', ($(window).scrollTop() * 0.3) + 'px');
}

jQuery(document).ready(function($){

    scrollHeader();

    // Scroll Events
    if (!isTouch){
        $(document).scroll(function() {
            scrollHeader();
            parallaxBackground();
        });
    };

    // Touch scroll
    $(document).on({
        'touchmove': function(e) {
            scrollHeader();
        }
    });

    //Smooth scroll to start
    $('#to-start').click(function(){
        var start_y = $('#start').position().top;
        var header_offset = 45;
        window.scroll({ top: start_y - header_offset, left: 0, behavior: 'smooth' });
        return false;
    });

    //Smooth scroll to top
    $('#to-top').click(function(){
        window.scroll({ top: 0, left: 0, behavior: 'smooth' });
        return false;
    });

    // Responsive Menu
    $('#toggle').click(function () {
        $(this).toggleClass('active');
        $('#overlay').toggleClass('open');
        $('body').toggleClass('mobile-nav-open');
    });

    // Tree Menu
    $(".tree").treemenu({delay:300});

});

// CUSTOM SCROLL - außerhalb von document.ready damit es NACH dem Inline-Script lädt
$(window).on('load', function() {
    // Überschreibe alle vorherigen Scroll-Handler
    $('a[href*="#"]').off('click');
    
    $('a[href*="#"]').on('click', function(e) {
        var href = $(this).attr('href');
        
        if (!href || href === '#') return;
        
        // Mobile Offset: 120px
        var isMobile = $(window).width() <= 840;
        var offset = isMobile ? 1220 : 80;
        
        if (href.startsWith('#')) {
            e.preventDefault();
            var target = $(href);
            
            if (target.length) {
                $('html, body').animate({
                    scrollTop: target.offset().top - offset
                }, 500);
            }
        }
    });
});