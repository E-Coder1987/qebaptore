<?php
namespace Grav\Plugin;
use Grav\Common\Plugin;

class GalleryHelperPlugin extends Plugin
{
    public static function getSubscribedEvents()
    {
        return [
            'onTwigExtensions' => ['onTwigExtensions', 0]
        ];
    }

    public function onTwigExtensions()
    {
        $this->grav['twig']->twig()->addFunction(
            new \Twig\TwigFunction('list_images', [$this, 'listImages'])
        );
    }

    public function listImages($path)
    {
        $fullPath = GRAV_ROOT . '/' . ltrim($path, '/');
        $images = [];
        
        if (is_dir($fullPath)) {
            $files = glob($fullPath . '/*.{jpg,jpeg,png,gif,JPG,JPEG,PNG,GIF}', GLOB_BRACE);
            foreach ($files as $file) {
                $images[] = basename($file);
            }
            sort($images);
        }
        
        return $images;
    }
}
