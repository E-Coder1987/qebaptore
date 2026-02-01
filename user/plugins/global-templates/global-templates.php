<?php
namespace Grav\Plugin;

use Grav\Common\Plugin;

class GlobalTemplatesPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return [
            'onTwigTemplatePaths' => ['onTwigTemplatePaths', 1000], // hohe Priorität
        ];
    }

    public function onTwigTemplatePaths(): void
    {
        $locator = $this->grav['locator'];
        $path = $locator->findResource('user://templates', true, true);

        if ($path) {
            // ganz vorne einfügen => hat Vorrang vor Theme
            array_unshift($this->grav['twig']->twig_paths, $path);
        }
    }
}

