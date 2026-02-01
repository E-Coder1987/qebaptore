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
        
        if (in_array($action, ['upload', 'delete', 'rotate', 'rename'])) {
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
        
        if (!is_dir($path)) {
            mkdir($path, 0755, true);
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
                $uploaded[] = basename($targetFile);
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
}