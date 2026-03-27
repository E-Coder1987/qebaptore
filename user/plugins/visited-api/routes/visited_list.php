<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $pdo = db();

    // Eingeloggte User sehen auch geplante zukuenftige Hangouts
    $isAuthed = ($GLOBALS['VISITED_API_USER'] ?? null) !== null;

    // Geplante Hangouts in der Zukunft nur fuer eingeloggte User sichtbar
    $plannedFilter = $isAuthed ? "" : "AND (planned = 0 OR visited_at < CURDATE())";

    // Hauptabfrage
    $stmt = $pdo->query("
        SELECT
            id,
            visited_at,
            label,
            custom_label,
            lat,
            lng,
            address,
            notes,
            osm_type,
            osm_id,
            created_by,
            created_at,
            planned
        FROM visited_places
        WHERE 1=1 {$plannedFilter}
        ORDER BY visited_at DESC, id DESC
        LIMIT 2000
    ");

    $items = $stmt->fetchAll();

    // Besuche zaehlen basierend auf GPS-Proximity (ca. 50m Radius)
    // 0.0005 Grad ca. 50 Meter
    // Geplante zukuenftige Hangouts werden in der Besuchsanzahl nicht gezaehlt (fuer oeffentliche Ansicht)
    foreach ($items as &$item) {
        $lat = (float)$item['lat'];
        $lng = (float)$item['lng'];
        $item['planned'] = (int)($item['planned'] ?? 0);

        $countStmt = $pdo->prepare("
            SELECT COUNT(*) as visit_count
            FROM visited_places
            WHERE ABS(lat - :lat) < 0.0005
              AND ABS(lng - :lng) < 0.0005
              AND (planned = 0 OR visited_at <= CURDATE())
        ");

        $countStmt->execute([
            'lat' => $lat,
            'lng' => $lng
        ]);

        $count = $countStmt->fetch();
        $item['visit_count'] = (int)$count['visit_count'];
    }
    unset($item); // Reference break

    json_out(['ok' => true, 'items' => $items], 200);

} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => 'DB error'], 500);
}
