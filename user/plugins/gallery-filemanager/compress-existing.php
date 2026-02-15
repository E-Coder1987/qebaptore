<?php
/**
 * Batch Compression Script for Existing Gallery Images
 *
 * This script will compress all existing images > 1MB in the gallery
 * Run from command line: php compress-existing.php
 */

// Define paths
define('GRAV_ROOT', realpath(__DIR__ . '/../../../'));
define('GALLERY_PATH', GRAV_ROOT . '/user/pages/01.home/gallery');
define('COMPRESSED_PATH', GALLERY_PATH . '/compressed');

// Check if running from CLI
if (php_sapi_name() !== 'cli') {
    die("This script must be run from command line\n");
}

// Check if GD is available
if (!function_exists('imagecreatefromjpeg')) {
    die("Error: GD library is not available. Please install php-gd extension.\n");
}

echo "===========================================\n";
echo "Gallery Image Batch Compression Tool\n";
echo "===========================================\n\n";

// Create compressed directory if it doesn't exist
if (!is_dir(COMPRESSED_PATH)) {
    mkdir(COMPRESSED_PATH, 0755, true);
    echo "✓ Created compressed directory\n";
}

// Find all images
$files = glob(GALLERY_PATH . '/*.{jpg,jpeg,png,gif,JPG,JPEG,PNG,GIF}', GLOB_BRACE);
$total = count($files);
$compressed = 0;
$skipped = 0;
$failed = 0;

echo "Found $total images in gallery\n";
echo "Processing...\n\n";

foreach ($files as $index => $file) {
    $filename = basename($file);
    $filesize = filesize($file);
    $filesizeMB = round($filesize / 1024 / 1024, 2);
    $progress = $index + 1;

    echo "[$progress/$total] $filename ($filesizeMB MB) ... ";

    // Skip if already compressed or less than 1MB
    if ($filesize <= 1024 * 1024) {
        echo "SKIPPED (< 1MB)\n";
        $skipped++;
        continue;
    }

    // Check if compressed version already exists
    $compressedFilename = pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
    $compressedFile = COMPRESSED_PATH . '/' . $compressedFilename;

    if (file_exists($compressedFile)) {
        echo "SKIPPED (already compressed)\n";
        $skipped++;
        continue;
    }

    // Compress the image
    $result = compressImage($file, $compressedFile);

    if ($result) {
        $newSize = filesize($compressedFile);
        $newSizeMB = round($newSize / 1024 / 1024, 2);
        $saved = round(($filesize - $newSize) / 1024 / 1024, 2);
        $percent = round((($filesize - $newSize) / $filesize) * 100);

        echo "✓ COMPRESSED ($newSizeMB MB, saved $saved MB / $percent%)\n";
        $compressed++;
    } else {
        echo "✗ FAILED\n";
        $failed++;
    }
}

echo "\n===========================================\n";
echo "Summary:\n";
echo "  Total images: $total\n";
echo "  Compressed: $compressed\n";
echo "  Skipped: $skipped\n";
echo "  Failed: $failed\n";
echo "===========================================\n";

/**
 * Compress an image
 */
function compressImage($sourceFile, $targetFile)
{
    $ext = strtolower(pathinfo($sourceFile, PATHINFO_EXTENSION));

    // Load source image
    $image = null;
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            $image = @imagecreatefromjpeg($sourceFile);
            break;
        case 'png':
            $image = @imagecreatefrompng($sourceFile);
            break;
        case 'gif':
            $image = @imagecreatefromgif($sourceFile);
            break;
    }

    if (!$image) {
        return false;
    }

    $width = imagesx($image);
    $height = imagesy($image);

    // Calculate new dimensions (max 1920px width)
    $maxWidth = 1920;
    if ($width > $maxWidth) {
        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = (int)($height * $ratio);
    } else {
        $newWidth = $width;
        $newHeight = $height;
    }

    // Create resized image
    $resized = imagecreatetruecolor($newWidth, $newHeight);

    // Handle transparency for PNG/GIF
    if ($ext === 'png' || $ext === 'gif') {
        $white = imagecolorallocate($resized, 255, 255, 255);
        imagefill($resized, 0, 0, $white);
    }

    imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

    // Save as compressed JPG (quality 85%)
    $success = imagejpeg($resized, $targetFile, 85);

    imagedestroy($image);
    imagedestroy($resized);

    return $success;
}
