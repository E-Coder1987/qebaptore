/* Visited Places ñ OpenStreetMap + Leaflet + Index-API (?p=...)
 * - Liste + Map immer sichtbar (auch ausgeloggt)
 * - Suche + Speichern nur eingeloggt
 * - Inline-Editing
 * - Enter = Speichern / Esc = Abbrechen
 * - Filter nach Jahr/Monat/Zeitraum (wie Stats)
 */

(() => {
  /* ---------- API ---------- */

  const API_BASE = (window.PLACES_API_BASE || "/grav-admin/visited-api")
    .replace(/\/$/, "")
    .replace(/^\/\//, "/");

  const API_LIST_URL   = `${API_BASE}?p=visited_list`;
  const API_CREATE_URL = `${API_BASE}?p=visited_create`;
  const API_UPDATE_URL = `${API_BASE}?p=visited_update`;
  const API_DELETE_URL = `${API_BASE}?p=visited_delete`;

  const $ = (id) => document.getElementById(id);

  /* ---------- State ---------- */

  let map = null;
  let allMarkers = [];
  let selected = null;
  let searchTimer = null;
  let editingRow = null;
  let allPlaces = [];      // Alle geladenen Orte
  let filteredPlaces = []; // Gefilterte Orte

  /* ---------- Utils ---------- */

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]
    );
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateDE(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
    const [y,m,d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  async function safeJson(res) {
    const t = await res.text();
    try { return JSON.parse(t); }
    catch { return { ok:false, raw:t }; }
  }

  function displayPlaceName(it) {
    return (it.custom_label || it.label || "(ohne Titel)").trim();
  }

  function formatNominatimAddress(full) {
    const parts = String(full || "").split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length <= 3) return parts.join(", ");
    
    // Finde PLZ (4-5 Ziffern)
    const plzIndex = parts.findIndex(p => /^\d{4,5}$/.test(p));
    
    if (plzIndex === -1) {
      // Keine PLZ, zeige letzten 3-4 Teile
      return parts.slice(-4).join(", ");
    }
    
    // PLZ gefunden
    const plz = parts[plzIndex];
    const city = parts[plzIndex + 1] || "";
    const country = parts[parts.length - 1];
    
    // Suche Straﬂe und Hausnummer VOR der PLZ
    let street = null;
    let number = null;
    
    for (let i = 0; i < plzIndex; i++) {
      const p = parts[i];
      
      // Hausnummer (nur Ziffern/Bindestrich, kurz)
      if (/^[\d\-\/]+$/.test(p) && p.length <= 10) {
        number = p;
        // Straﬂe kommt meist direkt NACH Hausnummer
        if (i + 1 < plzIndex && !parts[i + 1].startsWith("KG ") && !parts[i + 1].startsWith("Bezirk ")) {
          street = parts[i + 1];
        }
      }
      // Stra\u00dfenname (enth\u00e4lt "stra\u00dfe", "gasse", "platz", "weg", etc.)
      else if (!street && /straﬂe|gasse|platz|weg|kai|ring|promenade/i.test(p)) {
        street = p;
      }
    }
    
    // Zusammenbauen
    let result = [];
    
    if (street && number) {
      result.push(`${street} ${number}`);
    } else if (street) {
      result.push(street);
    } else if (number) {
      // Nur Hausnummer (z.B. "38, Gr‰bern")
      const beforePlz = parts.slice(0, plzIndex).filter(p => !p.startsWith("KG ") && !p.startsWith("Bezirk "));
      result.push(beforePlz.join(" "));
    } else {
      // Kein Straﬂenname erkannt, nimm 1-2 Teile vor PLZ
      const beforePlz = parts.slice(Math.max(0, plzIndex - 2), plzIndex)
        .filter(p => !p.startsWith("KG ") && !p.startsWith("Bezirk "));
      if (beforePlz.length > 0) result.push(beforePlz.join(", "));
    }
    
    if (plz) result.push(plz);
    if (city && city !== country) result.push(city);
    if (country) result.push(country);
    
    return result.join(", ");
  }

  /* ---------- Filter Functions ---------- */

  // Generiere Monat-Dropdown (letzte 24 Monate)
  function generateMonthOptions() {
    const select = $("places-month");
    if (!select) return;

    const now = new Date();
    const options = [];

    for (let i = 0; i < 999; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
      options.push(`<option value="${year}-${month}">${label}</option>`);
    }

    select.innerHTML = '<option value="">Monat w\u00e4hlen...</option>' + options.join('');
  }

  // Generiere Jahr-Dropdown (letzte 10 Jahre)
  function generateYearOptions() {
    const select = $("places-year");
    if (!select) return;

    const currentYear = new Date().getFullYear();
    const options = [];

    for (let i = 0; i < 99; i++) {
      const year = currentYear - i;
      options.push(`<option value="${year}">${year}</option>`);
    }

    select.innerHTML = '<option value="">Jahr w\u00e4hlen...</option>' + options.join('');
  }

  function toggleFilterInputs() {
    const filterType = $("places-filter-type")?.value;
    
    const customInputs = $("places-custom-inputs");
    const monthInput = $("places-month-input");
    const yearInput = $("places-year-input");

    if (customInputs) customInputs.style.display = filterType === 'custom' ? 'flex' : 'none';
    if (monthInput) monthInput.style.display = filterType === 'month' ? 'block' : 'none';
    if (yearInput) yearInput.style.display = filterType === 'year' ? 'block' : 'none';
  }

  function getFilterDates() {
    const filterType = $("places-filter-type")?.value;
    let dateFrom = null;
    let dateTo = null;

    if (filterType === 'current') {
      const currentYear = new Date().getFullYear();
      dateFrom = `${currentYear}-01-01`;
      dateTo = `${currentYear}-12-31`;
    } else if (filterType === 'custom') {
      dateFrom = $("places-date-from")?.value || null;
      dateTo = $("places-date-to")?.value || null;
    } else if (filterType === 'month') {
      const month = $("places-month")?.value;
      if (month) {
        const [year, monthNum] = month.split('-');
        dateFrom = `${year}-${monthNum}-01`;
        const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
        dateTo = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (filterType === 'year') {
      const year = $("places-year")?.value;
      if (year) {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }
    }
    // 'all' bleibt null/null

    return { dateFrom, dateTo };
  }

  function filterPlacesByDate(places, dateFrom, dateTo) {
    if (!dateFrom && !dateTo) {
      return places;
    }

    return places.filter(place => {
      if (!place.visited_at) return false;

      const visitDate = place.visited_at;
      
      if (dateFrom && visitDate < dateFrom) return false;
      if (dateTo && visitDate > dateTo) return false;
      
      return true;
    });
  }

  function applyFilter() {
    const { dateFrom, dateTo } = getFilterDates();
    filteredPlaces = filterPlacesByDate(allPlaces, dateFrom, dateTo);
    
    // Update Liste
    renderList(filteredPlaces);
    
    // Update Map
    renderMarkers(filteredPlaces);
  }

  /* ---------- Map ---------- */

  function initMap() {
    if (map || !$("map") || typeof L === "undefined") return;

    map = L.map("map", {
      center: [48.2082, 16.3738], // Wien
      zoom: 12,                  // Start-Zoom
      minZoom: 0,
      maxZoom: 19,
      worldCopyJump: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
  }

  function renderMarkers(items) {
    if (!map) return;

    allMarkers.forEach(m => map.removeLayer(m));
    allMarkers = [];

    const boundsVienna = L.latLngBounds([]);

    items.forEach(it => {
      const lat = +it.lat;
      const lng = +it.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const marker = L.marker([lat, lng]).addTo(map);
      
      // Popup mit Google Maps Link, visited_at und Adresse
      const popupContent = `
        <div style="min-width:200px;">
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size:14px;font-weight:bold;color:#1a73e8;text-decoration:none;">
            ${escapeHtml(displayPlaceName(it))}
          </a><br>
          <small style="color:#666;">Letzter Besuch: ${formatDateDE(it.visited_at)}</small><br>
          <small style="color:#888;">${escapeHtml(formatNominatimAddress(it.address))}</small>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      
      allMarkers.push(marker);

      // Nur Marker im Wien-Umkreis z\u00e4hlen
      if (
        lat > 47.9 && lat < 48.5 &&   // Nord/S\u00fcd
        lng > 16.1 && lng < 16.6      // West/Ost
      ) {
        boundsVienna.extend([lat, lng]);
      }
    });

    // Fokus setzen
    if (boundsVienna.isValid()) {
      map.fitBounds(boundsVienna, {
        padding: [40, 40],
        maxZoom: 13
      });
    } else {
      map.setView([48.2082, 16.3738], 12);
    }
  }

  /* ---------- OSM Search ---------- */

  async function searchOSM(q) {
    if (!$("hits")) return;

    $("hits").textContent = "Suche...";

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=de&q=${encodeURIComponent(q)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!res.ok) {
      $("hits").textContent = "Suche fehlgeschlagen.";
      return;
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      $("hits").textContent = "Keine Treffer.";
      return;
    }

    $("hits").innerHTML = "";

    data.forEach(d => {
      const label = (d.display_name || q).split(",")[0];
      const address = d.display_name || "";

      const btn = document.createElement("button");
      btn.innerHTML = `
        <b>${escapeHtml(label)}</b>
        <div class="small">${escapeHtml(formatNominatimAddress(address))}</div>
      `;

      btn.onclick = () => {
        selected = {
          label,
          lat: Number(d.lat),
          lng: Number(d.lon),
          address,
          osm_type: d.osm_type || null,
          osm_id: d.osm_id || null
        };

        if ($("custom_label")) $("custom_label").value = label;
        if ($("save")) $("save").disabled = false;
      };

      $("hits").appendChild(btn);
    });
  }

  /* ---------- Create ---------- */

  async function savePlace() {
    if (
      !selected ||
      !Number.isFinite(selected.lat) ||
      !Number.isFinite(selected.lng) ||
      !selected.label
    ) {
      alert("Bitte zuerst einen Ort aus der Suche ausw‰hlen.");
      return;
    }

    const visitedAt = $("visited_at")?.value;
    if (!visitedAt) {
      alert("Datum fehlt.");
      return;
    }

    const payload = {
      visited_at: visitedAt,
      label: selected.label,
      custom_label: $("custom_label")?.value?.trim() || selected.label,
      lat: selected.lat,
      lng: selected.lng,
      address: selected.address || "",
      osm_type: selected.osm_type || null,
      osm_id: selected.osm_id || null,
      notes: $("notes")?.value?.trim() || ""
    };

    const r = await fetch(API_CREATE_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", Accept:"application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const o = await safeJson(r);
    if (!r.ok || !o.ok) {
      console.error("CREATE failed", r.status, o);
      alert("Speichern fehlgeschlagen");
      return;
    }

    selected = null;
    if ($("save")) $("save").disabled = true;
    if ($("notes")) $("notes").value = "";
    if ($("custom_label")) $("custom_label").value = "";
    if ($("q")) $("q").value = "";
    if ($("hits")) $("hits").innerHTML = "";

    loadList();
  }

  /* ---------- Inline Edit ---------- */

  function enterEditMode(tr, it) {
    if (editingRow) loadList();
    editingRow = tr;

    tr.classList.add("is-editing");
    tr.innerHTML = "";

    const mk = (t) => document.createElement(t);

    const tdDate = mk("td");
    const d = mk("input");
    d.type = "date";
    d.value = it.visited_at || "";
    tdDate.appendChild(d);

    const tdName = mk("td");
    const n = mk("input");
    n.type = "text";
    n.value = displayPlaceName(it);
    tdName.appendChild(n);

    const tdNotes = mk("td");
    const no = mk("input");
    no.type = "text";
    no.value = it.notes || "";
    tdNotes.appendChild(no);

    const tdAct = mk("td");
    const bSave = mk("button");
    bSave.textContent = "Speichern";
    const bCancel = mk("button");
    bCancel.textContent = "Abbrechen";

    async function save() {
      const r = await fetch(API_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type":"application/json", Accept:"application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: it.id,
          visited_at: d.value,
          custom_label: n.value.trim(),
          notes: no.value.trim()
        })
      });

      const o = await safeJson(r);
      if (!r.ok || !o.ok) {
        alert("Speichern fehlgeschlagen");
        return;
      }
      loadList();
    }

    function cancel() {
      loadList();
    }

    [d,n,no].forEach(inp => {
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
      });
    });

    bSave.onclick = save;
    bCancel.onclick = cancel;

    tdAct.append(bSave, bCancel);
    tr.append(tdDate, tdName, tdNotes, tdAct);
  }

  /* ---------- List Rendering ---------- */

  function renderList(items) {
    const el = $("places-list");
    if (!el) return;

    if (!items.length) {
      el.textContent = "Keine Orte f\u00fcr diesen Zeitraum gefunden.";
      return;
    }

    const editorMode = !!$("save");

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    ["Datum","Ort","Notiz"].forEach(t => {
      const th = document.createElement("th");
      th.textContent = t;
      trh.appendChild(th);
    });

    if (editorMode) {
      const th = document.createElement("th");
      th.textContent = "Aktionen";
      trh.appendChild(th);
    }

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    items.forEach(it => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${formatDateDE(it.visited_at)}</td>
        <td>
          <a href="https://www.google.com/maps?q=${it.lat},${it.lng}" target="_blank">
            ${escapeHtml(displayPlaceName(it))} <span style="opacity:0.6">(${it.visit_count || 1})</span>
          </a>
        </td>
        <td>
          <div style="font-weight:bold;display:block;margin-bottom:4px">${escapeHtml(it.notes || "")}</div>
          <div style="display:block;font-size:12px;color:#666">${escapeHtml(formatNominatimAddress(it.address))}</div>
        </td>
      `;

      if (editorMode) {
        const td = document.createElement("td");

        const bEdit = document.createElement("button");
        bEdit.textContent = "Bearbeiten";
        bEdit.onclick = () => enterEditMode(tr, it);

        const bDel = document.createElement("button");
        bDel.textContent = "L\u00f6schen";
        bDel.onclick = async () => {
          if (!confirm("Eintrag wirklich l\u00f6schen?")) return;

          await fetch(API_DELETE_URL, {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ id: it.id })
          });

          loadList();
        };

        td.append(bEdit, bDel);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    el.innerHTML = "";
    el.appendChild(table);
  }

  /* ---------- List Loading ---------- */

  async function loadList() {
    editingRow = null;

    const el = $("places-list");
    if (!el) return;

    el.textContent = "Lade...";

    const r = await fetch(API_LIST_URL, { cache:"no-store" });
    const o = await safeJson(r);

    if (!r.ok || !o.ok) {
      el.textContent = "Fehler beim Laden";
      return;
    }

    allPlaces = o.items || [];
    
    // Filter anwenden
    applyFilter();
  }

  /* ---------- Boot ---------- */

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("places-app")) return;

    // Filter initialisieren
    generateMonthOptions();
    generateYearOptions();
    toggleFilterInputs();

    // Filter Event Listeners
    $("places-filter-type")?.addEventListener("change", () => {
      toggleFilterInputs();
      applyFilter();
    });

    $("places-date-from")?.addEventListener("change", applyFilter);
    $("places-date-to")?.addEventListener("change", applyFilter);
    $("places-month")?.addEventListener("change", applyFilter);
    $("places-year")?.addEventListener("change", applyFilter);

    initMap();
    loadList();

    $("reload")?.addEventListener("click", loadList);

    if ($("save") && $("q")) {
      $("visited_at").value = todayISO();
      $("save").disabled = true;
      $("save").addEventListener("click", savePlace);

      $("q").addEventListener("keydown", e => {
        if (e.key === "Escape") {
          if ($("hits")) $("hits").innerHTML = "";
          $("q").value = "";
          selected = null;
          if ($("save")) $("save").disabled = true;
          e.preventDefault();
          return;
        }

        if (e.key === "Enter") {
          if (selected) {
            savePlace();
            e.preventDefault();
          }
        }
      });

      $("q").addEventListener("input", () => {
        selected = null;
        if ($("save")) $("save").disabled = true;

        clearTimeout(searchTimer);
        const q = $("q").value.trim();
        if (q.length < 3) {
          if ($("hits")) $("hits").textContent = "Mindestens 3 Zeichen.";
          return;
        }
        searchTimer = setTimeout(() => searchOSM(q), 400);
      });
    }
  });
})();