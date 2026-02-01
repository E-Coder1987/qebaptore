<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$user = $GLOBALS['VISITED_API_USER'] ?? null;
if (!$user) {
    json_out(['ok' => false, 'error' => 'Unauthorized'], 401);
}

$username = (string)($user->username ?? '');

$data = read_json_body();
if (!$data) {
    json_out(['ok' => false, 'error' => 'Invalid JSON'], 400);
}

$id = (int)($data['id'] ?? 0);
if ($id <= 0) {
    json_out(['ok' => false, 'error' => 'Missing id'], 400);
}

$isAdmin = false;
try {
    $isAdmin = (bool)$user->authorize('admin.super') || (bool)$user->authorize('admin.login');
} catch (Throwable $e) {
    $isAdmin = false;
}

try {
    $pdo = db();

    $stmt = $pdo->prepare("SELECT id, created_by FROM visited_places WHERE id = :id");
    $stmt->execute([':id' => $id]);
    $existing = $stmt->fetch();

    if (!$existing) {
        json_out(['ok' => false, 'error' => 'Not found'], 404);
    }

    $owner = (string)($existing['created_by'] ?? '');

    if (!$isAdmin) {
        if ($owner === '' || $owner !== $username) {
            json_out(['ok' => false, 'error' => 'Forbidden'], 403);
        }
    }

    $del = $pdo->prepare("DELETE FROM visited_places WHERE id = :id");
    $del->execute([':id' => $id]);

    json_out(['ok' => true], 200);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'DB error'], 500);
}
