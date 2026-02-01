<?php
namespace Grav\Plugin;

use Grav\Common\Plugin;

class VisitedApiPlugin extends Plugin
{
    public static function getSubscribedEvents(): array
    {
        return [
            'onPluginsInitialized' => ['onPluginsInitialized', 0],
        ];
    }

    public function onPluginsInitialized(): void
    {
        if (PHP_SAPI === 'cli') {
            return;
        }

        $uri   = $this->grav['uri'];
        $route = rtrim((string)$uri->route(), '/'); // meist base-bereinigt
        $path  = rtrim((string)$uri->path(),  '/'); // kann /grav-admin/... sein

        // Robust matchen (Subfolder/Rewrite)
        $isApi =
            ($route === '/visited-api') ||
            ($path  === '/visited-api') ||
            ($path  === '/grav-admin/visited-api');

        if (!$isApi) {
            return;
        }

        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        $p = $_GET['p'] ?? '';

$routes = [
    'visited_list'   => __DIR__ . '/routes/visited_list.php',
    'visited_create' => __DIR__ . '/routes/visited_create.php',
    'visited_update' => __DIR__ . '/routes/visited_update.php',
    'visited_delete' => __DIR__ . '/routes/visited_delete.php',
    'visited_stats'  => __DIR__ . '/routes/visited_stats.php',  // ? NEU
    'debug'          => __DIR__ . '/routes/debug.php',
];

        if (!isset($routes[$p])) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Not found'], JSON_UNESCAPED_UNICODE);
            exit;
        }


// Öffentlich: Liste + Debug + Stats
if ($p === 'visited_list' || $p === 'debug' || $p === 'visited_stats') {  // ? Stats hinzufügen
    require $routes[$p];
    exit;
}

        // Login check (robust: Admin-Login ODER normal authenticated)
        $user = $this->grav['user'] ?? null;

        $isAuthed = false;
        if ($user) {
            try {
                if (method_exists($user, 'authenticated')) {
                    $isAuthed = (bool)$user->authenticated();
                } elseif (property_exists($user, 'authenticated')) {
                    $isAuthed = (bool)$user->authenticated;
                }
            } catch (\Throwable $e) {
                $isAuthed = false;
            }

            // Admin session / permissions zählen auch als "eingeloggt"
            try {
                if (!$isAuthed) {
                    $isAuthed = (bool)$user->authorize('admin.login') || (bool)$user->authorize('admin.super');
                }
            } catch (\Throwable $e) {
                // ignore
            }
        }

        if (!$isAuthed) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Bitte einloggen'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $GLOBALS['VISITED_API_USER'] = $user;

        require $routes[$p];
        exit;
    }
}
