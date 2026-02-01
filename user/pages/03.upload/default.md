---
title: Galerie Manager
visible: true
---

<link rel="stylesheet" href="/grav-admin/user/assets/filemanager/filemanager.css">

<div id="filemanager-app">
  <h2>Galerie Manager</h2>
  
  <div class="fm-controls">
    <button id="fm-reload" class="fm-btn">🔄 Neu laden</button>
    <div id="fm-upload-area" style="display:none;">
      <input type="file" id="fm-file-input" multiple accept="image/*">
      <button id="fm-upload-btn" class="fm-btn fm-btn-primary">📤 Upload</button>
    </div>
  </div>

  <div id="fm-stats" class="fm-stats"></div>

  <div id="fm-gallery" class="fm-gallery"></div>
  
  <div id="fm-lightbox" class="fm-lightbox" style="display:none;">
    <span class="fm-close">&times;</span>
    <img class="fm-lightbox-img" src="">
  </div>
</div>

<script src="/grav-admin/user/assets/filemanager/filemanager.js"></script>