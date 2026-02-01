<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

/**
 * User kommt aus visited-api.php (Index-Router)
 */
$user = $GLOBALS['VISITED_API_USER'] ?? null;
if (!$user) {
    json_out(['ok' => false, 'error' => 'Unauthorized'], 401);
}

$username = (string)($user->username ?? '');

/**
 * JSON-Body lesen (Index-API -> php://input ist korrekt)
 */
$data = read_json_body();
if (!$data || !is_array($data)) {
    json_out(['ok' => false, 'error' => 'Invalid JSON'], 400);
}

/**
 * Felder
 */
$visited_at   = (string)($data['visited_at'] ?? '');
$label        = trim((string)($data['label'] ?? ''));
$custom_label = trim((string)($data['custom_label'] ?? ''));
$lat          = $data['lat'] ?? null;
$lng          = $data['lng'] ?? null;
$address      = trim((string)($data['address'] ?? ''));
$notes        = trim((string)($data['notes'] ?? ''));
$osm_type     = $data['osm_type'] ?? null;
$osm_id       = $data['osm_id'] ?? null;

/**
 * Validierung
 */
if ($visited_at === '' || $label === '' || $lat === null || $lng === null) {
    json_out(['ok' => false, 'error' => 'Missing fields'], 400);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $visited_at)) {
    json_out(['ok' => false, 'error' => 'Invalid date'], 400);
}

// Fallback
if ($custom_label === '') {
    $custom_label = $label;
}

try {
    $pdo = db();

    $stmt = $pdo->prepare("
        INSERT INTO visited_places
          (visited_at, label, custom_label, lat, lng, address, notes, osm_type, osm_id, created_by, created_at)
        VALUES
          (:visited_at, :label, :custom_label, :lat, :lng, :address, :notes, :osm_type, :osm_id, :created_by, NOW())
    ");

    $stmt->execute([
        ':visited_at'   => $visited_at,
        ':label'        => $label,
        ':custom_label' => $custom_label,
        ':lat'          => (string)$lat,
        ':lng'          => (string)$lng,
        ':address'      => $address,
        ':notes'        => $notes !== '' ? $notes : null,
        ':osm_type'     => ($osm_type !== '' && $osm_type !== null) ? (string)$osm_type : null,
        ':osm_id'       => ($osm_id !== '' && $osm_id !== null) ? (string)$osm_id : null,
        ':created_by'   => $username !== '' ? $username : null,
    ]);

    json_out(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 200);

} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'DB error'], 500);
}
