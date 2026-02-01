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

$visited_at   = array_key_exists('visited_at', $data) ? (string)$data['visited_at'] : null;
$label        = array_key_exists('label', $data) ? trim((string)$data['label']) : null;
$custom_label = array_key_exists('custom_label', $data) ? trim((string)$data['custom_label']) : null;
$notes        = array_key_exists('notes', $data) ? trim((string)$data['notes']) : null;

if ($visited_at !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $visited_at)) {
    json_out(['ok' => false, 'error' => 'Invalid date'], 400);
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

    if (!$isAdmin && ($owner === '' || $owner !== $username)) {
        json_out(['ok' => false, 'error' => 'Forbidden'], 403);
    }

    $sets = [];
    $params = [':id' => $id];

    if ($visited_at !== null) {
        $sets[] = "visited_at = :visited_at";
        $params[':visited_at'] = $visited_at;
    }

    if ($label !== null) {
        if ($label === '') json_out(['ok' => false, 'error' => 'Label cannot be empty'], 400);
        $sets[] = "label = :label";
        $params[':label'] = $label;
    }

    if ($custom_label !== null) {
        if ($custom_label === '') json_out(['ok' => false, 'error' => 'Name cannot be empty'], 400);
        $sets[] = "custom_label = :custom_label";
        $params[':custom_label'] = $custom_label;
    }

    if ($notes !== null) {
        $sets[] = "notes = :notes";
        $params[':notes'] = ($notes === '' ? null : $notes);
    }

    if (!$sets) {
        json_out(['ok' => false, 'error' => 'Nothing to update'], 400);
    }

    $sql = "UPDATE visited_places SET " . implode(", ", $sets) . " WHERE id = :id";
    $upd = $pdo->prepare($sql);
    $upd->execute($params);

    json_out(['ok' => true], 200);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'DB error'], 500);
}
