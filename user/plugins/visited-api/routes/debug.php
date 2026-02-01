<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

$user = $GLOBALS['VISITED_API_USER'] ?? null;

$uname = '';
$isAuthed = false;

if ($user) {
    $uname = (string)($user->username ?? '');
    if (method_exists($user, 'authenticated')) $isAuthed = (bool)$user->authenticated();
    elseif (property_exists($user, 'authenticated')) $isAuthed = (bool)$user->authenticated;
}

json_out([
    'ok' => true,
    'route_debug' => [
        'cookie_keys' => array_keys($_COOKIE),
        'php_session_name' => session_name(),
        'php_session_id' => session_id(),
    ],
    'user' => ['username' => $uname, 'authenticated' => $isAuthed],
], 200);
