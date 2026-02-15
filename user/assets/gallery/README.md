# Modern Gallery System

A beautiful, performant image gallery with automatic compression and lightbox viewing.

## Features

### 🎨 Modern Gallery Display
- **Swiper.js** - Smooth, touch-friendly carousel
- **PhotoSwipe** - Professional lightbox with zoom and navigation
- **Thumbnail navigation** - Shows 3 previous + 3 next images at bottom
- **Auto-scroll** - 10-second intervals with pause on hover
- **Fade transitions** - Elegant image transitions
- **Responsive design** - Perfect on mobile and desktop

### 📦 Automatic Image Compression
- **Smart compression** - Automatically compresses images > 1MB on upload
- **Display optimization** - Shows compressed versions in gallery (faster loading)
- **Full quality viewing** - Click to open original in lightbox
- **Storage efficiency** - Reduces bandwidth and improves performance

### 🎯 User Experience
- Click any image to view full-size original
- Swipe/arrow navigation
- Pinch-to-zoom on mobile
- Keyboard shortcuts (arrow keys, ESC)
- Loading indicators
- Visual hints and tooltips

## File Structure

```
user/
├── assets/gallery/
│   ├── gallery.js          # Gallery initialization and logic
│   ├── gallery.css         # Beautiful styling
│   └── README.md           # This file
├── pages/01.home/
│   ├── gallery/
│   │   ├── compressed/     # Auto-generated compressed images
│   │   ├── image1.jpg      # Original images
│   │   └── image2.png
│   └── default.md          # Gallery display template
└── plugins/
    ├── gallery-filemanager/ # Upload & file management
    │   ├── gallery-filemanager.php
    │   └── compress-existing.php
    └── gallery-helper/      # Twig functions
        └── gallery-helper.php
```

## How It Works

### Upload Process
1. User uploads image via 03.upload page
2. Original image is saved to `gallery/` directory
3. If image > 1MB:
   - Compressed version created (max 1920px width, 85% quality JPG)
   - Saved to `gallery/compressed/` directory

### Display Process
1. Gallery loads compressed versions for fast display
2. User clicks image → lightbox opens with original file
3. Maintains quality while optimizing bandwidth

### Compression Details
- **Threshold**: 1MB
- **Max width**: 1920px (height auto-scaled)
- **Quality**: 85% JPG
- **Format**: Always converts to JPG for compressed version
- **Originals**: Never modified, always preserved

## Batch Compress Existing Images

To compress all existing images in your gallery:

```bash
cd user/plugins/gallery-filemanager
php compress-existing.php
```

This will:
- Scan all images in the gallery
- Compress images > 1MB
- Skip already compressed images
- Show progress and statistics

## Customization

### Change Autoplay Speed
Edit `gallery.js` line with `delay: 10000` (milliseconds)

### Adjust Compression Quality
Edit `gallery-filemanager.php` line with `imagejpeg(..., 85)` (0-100)

### Change Max Width
Edit both files where `$maxWidth = 1920` appears

### Modify Thumbnail Count
Edit `gallery.js` where `slidesPerView: 7` appears

## Browser Support

- Chrome, Firefox, Safari, Edge (latest)
- iOS Safari 12+
- Android Chrome 80+
- Full mobile touch support

## Performance

- Lazy loading (images load as needed)
- Thumbnail optimization
- Compressed versions reduce initial load by ~70-90%
- PhotoSwipe uses hardware acceleration
- Swiper is highly optimized

## Dependencies

- **Swiper.js** v11 - MIT License
- **PhotoSwipe** v5 - MIT License
- **jQuery** v3.7.1 (for existing site features)

## Tips

1. **Upload Quality**: Upload highest quality images - compression is automatic
2. **Formats**: JPG, PNG, GIF supported - compressed versions are always JPG
3. **Originals**: Always preserved for full-quality viewing
4. **Mobile**: Touch gestures work naturally (swipe, pinch-zoom)
5. **Keyboard**: Use arrow keys and ESC in lightbox

## Troubleshooting

**Gallery not loading?**
- Check browser console for errors
- Ensure jQuery and Swiper.js load before gallery.js

**Images not compressing?**
- Verify GD library is installed: `php -m | grep gd`
- Check `gallery/compressed/` directory permissions (755)

**Lightbox not opening?**
- Verify PhotoSwipe scripts are loaded
- Check browser console for errors

**Thumbnails not syncing?**
- Clear browser cache
- Check that thumbnail swiper initializes first

## Credits

Built with ❤️ for Qebaptore
- Swiper.js by Vladimir Kharlampidi
- PhotoSwipe by Dmytro Semenov
