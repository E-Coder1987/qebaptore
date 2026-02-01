<?php
namespace Grav\Plugin;
use Grav\Common\Plugin;

class GalleryUploadPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return [
            'onPluginsInitialized' => ['onPluginsInitialized', 0]
        ];
    }

    public function onPluginsInitialized(): void
    {
        if ($this->isAdmin()) {
            return;
        }

        $uri = $this->grav['uri'];
        $route = $uri->route();

        if ($route === '/upload-gallery') {
            $this->handleUpload();
        }
    }

    private function handleUpload(): void
    {
        header('Content-Type: application/json');
        
        // Check Login
        $user = $this->grav['user'];
        if (!$user || !$user->authenticated) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Nicht angemeldet']);
            exit;
        }

        // Check File
        if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Keine Datei hochgeladen']);
            exit;
        }

        $file = $_FILES['photo'];
        
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, $allowedTypes)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Nur JPG, PNG und GIF erlaubt']);
            exit;
        }

        // Validate file size (max 10MB)
        if ($file['size'] > 10 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Datei zu groß (max 10MB)']);
            exit;
        }

        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid('photo_') . '_' . date('Y-m-d') . '.' . $extension;
        
        // Target directory
        $targetDir = GRAV_ROOT . '/user/pages/01.home/gallery';
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }
        
        $targetPath = $targetDir . '/' . $filename;

        // Move file
        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            echo json_encode([
                'ok' => true,
                'filename' => $filename,
                'message' => 'Foto erfolgreich hochgeladen!'
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Upload fehlgeschlagen']);
        }
        exit;
    }
}
