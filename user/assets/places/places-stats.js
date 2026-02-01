/* Visited Places Statistics */
(() => {
  const API_BASE = (window.PLACES_API_BASE || "/grav-admin/visited-api")
    .replace(/\/$/, "")
    .replace(/^\/\//, "/");

  const API_STATS_URL = `${API_BASE}?p=visited_stats`;

  const $ = (id) => document.getElementById(id);

  let currentStats = [];
  let allStats = []; // Speichert alle Daten für Top 10
  let currentSort = { column: 'visit_count', direction: 'desc' };

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]
    );
  }

  function formatDateDE(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
    const [y,m,d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function displayPlaceName(stat) {
    return (stat.custom_label || stat.label || "(ohne Titel)").trim();
  }

  async function loadStats(dateFrom = null, dateTo = null, topLimit = null) {
    const el = $("stats-table");
    if (!el) return;

    el.innerHTML = '<tr><td colspan="4" style="text-align:center;">Lade Statistiken...</td></tr>';

    let url = API_STATS_URL;
    const params = [];
    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);
    if (params.length) url += '&' + params.join('&');

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      el.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fehler beim Laden</td></tr>';
      return;
    }

    allStats = data.stats || [];
    
    // Wenn Top 10 Filter aktiv ist
    if (topLimit) {
      currentStats = [...allStats]
        .sort((a, b) => b.visit_count - a.visit_count)
        .slice(0, topLimit);
    } else {
      currentStats = allStats;
    }
    
    renderStatsTable();
  }

  function sortStats(column) {
    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort.column = column;
      currentSort.direction = column === 'visit_count' ? 'desc' : 'asc';
    }

    currentStats.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      // Für Ortsname custom_label oder label nehmen
      if (column === 'name') {
        valA = displayPlaceName(a).toLowerCase();
        valB = displayPlaceName(b).toLowerCase();
      }

      // Strings
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    renderStatsTable();
  }

  function renderStatsTable() {
    const el = $("stats-table");
    if (!el) return;

    if (!currentStats.length) {
      el.innerHTML = '<tr><td colspan="4" style="text-align:center;">Keine Daten für diesen Zeitraum</td></tr>';
      return;
    }

    // Update Header-Sortierung
    document.querySelectorAll('#stats-container th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.column === currentSort.column) {
        th.classList.add(`sort-${currentSort.direction}`);
      }
    });

    el.innerHTML = currentStats.map(stat => `
      <tr>
        <td>
          <a href="https://www.google.com/maps?q=${stat.lat},${stat.lng}" target="_blank">
            ${escapeHtml(displayPlaceName(stat))}
          </a>
        </td>
        <td style="text-align:center;font-weight:bold;font-size:16px;">${stat.visit_count}×</td>
        <td style="text-align:center;">${formatDateDE(stat.first_visit)}</td>
        <td style="text-align:center;">${formatDateDE(stat.last_visit)}</td>
      </tr>
    `).join('');
  }

  function applyFilter() {
    const filterType = $("stats-filter-type")?.value;
    let dateFrom = null;
    let dateTo = null;
    let topLimit = null;

    if (filterType === 'top10') {
      topLimit = 10;
    } else if (filterType === 'custom') {
      dateFrom = $("stats-date-from")?.value || null;
      dateTo = $("stats-date-to")?.value || null;
    } else if (filterType === 'month') {
      const month = $("stats-month")?.value;
      if (month) {
        const [year, monthNum] = month.split('-');
        dateFrom = `${year}-${monthNum}-01`;
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        dateTo = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (filterType === 'year') {
      const year = $("stats-year")?.value;
      if (year) {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }
    }

    loadStats(dateFrom, dateTo, topLimit);
  }

  function toggleFilterInputs() {
    const filterType = $("stats-filter-type")?.value;
    
    const customInputs = $("stats-custom-inputs");
    const monthInput = $("stats-month-input");
    const yearInput = $("stats-year-input");

    if (customInputs) customInputs.style.display = filterType === 'custom' ? 'flex' : 'none';
    if (monthInput) monthInput.style.display = filterType === 'month' ? 'block' : 'none';
    if (yearInput) yearInput.style.display = filterType === 'year' ? 'block' : 'none';
  }

  // Generiere Monat-Dropdown (letzte 24 Monate)
  function generateMonthOptions() {
    const select = $("stats-month");
    if (!select) return;

    const now = new Date();
    const options = [];

    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
      options.push(`<option value="${year}-${month}">${label}</option>`);
    }

    select.innerHTML = '<option value="">Monat wählen...</option>' + options.join('');
  }

  // Generiere Jahr-Dropdown (letzte 10 Jahre)
  function generateYearOptions() {
    const select = $("stats-year");
    if (!select) return;

    const currentYear = new Date().getFullYear();
    const options = [];

    for (let i = 0; i < 10; i++) {
      const year = currentYear - i;
      options.push(`<option value="${year}">${year}</option>`);
    }

    select.innerHTML = '<option value="">Jahr wählen...</option>' + options.join('');
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("stats-container")) return;

    generateMonthOptions();
    generateYearOptions();
    toggleFilterInputs();
    
    // Lade Top 10 als Standard
    loadStats(null, null, 10);

    // Event Listeners
    $("stats-filter-type")?.addEventListener("change", () => {
      toggleFilterInputs();
      applyFilter();
    });

    $("stats-date-from")?.addEventListener("change", applyFilter);
    $("stats-date-to")?.addEventListener("change", applyFilter);
    $("stats-month")?.addEventListener("change", applyFilter);
    $("stats-year")?.addEventListener("change", applyFilter);

    // Sortierung
    document.querySelectorAll('#stats-container th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        sortStats(th.dataset.column);
      });
    });
  });
})();