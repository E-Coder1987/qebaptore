<?php
namespace Grav\Plugin;
use Grav\Common\Plugin;

class GalleryApiPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return [
            'onPluginsInitialized' => ['onPluginsInitialized', 0]
        ];
    }

    public function onPluginsInitialized(): void
    {
        $uri = $this->grav['uri'];
        if ($uri->path() === '/grav-admin/gallery-api') {
            $page = $this->grav['page'];
            $gallery_path = GRAV_ROOT . '/user/pages/01.home/gallery';
            
            $images = [];
            if (is_dir($gallery_path)) {
                $files = scandir($gallery_path);
                foreach ($files as $file) {
                    if (preg_match('/\.(jpg|jpeg|png|gif)$/i', $file)) {
                        $images[] = $file;
                    }
                }
            }
            
            header('Content-Type: application/json');
            echo json_encode(['images' => $images]);
            exit;
        }
    }
}
