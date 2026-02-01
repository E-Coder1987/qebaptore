/* Gallery Filemanager - Frontend */

(function() {
  const API_BASE = '/grav-admin/gallery-manager';
  
  const $ = function(id) { return document.getElementById(id); };
  
  let isLoggedIn = false;
  let currentImages = [];

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
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files[]', files[i]);
    }
    formData.append('action', 'upload');

    const uploadBtn = $('fm-upload-btn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Uploading...';

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