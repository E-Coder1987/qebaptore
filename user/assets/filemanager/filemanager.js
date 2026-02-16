/* Gallery Filemanager - Frontend */

(function() {
  const API_BASE = '/grav-admin/gallery-manager';

  const $ = function(id) { return document.getElementById(id); };

  let isLoggedIn = false;
  let currentImages = [];
  let skipAllDuplicates = false;

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
  }

  // MD5 Hash computation
  async function computeFileMD5(file) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const buffer = e.target.result;
          const hashBuffer = await crypto.subtle.digest('MD5', buffer).catch(function() {
            // Fallback: simple hash for browsers without MD5 support
            const array = new Uint8Array(buffer);
            let hash = 0;
            for (let i = 0; i < array.length; i++) {
              hash = ((hash << 5) - hash) + array[i];
              hash = hash & hash;
            }
            return hash.toString(16);
          });

          if (typeof hashBuffer === 'string') {
            resolve(hashBuffer);
          } else {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
            resolve(hashHex);
          }
        } catch (err) {
          // Simple fallback hash
          resolve(Math.random().toString(36).substring(2));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Get image dimensions
  async function getImageDimensions(file) {
    return new Promise(function(resolve) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = function() {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = function() {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };

      img.src = url;
    });
  }

  // Compute perceptual hash (16x16 grayscale thumbnail)
  async function computePerceptualHash(file) {
    return new Promise(function(resolve) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext('2d');

          // Draw scaled image
          ctx.drawImage(img, 0, 0, 16, 16);

          // Get pixel data
          const imageData = ctx.getImageData(0, 0, 16, 16);
          const pixels = [];

          // Convert to grayscale
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const gray = Math.floor((r + g + b) / 3);
            pixels.push(gray);
          }

          // Calculate average
          const avg = pixels.reduce(function(a, b) { return a + b; }, 0) / pixels.length;

          // Create binary hash
          let hash = '';
          for (let i = 0; i < pixels.length; i++) {
            hash += (pixels[i] >= avg) ? '1' : '0';
          }

          // Convert binary to hex
          let hexHash = '';
          for (let i = 0; i < hash.length; i += 4) {
            const nibble = hash.substr(i, 4);
            hexHash += parseInt(nibble, 2).toString(16);
          }

          URL.revokeObjectURL(url);
          resolve(hexHash);
        } catch (err) {
          URL.revokeObjectURL(url);
          resolve('');
        }
      };

      img.onerror = function() {
        URL.revokeObjectURL(url);
        resolve('');
      };

      img.src = url;
    });
  }

  // Check if file is duplicate
  async function checkDuplicate(file) {
    try {
      const hash = await computeFileMD5(file);
      const dimensions = await getImageDimensions(file);
      const perceptualHash = await computePerceptualHash(file);

      const formData = new FormData();
      formData.append('action', 'check_duplicate');
      formData.append('file_hash', hash);
      formData.append('filesize', file.size);
      formData.append('width', dimensions.width);
      formData.append('height', dimensions.height);
      formData.append('perceptual_hash', perceptualHash);

      const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      return await res.json();
    } catch (err) {
      console.error('Duplikatprüfung fehlgeschlagen:', err);
      return { ok: false, is_duplicate: false };
    }
  }

  // Show duplicate warning modal
  function showDuplicateModal(file, matches) {
    return new Promise(function(resolve) {
      const match = matches[0];
      let matchType = 'Ähnlich (gleiche Größe)';
      if (match.match_level === 'exact') {
        matchType = 'Exakte Übereinstimmung';
      } else if (match.match_level === 'perceptual') {
        matchType = 'Gleiches Bild (unterschiedliche Größe)';
      }

      const modal = document.createElement('div');
      modal.className = 'duplicate-modal';
      modal.innerHTML = '<div class="duplicate-modal-content">' +
        '<h2>⚠️ Duplikat gefunden!</h2>' +
        '<p class="duplicate-match-type">' + matchType + ' (' + match.confidence + '%)</p>' +
        '<div class="duplicate-comparison">' +
          '<div class="duplicate-image">' +
            '<h3>Neue Datei</h3>' +
            '<img class="duplicate-preview" id="dup-new-preview" alt="Neue Datei">' +
            '<p>' + file.name + '</p>' +
            '<p>' + formatFileSize(file.size) + '</p>' +
          '</div>' +
          '<div class="duplicate-image">' +
            '<h3>Existiert bereits</h3>' +
            '<img class="duplicate-preview" src="' + match.url + '" alt="' + match.filename + '">' +
            '<p>' + match.filename + '</p>' +
            '<p>' + formatFileSize(match.size) + ' • ' + formatDate(match.modified) + '</p>' +
            '<p>' + match.dimensions + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="duplicate-actions">' +
          '<button class="fm-btn fm-btn-cancel">Abbrechen</button>' +
          '<button class="fm-btn fm-btn-skip-all">Alle Duplikate überspringen</button>' +
          '<button class="fm-btn fm-btn-upload">Trotzdem hochladen</button>' +
        '</div>' +
      '</div>';

      document.body.appendChild(modal);

      // Preview new file
      const reader = new FileReader();
      reader.onload = function(e) {
        $('dup-new-preview').src = e.target.result;
      };
      reader.readAsDataURL(file);

      modal.querySelector('.fm-btn-cancel').onclick = function() {
        document.body.removeChild(modal);
        resolve('cancel');
      };

      modal.querySelector('.fm-btn-skip-all').onclick = function() {
        skipAllDuplicates = true;
        document.body.removeChild(modal);
        resolve('skip_all');
      };

      modal.querySelector('.fm-btn-upload').onclick = function() {
        document.body.removeChild(modal);
        resolve('upload');
      };

      // Close on background click
      modal.onclick = function(e) {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve('cancel');
        }
      };
    });
  }

  async function loadImages() {
    try {
      const res = await fetch(API_BASE + '?action=list');
      const data = await res.json();
      
      if (data.ok) {
        currentImages = data.images;
        renderGallery();
        updateStats();
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      alert('Fehler beim Laden der Bilder');
    }
  }

  async function uploadFiles(files) {
    const uploadBtn = $('fm-upload-btn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Prüfe Duplikate...';

    skipAllDuplicates = false;
    const filesToUpload = [];

    // Check each file for duplicates
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      uploadBtn.textContent = '⏳ Prüfe ' + (i + 1) + '/' + files.length + '...';

      const result = await checkDuplicate(file);

      if (result.ok && result.is_duplicate && result.matches.length > 0) {
        if (skipAllDuplicates) {
          console.log('Überspringe Duplikat:', file.name);
          continue;
        }

        const decision = await showDuplicateModal(file, result.matches);

        if (decision === 'cancel' || decision === 'skip_all') {
          console.log('Überspringe:', file.name);
          continue;
        }
      }

      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📤 Upload';
      $('fm-file-input').value = '';
      return;
    }

    // Upload non-duplicate files
    const formData = new FormData();
    for (let i = 0; i < filesToUpload.length; i++) {
      formData.append('files[]', filesToUpload[i]);
    }
    formData.append('action', 'upload');

    uploadBtn.textContent = '⏳ Lade hoch...';

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      const data = await res.json();

      if (data.ok) {
        if (data.uploaded.length > 0) {
          alert('✓ ' + data.uploaded.length + ' Bild(er) hochgeladen');
        }
        if (data.errors.length > 0) {
          alert('⚠ Fehler:\n' + data.errors.join('\n'));
        }

        $('fm-file-input').value = '';
        loadImages();

        // Rebuild hash cache in background
        fetch(API_BASE + '?action=rebuild_hash_cache', {
          method: 'GET',
          credentials: 'same-origin'
        });
      }
    } catch (err) {
      console.error('Upload-Fehler:', err);
      alert('Upload fehlgeschlagen');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📤 Upload';
    }
  }

  async function deleteImage(filename) {
    if (!confirm('"' + filename + '" wirklich löschen?')) return;

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'action=delete&filename=' + encodeURIComponent(filename),
        credentials: 'same-origin'
      });

      const data = await res.json();
      
      if (data.ok) {
        loadImages();
      } else {
        alert('Löschen fehlgeschlagen: ' + data.error);
      }
    } catch (err) {
      console.error('Lösch-Fehler:', err);
      alert('Löschen fehlgeschlagen');
    }
  }
  
  async function rotateImage(filename, direction) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'action=rotate&filename=' + encodeURIComponent(filename) + '&direction=' + direction,
        credentials: 'same-origin'
      });

      const data = await res.json();
      
      if (data.ok) {
        // Force reload mit Verzögerung für Image-Processing
        setTimeout(function() {
          loadImages();
        }, 500);
      } else {
        alert('Rotation fehlgeschlagen: ' + data.error);
      }
    } catch (err) {
      console.error('Rotations-Fehler:', err);
      alert('Rotation fehlgeschlagen');
    }
  }

  async function renameImage(oldName) {
    const newName = prompt('Neuer Dateiname:', oldName);
    
    if (!newName || newName === oldName) return;

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'action=rename&old_name=' + encodeURIComponent(oldName) + '&new_name=' + encodeURIComponent(newName),
        credentials: 'same-origin'
      });

      const data = await res.json();
      
      if (data.ok) {
        loadImages();
      } else {
        alert('Umbenennen fehlgeschlagen: ' + data.error);
      }
    } catch (err) {
      console.error('Rename-Fehler:', err);
      alert('Umbenennen fehlgeschlagen');
    }
  }

  function updateStats() {
    const total = currentImages.length;
    const totalSize = currentImages.reduce(function(sum, img) { return sum + img.size; }, 0);
    
    $('fm-stats').textContent = total + ' Bild' + (total !== 1 ? 'er' : '') + ' • ' + formatFileSize(totalSize);
  }

  function renderGallery() {
    const gallery = $('fm-gallery');
    gallery.innerHTML = '';

    if (currentImages.length === 0) {
      gallery.innerHTML = '<p class="fm-empty">Keine Bilder vorhanden</p>';
      return;
    }

    currentImages.forEach(function(img) {
      const card = document.createElement('div');
      card.className = 'fm-card';
      
      card.innerHTML = '<div class="fm-card-img" style="background-image: url(\'' + img.url + '\')"></div>' +
        '<div class="fm-card-info">' +
          '<div class="fm-card-name" title="' + img.name + '">' + img.name + '</div>' +
          '<div class="fm-card-meta">' + formatFileSize(img.size) + ' • ' + formatDate(img.modified) + '</div>' +
        '</div>' +
        '<div class="fm-card-actions">' +
          '<button class="fm-btn-icon fm-btn-view" title="Ansehen">👁️</button>' +
          (isLoggedIn ? '<button class="fm-btn-icon fm-btn-rotate-left" title="Links drehen">↶</button>' : '') +
          (isLoggedIn ? '<button class="fm-btn-icon fm-btn-rotate-right" title="Rechts drehen">↷</button>' : '') +
          (isLoggedIn ? '<button class="fm-btn-icon fm-btn-rename" title="Umbenennen">✏️</button>' : '') +
          (isLoggedIn ? '<button class="fm-btn-icon fm-btn-delete" title="Löschen">🗑️</button>' : '') +
        '</div>';

      card.querySelector('.fm-btn-view').onclick = function() { openLightbox(img.url); };
      card.querySelector('.fm-card-img').onclick = function() { openLightbox(img.url); };

      if (isLoggedIn) {
        card.querySelector('.fm-btn-delete').onclick = function() { deleteImage(img.name); };
        card.querySelector('.fm-btn-rotate-left').onclick = function(e) { 
          e.stopPropagation(); 
          rotateImage(img.name, 'left'); 
        };
        card.querySelector('.fm-btn-rotate-right').onclick = function(e) { 
          e.stopPropagation(); 
          rotateImage(img.name, 'right'); 
        };
        card.querySelector('.fm-btn-rename').onclick = function(e) { 
          e.stopPropagation(); 
          renameImage(img.name); 
        };
      }

      gallery.appendChild(card);
    });
  }

  function openLightbox(url) {
    const lightbox = $('fm-lightbox');
    const img = lightbox.querySelector('.fm-lightbox-img');
    
    img.src = url;
    lightbox.style.display = 'flex';
  }

  function closeLightbox() {
    $('fm-lightbox').style.display = 'none';
  }

  async function rebuildCache() {
    const rebuildBtn = $('fm-rebuild-cache');
    if (rebuildBtn) {
      rebuildBtn.disabled = true;
      rebuildBtn.textContent = '⏳ Erstelle Cache...';
    }

    try {
      const res = await fetch(API_BASE + '?action=rebuild_hash_cache', {
        method: 'GET',
        credentials: 'same-origin'
      });

      const data = await res.json();

      if (data.ok) {
        alert('✓ Cache neu aufgebaut: ' + data.cached + ' Bilder in ' + data.duration_ms + 'ms');
        console.log('Cache rebuilt:', data);
      } else {
        alert('Cache-Aufbau fehlgeschlagen');
      }
    } catch (err) {
      console.error('Cache-Fehler:', err);
      alert('Cache-Aufbau fehlgeschlagen');
    } finally {
      if (rebuildBtn) {
        rebuildBtn.disabled = false;
        rebuildBtn.textContent = '⚙️ Cache neu aufbauen';
      }
    }
  }

  async function scanDuplicates() {
    const scanBtn = $('fm-scan-duplicates');
    scanBtn.disabled = true;
    scanBtn.textContent = '⏳ Baue Cache auf...';

    try {
      // First, rebuild cache to ensure it's up to date
      const cacheRes = await fetch(API_BASE + '?action=rebuild_hash_cache', {
        method: 'GET',
        credentials: 'same-origin'
      });

      const cacheData = await cacheRes.json();
      console.log('Cache rebuilt:', cacheData);

      scanBtn.textContent = '⏳ Scanne Duplikate...';

      // Then scan for duplicates
      const res = await fetch(API_BASE + '?action=scan_duplicates', {
        method: 'GET',
        credentials: 'same-origin'
      });

      const data = await res.json();
      console.log('Duplicate scan result:', data);

      if (data.ok) {
        showDuplicateResults(data);
      } else {
        alert('Scan fehlgeschlagen');
      }
    } catch (err) {
      console.error('Scan-Fehler:', err);
      alert('Scan fehlgeschlagen: ' + err.message);
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = '🔍 Duplikate suchen';
    }
  }

  function showDuplicateResults(data) {
    const panel = $('fm-duplicates-panel');
    panel.innerHTML = '';

    if (data.groups.length === 0) {
      panel.innerHTML = '<div class="duplicate-summary">' +
        '<h3>✓ Keine Duplikate gefunden</h3>' +
        '<p>Alle Bilder sind einzigartig!</p>' +
      '</div>';
      panel.style.display = 'block';
      return;
    }

    // Summary
    const summary = document.createElement('div');
    summary.className = 'duplicate-summary';
    summary.innerHTML = '<h3>⚠️ Duplikate gefunden</h3>' +
      '<p>' + data.total_duplicates + ' Duplikat(e) • ' + formatFileSize(data.space_wasted) + ' können gespart werden</p>' +
      '<button class="fm-btn fm-btn-delete-selected">Ausgewählte löschen (0)</button>';

    panel.appendChild(summary);

    // Groups
    data.groups.forEach(function(group, groupIndex) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'duplicate-group';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'duplicate-group-header';

      let matchLabel = '';
      if (group.match_type === 'exact') {
        matchLabel = 'Exakte Übereinstimmung';
      } else if (group.match_type === 'resized') {
        matchLabel = 'Gleiche Bilder (unterschiedliche Größen)';
      } else {
        matchLabel = 'Ähnlich (gleiche Größe & Dimensionen)';
      }

      groupHeader.innerHTML = '<h4>Gruppe ' + (groupIndex + 1) + ': ' +
        matchLabel + ' (' + group.images.length + ')</h4>' +
        '<div class="quick-actions">' +
          '<button class="fm-btn-small" data-action="largest">Größte behalten</button>' +
          '<button class="fm-btn-small" data-action="newest">Neueste behalten</button>' +
          '<button class="fm-btn-small" data-action="oldest">Älteste behalten</button>' +
          '<button class="fm-btn-small fm-btn-ignore" data-action="ignore">✓ Kein Duplikat</button>' +
        '</div>';

      const gridDiv = document.createElement('div');
      gridDiv.className = 'duplicate-grid';

      group.images.forEach(function(img) {
        const item = document.createElement('div');
        item.className = 'duplicate-item';
        item.innerHTML = '<input type="checkbox" class="dup-checkbox" data-filename="' + img.filename + '">' +
          '<div class="duplicate-item-img" style="background-image: url(\'' + img.url + '\')" title="Zum Vergleichen klicken"></div>' +
          '<div class="duplicate-item-info">' +
            '<div class="duplicate-item-name" title="' + img.filename + '">' + img.filename + '</div>' +
            '<div class="duplicate-item-meta">' + formatFileSize(img.size) + '</div>' +
            '<div class="duplicate-item-meta">' + formatDate(img.modified) + '</div>' +
            '<div class="duplicate-item-meta">' + img.dimensions + '</div>' +
          '</div>';

        // Add click handler to image for comparison
        const imgDiv = item.querySelector('.duplicate-item-img');
        imgDiv.style.cursor = 'pointer';
        imgDiv.onclick = function(e) {
          e.stopPropagation();
          showComparisonModal(group.images);
        };

        gridDiv.appendChild(item);
      });

      groupDiv.appendChild(groupHeader);
      groupDiv.appendChild(gridDiv);
      panel.appendChild(groupDiv);

      // Quick action handlers
      const actions = groupHeader.querySelector('.quick-actions');
      actions.querySelector('[data-action="largest"]').onclick = function() {
        selectLargest(gridDiv, group.images);
      };
      actions.querySelector('[data-action="newest"]').onclick = function() {
        selectNewest(gridDiv, group.images);
      };
      actions.querySelector('[data-action="oldest"]').onclick = function() {
        selectOldest(gridDiv, group.images);
      };
      actions.querySelector('[data-action="ignore"]').onclick = function() {
        ignoreDuplicateGroup(group.images, groupDiv);
      };
    });

    panel.style.display = 'block';

    // Update delete button count
    panel.addEventListener('change', updateDeleteButtonCount);

    // Delete button handler
    summary.querySelector('.fm-btn-delete-selected').onclick = function() {
      deleteSelectedDuplicates();
    };
  }

  function selectLargest(gridDiv, images) {
    const checkboxes = gridDiv.querySelectorAll('.dup-checkbox');
    let largestIndex = 0;
    let largestSize = images[0].size;

    for (let i = 1; i < images.length; i++) {
      if (images[i].size > largestSize) {
        largestSize = images[i].size;
        largestIndex = i;
      }
    }

    checkboxes.forEach(function(cb, i) {
      cb.checked = (i !== largestIndex);
    });

    updateDeleteButtonCount();
  }

  function selectNewest(gridDiv, images) {
    const checkboxes = gridDiv.querySelectorAll('.dup-checkbox');
    let newestIndex = 0;
    let newestTime = images[0].modified;

    for (let i = 1; i < images.length; i++) {
      if (images[i].modified > newestTime) {
        newestTime = images[i].modified;
        newestIndex = i;
      }
    }

    checkboxes.forEach(function(cb, i) {
      cb.checked = (i !== newestIndex);
    });

    updateDeleteButtonCount();
  }

  function selectOldest(gridDiv, images) {
    const checkboxes = gridDiv.querySelectorAll('.dup-checkbox');
    let oldestIndex = 0;
    let oldestTime = images[0].modified;

    for (let i = 1; i < images.length; i++) {
      if (images[i].modified < oldestTime) {
        oldestTime = images[i].modified;
        oldestIndex = i;
      }
    }

    checkboxes.forEach(function(cb, i) {
      cb.checked = (i !== oldestIndex);
    });

    updateDeleteButtonCount();
  }

  async function ignoreDuplicateGroup(images, groupDiv) {
    const filenames = images.map(function(img) { return img.filename; });

    if (!confirm('Diese Gruppe als "kein Duplikat" markieren?\nSie wird bei zukünftigen Scans nicht mehr angezeigt.')) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append('action', 'ignore_duplicate_group');
      formData.append('filenames', JSON.stringify(filenames));

      const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      const data = await res.json();

      if (data.ok) {
        // Fade out and remove the group
        groupDiv.style.transition = 'opacity 0.3s';
        groupDiv.style.opacity = '0';
        setTimeout(function() {
          groupDiv.remove();

          // Check if there are any groups left
          const panel = $('fm-duplicates-panel');
          const remainingGroups = panel.querySelectorAll('.duplicate-group');
          if (remainingGroups.length === 0) {
            panel.innerHTML = '<div class="fm-message">✓ Keine Duplikate gefunden (alle ignoriert)</div>';
          }
        }, 300);
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (err) {
      console.error('Fehler beim Ignorieren:', err);
      alert('Fehler beim Ignorieren der Gruppe');
    }
  }

  function updateDeleteButtonCount() {
    const panel = $('fm-duplicates-panel');
    const checked = panel.querySelectorAll('.dup-checkbox:checked');
    const btn = panel.querySelector('.fm-btn-delete-selected');

    if (btn) {
      btn.textContent = 'Ausgewählte löschen (' + checked.length + ')';
      btn.disabled = (checked.length === 0);
    }
  }

  async function deleteSelectedDuplicates() {
    const panel = $('fm-duplicates-panel');
    const checked = panel.querySelectorAll('.dup-checkbox:checked');

    if (checked.length === 0) return;

    const filenames = Array.from(checked).map(function(cb) {
      return cb.getAttribute('data-filename');
    });

    const confirmMsg = 'Wirklich ' + filenames.length + ' Datei(en) löschen?\n\n' + filenames.join('\n');
    if (!confirm(confirmMsg)) return;

    try {
      const formData = new FormData();
      formData.append('action', 'delete_duplicates');
      filenames.forEach(function(fn) {
        formData.append('filenames[]', fn);
      });

      const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      const data = await res.json();

      if (data.ok) {
        alert('✓ ' + data.deleted.length + ' Datei(en) gelöscht');

        if (data.errors.length > 0) {
          alert('⚠ Fehler:\n' + data.errors.join('\n'));
        }

        panel.style.display = 'none';
        loadImages();
      } else {
        alert('Löschen fehlgeschlagen');
      }
    } catch (err) {
      console.error('Lösch-Fehler:', err);
      alert('Löschen fehlgeschlagen');
    }
  }

  function showComparisonModal(images) {
    const modal = document.createElement('div');
    modal.className = 'duplicate-modal comparison-modal';

    let imagesHTML = '';
    images.forEach(function(img) {
      imagesHTML += '<div class="comparison-image">' +
        '<img class="comparison-preview" src="' + img.url + '" alt="' + img.filename + '">' +
        '<div class="comparison-info">' +
          '<div class="comparison-filename">' + img.filename + '</div>' +
          '<div class="comparison-meta">' + formatFileSize(img.size) + '</div>' +
          '<div class="comparison-meta">' + formatDate(img.modified) + '</div>' +
          '<div class="comparison-meta">' + img.dimensions + '</div>' +
        '</div>' +
      '</div>';
    });

    modal.innerHTML = '<div class="duplicate-modal-content comparison-modal-content">' +
      '<div class="comparison-header">' +
        '<h2>🔍 Duplikate vergleichen</h2>' +
        '<button class="comparison-close">&times;</button>' +
      '</div>' +
      '<div class="comparison-grid">' + imagesHTML + '</div>' +
      '<div class="duplicate-actions">' +
        '<button class="fm-btn fm-btn-cancel">Schließen</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.fm-btn-cancel').onclick = function() {
      document.body.removeChild(modal);
    };

    modal.querySelector('.comparison-close').onclick = function() {
      document.body.removeChild(modal);
    };

    modal.onclick = function(e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };

    // ESC key handler
    const escHandler = function(e) {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!$('filemanager-app')) return;

    isLoggedIn = document.querySelector('.logout') !== null || 
                 document.querySelector('.logout-link') !== null ||
                 document.querySelector('.mobile-logout-link') !== null;

    console.log('Login Status:', isLoggedIn);

    if (isLoggedIn) {
      $('fm-upload-area').style.display = 'flex';
    }

    $('fm-reload').addEventListener('click', loadImages);

    // Duplicate scanner
    if ($('fm-scan-duplicates')) {
      $('fm-scan-duplicates').addEventListener('click', scanDuplicates);
    }

    // Cache rebuild
    if ($('fm-rebuild-cache')) {
      $('fm-rebuild-cache').addEventListener('click', rebuildCache);
    }

    if (isLoggedIn) {
      $('fm-upload-btn').addEventListener('click', function() {
        const files = $('fm-file-input').files;
        if (files.length === 0) {
          alert('Bitte wähle Dateien aus');
          return;
        }
        uploadFiles(files);
      });

      const gallery = $('fm-gallery');
      
      gallery.addEventListener('dragover', function(e) {
        e.preventDefault();
        gallery.classList.add('fm-dragover');
      });

      gallery.addEventListener('dragleave', function() {
        gallery.classList.remove('fm-dragover');
      });

      gallery.addEventListener('drop', function(e) {
        e.preventDefault();
        gallery.classList.remove('fm-dragover');
        
        const files = Array.from(e.dataTransfer.files).filter(function(f) {
          return f.type.startsWith('image/');
        });
        
        if (files.length > 0) {
          uploadFiles(files);
        }
      });
    }

    $('fm-lightbox').addEventListener('click', function(e) {
      if (e.target.id === 'fm-lightbox' || e.target.classList.contains('fm-close')) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && $('fm-lightbox').style.display === 'flex') {
        closeLightbox();
      }
    });

    loadImages();
  });
})();