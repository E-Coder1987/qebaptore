---
title: Qebaptore
process:
  markdown: true
  twig: true
cache_enable: false
---

{# =========================
   CSS
   ========================= #}
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="stylesheet" href="{{ url('user://assets/places/places.css') }}">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.carousel.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/assets/owl.theme.default.min.css">
<style>
/* Mobile: Notizen und Adresse untereinander erzwingen */
@media (max-width: 768px) {
  #places-list tbody tr td:nth-child(3) > div {
    display: block !important;
    width: 100% !important;
  }
  
  #places-list tbody tr td:nth-child(3) > div:first-child {
    font-weight: bold !important;
    margin-bottom: 4px !important;
  }
  
  #places-list tbody tr td:nth-child(3) > div:last-child {
    font-size: 12px !important;
    color: #666 !important;
  }
}

/* Scroll Padding f\u00fcr besseres Anchor-Scrolling */
html {
  scroll-padding-top: 70px;
}

/* Extra Margin f\u00fcr Sections damit Heading sichtbar bleibt */
section {
  scroll-margin-top: 70px;
}

/* Mobile Men\u00fc Overlay soll \u00fcber Map liegen */
#overlay {
  z-index: 10000 !important;
}

/* Leaflet Map z-index begrenzen */
#map {
  z-index: 1 !important;
  position: relative;
}

.leaflet-pane,
.leaflet-top,
.leaflet-bottom {
  z-index: 400 !important;
}
</style>
{# =========================
   JS
   ========================= #}
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="{{ url('user://assets/places/places.js') }}"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/OwlCarousel2/2.3.4/owl.carousel.min.js"></script>
<script>
  window.PLACES_API_BASE = "{{ base_url }}/visited-api";
  if (window.PLACES_API_BASE.startsWith("//")) {
    window.PLACES_API_BASE = "/" + window.PLACES_API_BASE.replace(/^\/+/, "");
  }
</script>

<section class="qebaptore-story" id="about-container">
  <h2 style="font-size: 2rem; font-weight: 700; text-align: center;">💡 Über Qebaptore</h2>
  <ul class="qebaptore-values">
    <li>
      Im Jahr 2012 haben sich Tuan, Khoa, Edi und David auf ein gemeinsames Bier getroffen – 
      daraus wurde allerdings schnell deutlich mehr als nur eines. 
      Die Treffen häuften sich, und bald einigte man sich auf den Donnerstag als fixen Termin – 
      unseren Jour fixe.
    </li>
    <li>
      Im Frühjahr 2013 ging's dann relativ spontan auf einen Trip in den Kosovo. 
      Dort haben wir uns in die Grilllokale verliebt, die auf Albanisch 
      „Qebaptore" heißen. 
      Der Name war zu gut, um ihn nicht gleich für unsere Donnerstagsrunde zu übernehmen – 
      und so war sie geboren: QEBAPTORE
    </li>
    <li>
      In den folgenden Jahren kamen dann noch Gregor, Balli, Michi, Christoph und Marian dazu.
    </li>
    <li>
      Voller Stolz können wir heute sagen: 
      Im Jahr fallen höchstens zwei Termine aus – etwa, wenn Weihnachten ungünstig liegt 
      oder wenn zufällig fast alle gleichzeitig im Urlaub sind.
    </li>
    <li>
      Qebaptore ist unser wöchentliches Treffen als Ventil für den stressigen Alltag, für die weltlichen Genüsse, für intensive Diskussionen und für testosterongesteuerten Schmäh.
    </li>
    <li>
      Wir suchen keine neuen Mitglieder – aber Gäste sind immer herzlich willkommen.
    </li>
    <li>
      In diesem Sinne: <strong><u><span class="tooltip-trigger">Mot, Hai, Ba... Yooohhh!<span class="tooltip-bubble">„một hai ba vô" bedeutet auf Vietnamesisch "eins, zwei, drei – los! (Prost!)" und wird meist als gemeinsamer Spruch zum Anstoßen mit Getränken verwendet.</span></span></u></strong>
    </li>
  </ul>
</section>

<style>
.tooltip-trigger {
  position: relative;
  cursor: help;
}

.tooltip-bubble {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: #fff;
  text-align: center;
  padding: 12px 16px;
  border-radius: 8px;
  width: 280px;
  font-size: 14px;
  line-height: 1.4;
  font-weight: normal;
  text-decoration: none;
  transition: opacity 0.3s, visibility 0.3s;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.tooltip-bubble::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -8px;
  border-width: 8px;
  border-style: solid;
  border-color: #333 transparent transparent transparent;
}

.tooltip-trigger:hover .tooltip-bubble {
  visibility: visible;
  opacity: 1;
}
</style>
<hr style="border: none; border-top: 1px solid #666; margin: 40px 0;">
<section id="members-container">
    {% include 'modular/crew.html.twig' with {'page': page.find('/_crew')} %}
</section>
<hr style="border: none; border-top: 1px solid #666; margin: 40px 0;">
<section id="gallery-section">
<h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 50px; text-align: center; margin-top: 2rem;">📸 Galerie</h2>
<div id="gallery-carousel" class="owl-carousel owl-theme">
  {% for image in list_images('user/pages/01.home/gallery') %}
    <div class="item">
      <img data-src="{{ base_url }}/user/pages/01.home/gallery/{{ image }}" 
           class="owl-lazy"
           alt="{{ image }}"
           style="width: 100%; height: 600px; object-fit: contain; background: #111; border-radius: 10px;">
    </div>
  {% endfor %}
</div>



{# =========================
   Galerie
   ========================= #}
<script>
function initGallery() {
  var $carousel = jQuery('#gallery-carousel');
  
  // Prüfen ob Carousel bereits initialisiert wurde
  if ($carousel.hasClass('owl-loaded')) {
    return;
  }
  
  $carousel.owlCarousel({
    items: 1,
    loop: true,
    autoplay: true,
    autoplayTimeout: 20000,
    autoplayHoverPause: true,  // Pausiert bei Hover
    nav: true,
    dots: false,
    margin: 1,
    smartSpeed: 450,
    navText: ['‹', '›'],
    lazyLoad: true,
    lazyLoadEager: 1
  });
  
  // Autoplay bei manuellem Klick stoppen und neu starten
  setTimeout(function() {
    jQuery('.owl-nav button').on('click', function(e) {
      e.stopImmediatePropagation();
      
      // Stoppe Autoplay
      $carousel.trigger('stop.owl.autoplay');
      
      // Starte Autoplay nach 1 Sekunde neu
      setTimeout(function() {
        $carousel.trigger('play.owl.autoplay', [20000]);
      }, 1000);
    });
  }, 100);
}

// Nur einmal initialisieren
if (document.readyDate === 'complete') {
  initGallery();
} else {
  window.addEventListener('load', initGallery, { once: true });
}
</script>
</section>
{# =========================
   VISITED PLACES
   ========================= #}
<hr style="border: none; border-top: 1px solid #666; margin: 40px 0;">

<section>
  <div id="places-app">
    <h2 id="visited-section" style="font-size: 2rem; font-weight: 700; margin-bottom: 50px; text-align: center;">🍺 Hangouts</h2>
    {% if grav.user.authenticated %}
      <div class="row">
        <div>
          <label>Ort suchen</label><br>
          <input id="q" type="text" placeholder="z.B. Stephansdom, Wien" autocomplete="off">
        </div>
        <div>
          <label>Datum</label><br>
          <input id="visited_at" type="date">
        </div>
        <div>
          <label>Name</label><br>
          <input id="custom_label" type="text" placeholder="z.B. Stephansdom">
        </div>
        <div>
          <label>Notiz</label><br>
          <input id="notes" type="text" placeholder="optional">
        </div>
        <div>
          <button id="save" type="button" disabled>Speichern</button>
        </div>
      </div>
      <div class="card">
        <b>Suchtreffer</b>
        <div id="hits" class="small">Noch keine Suche.</div>
      </div>
    {% endif %}
    
    <!-- IMMER SICHTBAR -->
    <div id="map"></div>
    <div class="card">
      <!-- Filter Section -->
      <div class="places-filter-row">
        <div>
          <label>Zeitraum filtern</label>
          <select id="places-filter-type">
            <option value="current">Aktuelles Jahr</option>
            <option value="all">Alle Daten</option>
            <option value="year">Nach Jahr</option>
            <option value="month">Nach Monat</option>
            <option value="custom">Benutzerdefiniert</option>
          </select>
        </div>
        
        <div id="places-year-input" style="display:none;">
          <label>Jahr</label>
          <select id="places-year"></select>
        </div>
        
        <div id="places-month-input" style="display:none;">
          <label>Monat</label>
          <select id="places-month"></select>
        </div>
        
        <div id="places-custom-inputs" style="display:none;">
          <div>
            <label>Von</label>
            <input type="date" id="places-date-from">
          </div>
          <div>
            <label>Bis</label>
            <input type="date" id="places-date-to">
          </div>
        </div>
      </div>
      
      <div class="row" style="justify-content:space-between; margin-top:1rem;">
        <button id="reload" type="button">Neu laden</button>
      </div>
      <div id="places-list" class="small">…</div>
    </div>
  </div>
</section>

<style>
  .places-filter-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-bottom: 1rem;
  }
  
  .places-filter-row > div {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .places-filter-row label {
    font-size: 14px;
    font-weight: 400;
  }
  
  .places-filter-row select,
  .places-filter-row input[type="date"] {
    padding: 10px 12px;
    border: 1px solid #ccc;
    border-radius: 10px;
    background: #fff;
    color: #000;
    font-size: 14px;
    min-width: 200px;
    font-family: inherit;
  }
  
  .places-filter-row select:hover,
  .places-filter-row input[type="date"]:hover {
    border-color: #999;
  }
  
  .places-filter-row select:focus,
  .places-filter-row input[type="date"]:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  #places-custom-inputs {
    display: none;
    flex-direction: row;
    gap: 12px;
  }
</style>
{# =========================
   STATISTICS SECTION
   ========================= #}
<link rel="stylesheet" href="{{ url('user://assets/places/places-stats.css') }}">
<script src="{{ url('user://assets/places/places-stats.js') }}"></script>
<hr style="border: none; border-top: 1px solid #666; margin: 40px 0;">

<section id="stats-container">
  <h2>📊 Statistiken</h2>
	<div id="stats-containers">  
	  <div class="stats-filters">
		<div class="stats-filter-row">
		  <div>
			<label>Zeitraum filtern</label>
			<select id="stats-filter-type">
			  <option value="top10">Top 10 (All-Time)</option>
			  <option value="all">Alle Daten</option>
			  <option value="year">Nach Jahr</option>
			  <option value="month">Nach Monat</option>
			  <option value="custom">Benutzerdefiniert</option>
			</select>
		  </div>
		  
		  <div id="stats-year-input" style="display:none;">
			<label>Jahr</label>
			<select id="stats-year"></select>
		  </div>
		  
		  <div id="stats-month-input" style="display:none;">
			<label>Monat</label>
			<select id="stats-month"></select>
		  </div>
		  
		  <div id="stats-custom-inputs" style="display:none;">
			<div>
			  <label>Von</label>
			  <input type="date" id="stats-date-from">
			</div>
			<div>
			  <label>Bis</label>
			  <input type="date" id="stats-date-to">
			</div>
		  </div>
		</div>
	  </div>
	  
	  <div class="stats-table-wrapper">
		<table id="stats-table-element">
		  <thead>
			<tr>
			  <th class="sortable" data-column="name">Ort</th>
			  <th class="sortable" data-column="visit_count">Besuche</th>
			  <th class="sortable" data-column="first_visit">Erster Besuch</th>
			  <th class="sortable" data-column="last_visit">Letzter Besuch</th>
			</tr>
		  </thead>
		  <tbody id="stats-table">
			<tr><td colspan="4" style="text-align:center;">Lade...</td></tr>
		  </tbody>
		</table>
	  </div>
	 </div>
</section>
<hr style="border: none; border-top: 1px solid #666; margin: 40px 0;">
<section id="projects-container">
        <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 50px; text-align: center;">🛠 Projekte</h2>
    <div>

        <h3 style="text-align: center;">You-Kidding.com</h3>
		<table>
			<tr>
			<td>
            <a href="https://you-kidding.com/" target="_new"><img src="{{ base_url }}/user/pages/01.home/yk_logo_weiss_lang.webp" alt="You-Kidding Logo" style="max-width: 300px; height: auto;"></a>
			</td>
			<td>
			</td>
			<td>
			</td>
			<td>
            <p>You-Kidding ist dein Blog für humorvolle Alltagsbeobachtungen und pointierte Analysen. Hier werden Situationen und Aussagen aufs Korn genommen, die jeder kennt – mal augenzwinkernd, mal mit einer Portion Grant. Die Beiträge unterhalten, regen zum Nachdenken an und bieten ein Ventil für kleine und große Alltagsfrustrationen.</p>
			</td>
			</tr>
		</table>
</section>
  
<script>
// Custom Smooth Scrolling mit korrektem Offset
document.addEventListener('DOMContentLoaded', function() {
function scrollToTarget(target, immediate) {
  if (!target) return;
  
  // Finde die parent Section
  let section = target;
  if (target.tagName !== 'SECTION') {
    section = target.closest('section');
  }
  if (!section) section = target;
  
  const headerHeight = 66; // Feste Höhe vom verkleinerten Header
  
  const targetPosition = section.offsetTop;
  const offsetPosition = targetPosition - headerHeight - 80;

  window.scrollTo({
    top: offsetPosition,
    behavior: immediate ? 'auto' : 'smooth'
  });
}
  
  // Pr\u00fcfe ob URL einen Hash enth\u00e4lt (z.B. von anderer Seite kommend)
  if (window.location.hash) {
    setTimeout(function() {
      const targetId = window.location.hash.replace('#', '');
      const target = document.getElementById(targetId);
      if (target) {
        scrollToTarget(target, false);
      }
    }, 100); // Kurze Verz\u00f6gerung damit Seite vollst\u00e4ndig geladen ist
  }
  
  // Smooth Scrolling f\u00fcr Anchor-Links
  document.querySelectorAll('a[href*="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      
      // Wenn Link /home#anchor enth\u00e4lt
      if (href.includes('/home#')) {
        const currentPath = window.location.pathname;
        const hash = href.split('#')[1];
        
        // Wenn wir NICHT auf /home sind, lass Browser normal navigieren
        if (!currentPath.includes('/home') && currentPath !== '/') {
          return; // Browser l\u00e4dt Seite normal
        }
        
        // Wir sind auf /home, also smooth scroll
        e.preventDefault();
        const target = document.getElementById(hash);
        if (target) {
          const toggle = document.getElementById('toggle');
          const overlay = document.getElementById('overlay');
          if (toggle && overlay && overlay.classList.contains('open')) {
            toggle.click();
          }
          setTimeout(function() {
            scrollToTarget(target, false);
          }, toggle && overlay && overlay.classList.contains('open') ? 300 : 0);
        }
        return;
      }
      
      // Normale #anchor Links (nur auf aktueller Seite)
      if (href.startsWith('#')) {
        e.preventDefault();
        const targetId = href.replace('#', '');
        const target = document.getElementById(targetId);

        if (target) {
          const toggle = document.getElementById('toggle');
          const overlay = document.getElementById('overlay');
          if (toggle && overlay && overlay.classList.contains('open')) {
            toggle.click();
          }
          setTimeout(function() {
            scrollToTarget(target, false);
          }, toggle && overlay && overlay.classList.contains('open') ? 400 : 100);
        }
      }
    });
  });
  
  // Schlie\u00dfe Mobile-Men\u00fc bei JEDEM Link-Klick im Overlay
  document.querySelectorAll('.overlay-menu a, .mobile-quick-links a').forEach(link => {
    link.addEventListener('click', function() {
      const toggle = document.getElementById('toggle');
      const overlay = document.getElementById('overlay');
      
      // Warte kurz, dann schlie\u00dfe das Men\u00fc
      setTimeout(function() {
        if (toggle && overlay && overlay.classList.contains('open')) {
          toggle.click();
        }
      }, 100);
    });
  });
});
</script>