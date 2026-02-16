<?php
namespace Grav\Plugin;

use Grav\Common\Plugin;
use Grav\Common\Page\Page;

class GalleryFilemanagerPlugin extends Plugin
{
    protected $gallery_path = 'user/pages/01.home/gallery';

    public static function getSubscribedEvents()
    {
        return [
            'onPageInitialized' => ['onPageInitialized', 0]
        ];
    }

    public function onPageInitialized()
    {
        $uri = $this->grav['uri'];
        $path = $uri->path();
        
        if (strpos($path, 'gallery-manager') !== false) {
            $session = $this->grav['session'];
            if (!$session->isStarted()) {
                $session->start();
            }
            
            $this->handleRequest();
            exit;
        }
    }

    protected function handleRequest()
    {
        header('Content-Type: application/json');
        
        $action = $_GET['action'] ?? $_POST['action'] ?? 'list';
        
        if (in_array($action, ['upload', 'delete', 'rotate', 'rename', 'delete_duplicates'])) {
            $user = $this->grav['user'] ?? null;
            if (!$user || !$user->authenticated) {
                http_response_code(401);
                echo json_encode(['ok' => false, 'error' => 'Nicht eingeloggt']);
                return;
            }
        }

        switch ($action) {
            case 'list':
                $this->listImages();
                break;
            case 'upload':
                $this->uploadImages();
                break;
            case 'delete':
                $this->deleteImage();
                break;
            case 'rotate':
                $this->rotateImage();
                break;
            case 'rename':
                $this->renameImage();
                break;
            case 'rebuild_hash_cache':
                $this->rebuildHashCache();
                break;
            case 'check_duplicate':
                $this->checkDuplicate();
                break;
            case 'scan_duplicates':
                $this->scanDuplicates();
                break;
            case 'delete_duplicates':
                $this->deleteDuplicates();
                break;
            case 'ignore_duplicate_group':
                $this->ignoreDuplicateGroup();
                break;
            default:
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Unbekannte Aktion']);
        }
    }

    protected function listImages()
    {
        $path = GRAV_ROOT . '/' . $this->gallery_path;
        
        if (!is_dir($path)) {
            echo json_encode(['ok' => true, 'images' => []]);
            return;
        }

        $files = glob($path . '/*.{jpg,jpeg,png,gif,JPG,JPEG,PNG,GIF}', GLOB_BRACE);
        $images = [];

        foreach ($files as $file) {
            $filename = basename($file);
            $mtime = filemtime($file);
            $images[] = [
                'name' => $filename,
                'size' => filesize($file),
                'modified' => $mtime,
                'url' => '/grav-admin/' . $this->gallery_path . '/' . $filename . '?t=' . $mtime
            ];
        }

        usort($images, function($a, $b) {
            return $b['modified'] - $a['modified'];
        });

        echo json_encode(['ok' => true, 'images' => $images]);
    }

    protected function uploadImages()
    {
        if (!isset($_FILES['files'])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Keine Dateien']);
            return;
        }

        $path = GRAV_ROOT . '/' . $this->gallery_path;
        $compressedPath = $path . '/compressed';

        if (!is_dir($path)) {
            mkdir($path, 0755, true);
        }

        if (!is_dir($compressedPath)) {
            mkdir($compressedPath, 0755, true);
        }

        $uploaded = [];
        $errors = [];

        $files = $_FILES['files'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $fileCount; $i++) {
            $filename = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
            $size = is_array($files['size']) ? $files['size'][$i] : $files['size'];

            if ($error !== UPLOAD_ERR_OK) {
                $errors[] = $filename . ': Upload-Fehler';
                continue;
            }

            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif'])) {
                $errors[] = $filename . ': Nur JPG, PNG, GIF erlaubt';
                continue;
            }

            if ($size > 10 * 1024 * 1024) {
                $errors[] = $filename . ': Zu groß (max 10MB)';
                continue;
            }

            $targetFile = $path . '/' . $filename;
            $counter = 1;
            while (file_exists($targetFile)) {
                $name = pathinfo($filename, PATHINFO_FILENAME);
                $targetFile = $path . '/' . $name . '_' . $counter . '.' . $ext;
                $counter++;
            }

            if (move_uploaded_file($tmpName, $targetFile)) {
                $finalFilename = basename($targetFile);
                $uploaded[] = $finalFilename;

                // Auto-compress if file > 1MB
                if ($size > 1024 * 1024) {
                    $this->compressImage($targetFile, $compressedPath);
                }
            } else {
                $errors[] = $filename . ': Speichern fehlgeschlagen';
            }
        }

        echo json_encode([
            'ok' => true,
            'uploaded' => $uploaded,
            'errors' => $errors
        ]);
    }

    protected function compressImage($sourceFile, $compressedDir)
    {
        if (!function_exists('imagecreatefromjpeg')) {
            return false;
        }

        $ext = strtolower(pathinfo($sourceFile, PATHINFO_EXTENSION));
        $filename = basename($sourceFile);
        $compressedFilename = pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
        $targetFile = $compressedDir . '/' . $compressedFilename;

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

    protected function deleteImage()
    {
        $filename = $_POST['filename'] ?? '';
        
        if (empty($filename)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Kein Dateiname']);
            return;
        }

        $filename = basename($filename);
        $filepath = GRAV_ROOT . '/' . $this->gallery_path . '/' . $filename;

        if (!file_exists($filepath)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Datei nicht gefunden']);
            return;
        }

        if (unlink($filepath)) {
            echo json_encode(['ok' => true, 'message' => 'Gelöscht']);
        } else {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Löschen fehlgeschlagen']);
        }
    }

    protected function rotateImage()
    {
        $filename = $_POST['filename'] ?? '';
        $direction = $_POST['direction'] ?? 'right';
        
        if (empty($filename)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Kein Dateiname']);
            return;
        }

        $filename = basename($filename);
        $filepath = GRAV_ROOT . '/' . $this->gallery_path . '/' . $filename;

        if (!file_exists($filepath)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Datei nicht gefunden']);
            return;
        }

        if (!function_exists('imagecreatefromjpeg')) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'GD library nicht verfügbar']);
            return;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $image = null;
        
        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $image = imagecreatefromjpeg($filepath);
                break;
            case 'png':
                $image = imagecreatefrompng($filepath);
                break;
            case 'gif':
                $image = imagecreatefromgif($filepath);
                break;
            default:
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Bildformat nicht unterstützt']);
                return;
        }

        if (!$image) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Bild konnte nicht geladen werden']);
            return;
        }

        $degrees = ($direction === 'left') ? 90 : -90;
        $rotated = imagerotate($image, $degrees, 0);

        if (!$rotated) {
            imagedestroy($image);
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Rotation fehlgeschlagen']);
            return;
        }

        $success = false;
        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $success = imagejpeg($rotated, $filepath, 90);
                break;
            case 'png':
                $success = imagepng($rotated, $filepath, 9);
                break;
            case 'gif':
                $success = imagegif($rotated, $filepath);
                break;
        }

        imagedestroy($image);
        imagedestroy($rotated);

        if ($success) {
            echo json_encode(['ok' => true, 'message' => 'Rotiert']);
        } else {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Speichern fehlgeschlagen']);
        }
    }

    protected function renameImage()
    {
        $oldName = $_POST['old_name'] ?? '';
        $newName = $_POST['new_name'] ?? '';
        
        if (empty($oldName) || empty($newName)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Namen fehlen']);
            return;
        }

        $oldName = basename($oldName);
        $newName = basename($newName);
        
        // Prüfe ob Extension gleich bleibt
        $oldExt = strtolower(pathinfo($oldName, PATHINFO_EXTENSION));
        $newExt = strtolower(pathinfo($newName, PATHINFO_EXTENSION));
        
        if ($oldExt !== $newExt) {
            // Extension automatisch beibehalten
            $newName = pathinfo($newName, PATHINFO_FILENAME) . '.' . $oldExt;
        }
        
        // Validiere Dateinamen (keine Sonderzeichen außer - und _)
        if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $newName)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Ungültiger Dateiname (nur a-z, 0-9, - und _ erlaubt)']);
            return;
        }
        
        $oldPath = GRAV_ROOT . '/' . $this->gallery_path . '/' . $oldName;
        $newPath = GRAV_ROOT . '/' . $this->gallery_path . '/' . $newName;

        if (!file_exists($oldPath)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Datei nicht gefunden']);
            return;
        }

        if (file_exists($newPath)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Datei mit diesem Namen existiert bereits']);
            return;
        }

        if (rename($oldPath, $newPath)) {
            echo json_encode(['ok' => true, 'message' => 'Umbenannt', 'new_name' => $newName]);
        } else {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Umbenennen fehlgeschlagen']);
        }
    }

    protected function rebuildHashCache()
    {
        $detector = new DuplicateDetector($this->gallery_path);
        $startTime = microtime(true);
        $count = $detector->rebuildCache();
        $duration = round((microtime(true) - $startTime) * 1000);

        echo json_encode([
            'ok' => true,
            'cached' => $count,
            'duration_ms' => $duration
        ]);
    }

    protected function checkDuplicate()
    {
        $fileHash = $_POST['file_hash'] ?? '';
        $filesize = (int)($_POST['filesize'] ?? 0);
        $width = (int)($_POST['width'] ?? 0);
        $height = (int)($_POST['height'] ?? 0);
        $perceptualHash = $_POST['perceptual_hash'] ?? '';

        if (empty($fileHash)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Kein Hash']);
            return;
        }

        $detector = new DuplicateDetector($this->gallery_path);

        // Check for exact match
        $exactMatches = $detector->findExactDuplicates($fileHash);

        if (!empty($exactMatches)) {
            echo json_encode([
                'ok' => true,
                'is_duplicate' => true,
                'match_type' => 'exact',
                'matches' => $exactMatches
            ]);
            return;
        }

        // Check for perceptual duplicates (resized images)
        if (!empty($perceptualHash)) {
            $perceptualMatches = $detector->findPerceptualDuplicates($perceptualHash);

            if (!empty($perceptualMatches)) {
                echo json_encode([
                    'ok' => true,
                    'is_duplicate' => true,
                    'match_type' => 'resized',
                    'matches' => $perceptualMatches
                ]);
                return;
            }
        }

        // For upload-time detection, we rely primarily on exact MD5 and perceptual hash
        // Dimension-based detection is too prone to false positives for upload warnings
        // (it's still used in the manual duplicate scanner with color similarity checks)

        echo json_encode([
            'ok' => true,
            'is_duplicate' => false,
            'match_type' => 'none',
            'matches' => []
        ]);
    }

    protected function scanDuplicates()
    {
        $detector = new DuplicateDetector($this->gallery_path);
        $result = $detector->findAllDuplicates();

        echo json_encode([
            'ok' => true,
            'groups' => $result['groups'],
            'total_duplicates' => $result['total_duplicates'],
            'space_wasted' => $result['space_wasted']
        ]);
    }

    protected function deleteDuplicates()
    {
        $filenames = $_POST['filenames'] ?? [];

        if (!is_array($filenames) || empty($filenames)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Keine Dateinamen']);
            return;
        }

        $path = GRAV_ROOT . '/' . $this->gallery_path;
        $deleted = [];
        $errors = [];

        foreach ($filenames as $filename) {
            $filename = basename($filename);
            $filepath = $path . '/' . $filename;

            if (!file_exists($filepath)) {
                $errors[] = $filename . ': Nicht gefunden';
                continue;
            }

            // Also delete compressed version if exists
            $compressedPath = $path . '/compressed/' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
            if (file_exists($compressedPath)) {
                @unlink($compressedPath);
            }

            if (unlink($filepath)) {
                $deleted[] = $filename;
            } else {
                $errors[] = $filename . ': Löschen fehlgeschlagen';
            }
        }

        // Rebuild cache after deletion
        $detector = new DuplicateDetector($this->gallery_path);
        $detector->rebuildCache();

        echo json_encode([
            'ok' => true,
            'deleted' => $deleted,
            'errors' => $errors
        ]);
    }

    protected function ignoreDuplicateGroup()
    {
        $filenamesJson = $_POST['filenames'] ?? '';

        // Decode JSON string to array
        $filenames = json_decode($filenamesJson, true);

        if (!is_array($filenames) || empty($filenames)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Keine Dateinamen']);
            return;
        }

        $detector = new DuplicateDetector($this->gallery_path);
        $detector->ignoreGroup($filenames);

        echo json_encode([
            'ok' => true,
            'message' => 'Gruppe als "kein Duplikat" markiert'
        ]);
    }
}

/**
 * Duplicate Detection Helper Class
 */
class DuplicateDetector
{
    private $gallery_path;
    private $cache_file;
    private $cache = null;
    private $ignore_list_file;
    private $ignore_list = null;

    public function __construct($gallery_path)
    {
        $this->gallery_path = $gallery_path;
        $this->cache_file = GRAV_ROOT . '/user/data/gallery/image-hashes.json';
        $this->ignore_list_file = GRAV_ROOT . '/user/data/gallery/duplicate-ignore-list.json';
    }

    public function loadCache()
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        if (!file_exists($this->cache_file)) {
            $this->cache = ['version' => 1, 'last_updated' => time(), 'images' => []];
            return $this->cache;
        }

        try {
            $content = file_get_contents($this->cache_file);
            $this->cache = json_decode($content, true);

            if (!is_array($this->cache) || !isset($this->cache['images'])) {
                // Corrupted cache, rebuild
                $this->cache = ['version' => 1, 'last_updated' => time(), 'images' => []];
            }
        } catch (\Exception $e) {
            // Parse error, rebuild
            $this->cache = ['version' => 1, 'last_updated' => time(), 'images' => []];
        }

        return $this->cache;
    }

    public function saveCache()
    {
        if ($this->cache === null) {
            return false;
        }

        $dir = dirname($this->cache_file);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->cache['last_updated'] = time();

        try {
            $json = json_encode($this->cache, JSON_PRETTY_PRINT);

            // Use file locking for concurrent access
            $fp = fopen($this->cache_file, 'w');
            if ($fp && flock($fp, LOCK_EX)) {
                fwrite($fp, $json);
                flock($fp, LOCK_UN);
                fclose($fp);
                return true;
            }
        } catch (\Exception $e) {
            return false;
        }

        return false;
    }

    public function rebuildCache()
    {
        $path = GRAV_ROOT . '/' . $this->gallery_path;

        if (!is_dir($path)) {
            return 0;
        }

        $files = glob($path . '/*.{jpg,jpeg,png,gif,JPG,JPEG,PNG,GIF}', GLOB_BRACE);
        $this->cache = ['version' => 1, 'last_updated' => time(), 'images' => []];

        foreach ($files as $file) {
            $filename = basename($file);
            $metadata = $this->getImageMetadata($file);

            if ($metadata) {
                $this->cache['images'][$filename] = $metadata;
            }
        }

        $this->saveCache();

        return count($this->cache['images']);
    }

    public function loadIgnoreList()
    {
        if ($this->ignore_list !== null) {
            return $this->ignore_list;
        }

        if (!file_exists($this->ignore_list_file)) {
            $this->ignore_list = [];
            return $this->ignore_list;
        }

        try {
            $content = file_get_contents($this->ignore_list_file);
            $this->ignore_list = json_decode($content, true);

            if (!is_array($this->ignore_list)) {
                $this->ignore_list = [];
            }
        } catch (\Exception $e) {
            $this->ignore_list = [];
        }

        return $this->ignore_list;
    }

    public function saveIgnoreList()
    {
        $dir = dirname($this->ignore_list_file);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            $json = json_encode($this->ignore_list, JSON_PRETTY_PRINT);
            file_put_contents($this->ignore_list_file, $json);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function ignoreGroup($filenames)
    {
        $this->loadIgnoreList();

        // Create a unique key for this group (sorted filenames)
        sort($filenames);
        $groupKey = implode('|', $filenames);

        if (!in_array($groupKey, $this->ignore_list)) {
            $this->ignore_list[] = $groupKey;
            $this->saveIgnoreList();
        }

        return true;
    }

    public function isGroupIgnored($filenames)
    {
        $this->loadIgnoreList();

        // Create the same unique key
        sort($filenames);
        $groupKey = implode('|', $filenames);

        return in_array($groupKey, $this->ignore_list);
    }

    public function getImageMetadata($filepath)
    {
        if (!file_exists($filepath)) {
            return null;
        }

        $md5 = md5_file($filepath);
        $filesize = filesize($filepath);
        $modified = filemtime($filepath);

        $dimensions = @getimagesize($filepath);
        $width = $dimensions ? $dimensions[0] : 0;
        $height = $dimensions ? $dimensions[1] : 0;

        $colorSample = $this->getColorSample($filepath);
        $perceptualHash = $this->getPerceptualHash($filepath);

        return [
            'md5' => $md5,
            'width' => $width,
            'height' => $height,
            'filesize' => $filesize,
            'modified' => $modified,
            'color_sample' => $colorSample,
            'perceptual_hash' => $perceptualHash
        ];
    }

    public function getColorSample($filepath)
    {
        if (!function_exists('imagecreatefromjpeg')) {
            return '';
        }

        $ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));
        $image = null;

        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $image = @imagecreatefromjpeg($filepath);
                break;
            case 'png':
                $image = @imagecreatefrompng($filepath);
                break;
            case 'gif':
                $image = @imagecreatefromgif($filepath);
                break;
        }

        if (!$image) {
            return '';
        }

        $width = imagesx($image);
        $height = imagesy($image);

        // Sample 3x3 grid and average colors
        $samples = [];
        for ($i = 0; $i < 3; $i++) {
            for ($j = 0; $j < 3; $j++) {
                $x = (int)(($i + 0.5) * $width / 3);
                $y = (int)(($j + 0.5) * $height / 3);
                $rgb = imagecolorat($image, $x, $y);
                $samples[] = $rgb;
            }
        }

        imagedestroy($image);

        // Return all 9 samples as comma-separated RGB values
        $rgbValues = [];
        foreach ($samples as $rgb) {
            $r = ($rgb >> 16) & 0xFF;
            $g = ($rgb >> 8) & 0xFF;
            $b = $rgb & 0xFF;
            $rgbValues[] = "$r,$g,$b";
        }

        return implode('|', $rgbValues);
    }

    public function getPerceptualHash($filepath)
    {
        if (!function_exists('imagecreatefromjpeg')) {
            return '';
        }

        $ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));
        $image = null;

        switch ($ext) {
            case 'jpg':
            case 'jpeg':
                $image = @imagecreatefromjpeg($filepath);
                break;
            case 'png':
                $image = @imagecreatefrompng($filepath);
                break;
            case 'gif':
                $image = @imagecreatefromgif($filepath);
                break;
        }

        if (!$image) {
            return '';
        }

        // Create a small 16x16 thumbnail
        $thumb = imagecreatetruecolor(16, 16);
        imagecopyresampled($thumb, $image, 0, 0, 0, 0, 16, 16, imagesx($image), imagesy($image));
        imagedestroy($image);

        // Convert to grayscale and sample pixels
        $pixels = [];
        for ($y = 0; $y < 16; $y++) {
            for ($x = 0; $x < 16; $x++) {
                $rgb = imagecolorat($thumb, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                // Convert to grayscale
                $gray = (int)(($r + $g + $b) / 3);
                $pixels[] = $gray;
            }
        }
        imagedestroy($thumb);

        // Calculate average
        $avg = array_sum($pixels) / count($pixels);

        // Create hash: 1 if pixel > average, 0 if not
        $hash = '';
        foreach ($pixels as $pixel) {
            $hash .= ($pixel >= $avg) ? '1' : '0';
        }

        // Convert binary string to hex for compact storage
        $hexHash = '';
        for ($i = 0; $i < strlen($hash); $i += 4) {
            $hexHash .= dechex(bindec(substr($hash, $i, 4)));
        }

        return $hexHash;
    }

    public function comparePerceptualHashes($hash1, $hash2, $maxDifference = 10)
    {
        if (empty($hash1) || empty($hash2) || strlen($hash1) !== strlen($hash2)) {
            return false;
        }

        // Convert hex back to binary
        $bin1 = '';
        $bin2 = '';
        for ($i = 0; $i < strlen($hash1); $i++) {
            $bin1 .= str_pad(decbin(hexdec($hash1[$i])), 4, '0', STR_PAD_LEFT);
            $bin2 .= str_pad(decbin(hexdec($hash2[$i])), 4, '0', STR_PAD_LEFT);
        }

        // Count differing bits (Hamming distance)
        $differences = 0;
        for ($i = 0; $i < strlen($bin1); $i++) {
            if ($bin1[$i] !== $bin2[$i]) {
                $differences++;
            }
        }

        return $differences <= $maxDifference;
    }

    public function compareColorSamples($sample1, $sample2, $threshold = 20)
    {
        if (empty($sample1) || empty($sample2)) {
            return false;
        }

        // Split into individual grid point samples (9 points)
        $points1 = explode('|', $sample1);
        $points2 = explode('|', $sample2);

        if (count($points1) !== 9 || count($points2) !== 9) {
            return false;
        }

        // Compare each of the 9 grid points
        $matchingPoints = 0;
        for ($i = 0; $i < 9; $i++) {
            $rgb1 = explode(',', $points1[$i]);
            $rgb2 = explode(',', $points2[$i]);

            if (count($rgb1) !== 3 || count($rgb2) !== 3) {
                continue;
            }

            // Calculate Euclidean distance for this grid point
            $rDiff = (int)$rgb1[0] - (int)$rgb2[0];
            $gDiff = (int)$rgb1[1] - (int)$rgb2[1];
            $bDiff = (int)$rgb1[2] - (int)$rgb2[2];

            $distance = sqrt($rDiff * $rDiff + $gDiff * $gDiff + $bDiff * $bDiff);

            // If this grid point is similar enough, count it as matching
            if ($distance <= $threshold) {
                $matchingPoints++;
            }
        }

        // Require at least 8 out of 9 grid points to match
        return $matchingPoints >= 8;
    }

    public function findExactDuplicates($md5_hash)
    {
        $this->loadCache();
        $matches = [];

        foreach ($this->cache['images'] as $filename => $data) {
            if ($data['md5'] === $md5_hash) {
                $matches[] = [
                    'filename' => $filename,
                    'match_level' => 'exact',
                    'confidence' => 100,
                    'url' => '/grav-admin/' . $this->gallery_path . '/' . $filename . '?t=' . $data['modified'],
                    'size' => $data['filesize'],
                    'modified' => $data['modified'],
                    'dimensions' => $data['width'] . 'x' . $data['height']
                ];
            }
        }

        return $matches;
    }

    public function findSimilarByDimensions($width, $height, $filesize, $tolerance = 0.05)
    {
        $this->loadCache();
        $matches = [];

        foreach ($this->cache['images'] as $filename => $data) {
            // Check dimensions (including rotated version)
            $dimensionMatch = (
                ($data['width'] == $width && $data['height'] == $height) ||
                ($data['width'] == $height && $data['height'] == $width)
            );

            if (!$dimensionMatch) {
                continue;
            }

            // Check filesize within tolerance
            $minSize = $filesize * (1 - $tolerance);
            $maxSize = $filesize * (1 + $tolerance);

            if ($data['filesize'] >= $minSize && $data['filesize'] <= $maxSize) {
                $sizeDiff = abs($data['filesize'] - $filesize) / $filesize;
                $confidence = (int)((1 - $sizeDiff) * 100);

                $matches[] = [
                    'filename' => $filename,
                    'match_level' => 'dimensions',
                    'confidence' => $confidence,
                    'url' => '/grav-admin/' . $this->gallery_path . '/' . $filename . '?t=' . $data['modified'],
                    'size' => $data['filesize'],
                    'modified' => $data['modified'],
                    'dimensions' => $data['width'] . 'x' . $data['height']
                ];
            }
        }

        return $matches;
    }

    public function findPerceptualDuplicates($perceptualHash, $maxDifference = 20)
    {
        $this->loadCache();
        $matches = [];

        foreach ($this->cache['images'] as $filename => $data) {
            if (empty($data['perceptual_hash'])) {
                continue;
            }

            if ($this->comparePerceptualHashes($perceptualHash, $data['perceptual_hash'], $maxDifference)) {
                // Calculate confidence based on hash similarity
                $confidence = 90; // High confidence for perceptual matches

                $matches[] = [
                    'filename' => $filename,
                    'match_level' => 'perceptual',
                    'confidence' => $confidence,
                    'url' => '/grav-admin/' . $this->gallery_path . '/' . $filename . '?t=' . $data['modified'],
                    'size' => $data['filesize'],
                    'modified' => $data['modified'],
                    'dimensions' => $data['width'] . 'x' . $data['height']
                ];
            }
        }

        return $matches;
    }

    public function findAllDuplicates()
    {
        $this->loadCache();
        $path = GRAV_ROOT . '/' . $this->gallery_path;

        // Always rebuild cache to ensure accuracy
        $this->rebuildCache();

        // Group by MD5 hash (exact matches)
        $hashGroups = [];
        foreach ($this->cache['images'] as $filename => $data) {
            $hash = $data['md5'];
            if (!isset($hashGroups[$hash])) {
                $hashGroups[$hash] = [];
            }
            $hashGroups[$hash][] = array_merge(['filename' => $filename], $data);
        }

        // Track already grouped filenames to avoid duplicates
        $grouped = [];
        $groups = [];
        $totalDuplicates = 0;
        $spaceWasted = 0;

        // First: Find exact MD5 matches
        foreach ($hashGroups as $hash => $images) {
            if (count($images) > 1) {
                // Sort by filesize (largest first)
                usort($images, function($a, $b) {
                    return $b['filesize'] - $a['filesize'];
                });

                $groupImages = [];
                foreach ($images as $img) {
                    $groupImages[] = [
                        'filename' => $img['filename'],
                        'url' => '/grav-admin/' . $this->gallery_path . '/' . $img['filename'] . '?t=' . $img['modified'],
                        'size' => $img['filesize'],
                        'modified' => $img['modified'],
                        'dimensions' => $img['width'] . 'x' . $img['height'],
                        'hash' => $hash
                    ];
                    $grouped[$img['filename']] = true;
                }

                $groups[] = [
                    'match_type' => 'exact',
                    'images' => $groupImages
                ];

                $totalDuplicates += count($images) - 1;

                // Space wasted = sum of all except largest
                for ($i = 1; $i < count($images); $i++) {
                    $spaceWasted += $images[$i]['filesize'];
                }
            }
        }

        // Second: Find similar images (same dimensions + similar filesize)
        $allImages = [];
        foreach ($this->cache['images'] as $filename => $data) {
            if (!isset($grouped[$filename])) {
                $allImages[] = array_merge(['filename' => $filename], $data);
            }
        }

        // Group by dimension key
        $dimensionGroups = [];
        foreach ($allImages as $img) {
            // Create key for both normal and rotated dimensions
            $dimKey1 = $img['width'] . 'x' . $img['height'];
            $dimKey2 = $img['height'] . 'x' . $img['width'];

            if (!isset($dimensionGroups[$dimKey1])) {
                $dimensionGroups[$dimKey1] = [];
            }
            $dimensionGroups[$dimKey1][] = $img;
        }

        // Check each dimension group for similar filesizes
        foreach ($dimensionGroups as $dimKey => $images) {
            if (count($images) < 2) continue;

            // Sort by filesize
            usort($images, function($a, $b) {
                return $b['filesize'] - $a['filesize'];
            });

            // Find clusters of similar images (filesize + color similarity)
            $similarGroups = [];
            foreach ($images as $img) {
                $foundGroup = false;

                foreach ($similarGroups as &$group) {
                    $refImg = $group[0];
                    $refSize = $refImg['filesize'];
                    $minSize = $refSize * 0.97;  // Loosened to 3% tolerance
                    $maxSize = $refSize * 1.03;

                    // Check filesize AND color similarity
                    $sizeMatch = ($img['filesize'] >= $minSize && $img['filesize'] <= $maxSize);
                    $colorMatch = $this->compareColorSamples($img['color_sample'], $refImg['color_sample'], 25);

                    if ($sizeMatch && $colorMatch) {
                        $group[] = $img;
                        $foundGroup = true;
                        break;
                    }
                }

                if (!$foundGroup) {
                    $similarGroups[] = [$img];
                }
            }

            // Add groups with 2+ images
            foreach ($similarGroups as $simGroup) {
                if (count($simGroup) >= 2) {
                    $groupImages = [];
                    foreach ($simGroup as $img) {
                        $groupImages[] = [
                            'filename' => $img['filename'],
                            'url' => '/grav-admin/' . $this->gallery_path . '/' . $img['filename'] . '?t=' . $img['modified'],
                            'size' => $img['filesize'],
                            'modified' => $img['modified'],
                            'dimensions' => $img['width'] . 'x' . $img['height'],
                            'hash' => $img['md5']
                        ];
                        $grouped[$img['filename']] = true;
                    }

                    $groups[] = [
                        'match_type' => 'similar',
                        'images' => $groupImages
                    ];

                    $totalDuplicates += count($simGroup) - 1;

                    // Space wasted = sum of all except largest
                    for ($i = 1; $i < count($simGroup); $i++) {
                        $spaceWasted += $simGroup[$i]['filesize'];
                    }
                }
            }
        }

        // Third: Find resized duplicates using perceptual hashing
        $remainingImages = [];
        foreach ($this->cache['images'] as $filename => $data) {
            if (!isset($grouped[$filename]) && !empty($data['perceptual_hash'])) {
                $remainingImages[] = array_merge(['filename' => $filename], $data);
            }
        }

        if (count($remainingImages) >= 2) {
            // Group by perceptual hash similarity
            $perceptualGroups = [];

            foreach ($remainingImages as $img) {
                $foundGroup = false;

                foreach ($perceptualGroups as &$group) {
                    $refImg = $group[0];

                    // Compare perceptual hashes (allow up to 20 bits difference out of 256)
                    if ($this->comparePerceptualHashes($img['perceptual_hash'], $refImg['perceptual_hash'], 20)) {
                        $group[] = $img;
                        $foundGroup = true;
                        break;
                    }
                }

                if (!$foundGroup) {
                    $perceptualGroups[] = [$img];
                }
            }

            // Add groups with 2+ images
            foreach ($perceptualGroups as $pGroup) {
                if (count($pGroup) >= 2) {
                    // Sort by filesize (largest first)
                    usort($pGroup, function($a, $b) {
                        return $b['filesize'] - $a['filesize'];
                    });

                    $groupImages = [];
                    foreach ($pGroup as $img) {
                        $groupImages[] = [
                            'filename' => $img['filename'],
                            'url' => '/grav-admin/' . $this->gallery_path . '/' . $img['filename'] . '?t=' . $img['modified'],
                            'size' => $img['filesize'],
                            'modified' => $img['modified'],
                            'dimensions' => $img['width'] . 'x' . $img['height'],
                            'hash' => $img['md5']
                        ];
                        $grouped[$img['filename']] = true;
                    }

                    $groups[] = [
                        'match_type' => 'resized',
                        'images' => $groupImages
                    ];

                    $totalDuplicates += count($pGroup) - 1;

                    // Space wasted = sum of all except largest
                    for ($i = 1; $i < count($pGroup); $i++) {
                        $spaceWasted += $pGroup[$i]['filesize'];
                    }
                }
            }
        }

        // Filter out ignored groups
        $filteredGroups = [];
        $filteredDuplicates = 0;
        $filteredSpaceWasted = 0;

        foreach ($groups as $group) {
            $filenames = array_map(function($img) { return $img['filename']; }, $group['images']);

            if (!$this->isGroupIgnored($filenames)) {
                $filteredGroups[] = $group;
                $filteredDuplicates += count($group['images']) - 1;

                // Calculate space wasted for this group
                usort($group['images'], function($a, $b) {
                    return $b['size'] - $a['size'];
                });
                for ($i = 1; $i < count($group['images']); $i++) {
                    $filteredSpaceWasted += $group['images'][$i]['size'];
                }
            }
        }

        return [
            'groups' => $filteredGroups,
            'total_duplicates' => $filteredDuplicates,
            'space_wasted' => $filteredSpaceWasted
        ];
    }
}