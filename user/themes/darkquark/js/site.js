var isTouch = window.DocumentTouch && document instanceof DocumentTouch;

function scrollHeader() {
    // Has scrolled class on header
    // var zvalue = $(document).scrollTop();
    // if ( zvalue > 75 )
    //     $("#header").addClass("scrolled");
    // else
    //     $("#header").removeClass("scrolled");
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
            scrollHeader(); // Replace this with your code.
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
// Responsive Menu
    $('#toggle').click(function () {
        $(this).toggleClass('active');
        $('#overlay').toggleClass('open');
        $('body').toggleClass('mobile-nav-open');
    });
    
    // Mobile Menu Links - ERST scrollen, DANN schließen
    $('.overlay-menu a').on('click', function(e) {
        var href = $(this).attr('href');
        
        if (href && href.startsWith('#')) {
            e.preventDefault();
            
            var target = $(href);
            
            if (target.length) {
                // ERST scrollen
                $('html, body').animate({
                    scrollTop: target.offset().top - 180
                }, 500, function() {
                    // DANN Menu schließen (nach dem Scrollen)
                    $('#toggle').removeClass('active');
                    $('#overlay').removeClass('open');
                    $('body').removeClass('mobile-nav-open');
                });
            }
        }
    });

    // Tree Menu
    $(".tree").treemenu({delay:300});
// Smooth Scroll für alle Anchor-Links mit Header-Offset
    $('a[href^="#"]').on('click', function(e) {
        var target = $(this.attr('href'));
        
        // Nur für anchor links (#...) und wenn Target existiert
        if (target.length && this.hash) {
            e.preventDefault();
            
            // Overlay schließen falls offen
            $('#toggle').removeClass('active');
            $('#overlay').removeClass('open');
            $('body').removeClass('mobile-nav-open');
            
            // Scroll mit Offset - Mobile 100px, Desktop 80px
            var header_offset = $(window).width() <= 840 ? 100 : 80;
            
            window.scroll({ 
                top: target.offset().top - header_offset, 
                left: 0, 
                behavior: 'smooth' 
            });
        }
    });
    
});
