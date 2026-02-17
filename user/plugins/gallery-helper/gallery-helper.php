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
        $this->grav['twig']->twig()->addFunction(
            new \Twig\TwigFunction('list_gallery_images', [$this, 'listGalleryImages'])
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

    public function listGalleryImages($path)
    {
        $fullPath = GRAV_ROOT . '/' . ltrim($path, '/');
        $compressedPath = $fullPath . '/compressed';
        $images = [];

        if (is_dir($fullPath)) {
            $files = glob($fullPath . '/*.{jpg,jpeg,png,gif,JPG,JPEG,PNG,GIF}', GLOB_BRACE);

            foreach ($files as $file) {
                $filename = basename($file);
                $filenameNoExt = pathinfo($filename, PATHINFO_FILENAME);
                $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

                // GIFs must always use the original to preserve animation
                $isGif = ($ext === 'gif');

                // Check if compressed version exists (skip for GIFs)
                $compressedFile = $compressedPath . '/' . $filenameNoExt . '.jpg';
                $hasCompressed = !$isGif && file_exists($compressedFile);

                // Get actual image dimensions
                $dimensions = @getimagesize($file);
                $width = $dimensions ? $dimensions[0] : 1920;
                $height = $dimensions ? $dimensions[1] : 1080;

                $images[] = [
                    'filename' => $filename,
                    'original' => $filename,
                    'display' => $hasCompressed ? 'compressed/' . $filenameNoExt . '.jpg' : $filename,
                    'has_compressed' => $hasCompressed,
                    'size' => filesize($file),
                    'modified' => filemtime($file),
                    'width' => $width,
                    'height' => $height
                ];
            }

            // Sort by modification time (newest first)
            usort($images, function($a, $b) {
                return $b['modified'] - $a['modified'];
            });
        }

        return $images;
    }
}
