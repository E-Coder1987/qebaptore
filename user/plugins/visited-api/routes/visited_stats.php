<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

try {
    $pdo = db();
    
    // Optional: Zeitraum-Filter aus Query-Parametern
    $dateFrom = $_GET['date_from'] ?? null;
    $dateTo = $_GET['date_to'] ?? null;
    
    $whereClause = "1=1";
    $params = [];
    
    if ($dateFrom && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $whereClause .= " AND visited_at >= :date_from";
        $params['date_from'] = $dateFrom;
    }
    
    if ($dateTo && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $whereClause .= " AND visited_at <= :date_to";
        $params['date_to'] = $dateTo;
    }
    
    // Gruppiere nach GPS-Koordinaten (50m Radius = 0.0005 Grad)
    // und hole alle relevanten Statistiken
    $stmt = $pdo->prepare("
        SELECT
            MIN(id) as id,
            MIN(custom_label) as custom_label,
            MIN(label) as label,
            MIN(address) as address,
            ROUND(AVG(lat), 6) as lat,
            ROUND(AVG(lng), 6) as lng,
            COUNT(*) as visit_count,
            MIN(visited_at) as first_visit,
            MAX(visited_at) as last_visit,
            GROUP_CONCAT(visited_at ORDER BY visited_at SEPARATOR ',') as all_visits
        FROM visited_places
        WHERE {$whereClause}
        GROUP BY 
            ROUND(lat / 0.0005),
            ROUND(lng / 0.0005)
        ORDER BY visit_count DESC, last_visit DESC
    ");
    
    $stmt->execute($params);
    $stats = $stmt->fetchAll();
    
    // Bereinige die Daten
    foreach ($stats as &$stat) {
        $stat['visit_count'] = (int)$stat['visit_count'];
        $stat['lat'] = (float)$stat['lat'];
        $stat['lng'] = (float)$stat['lng'];
        
        // Optional: All visits als Array
        if (!empty($stat['all_visits'])) {
            $stat['all_visits'] = explode(',', $stat['all_visits']);
        } else {
            $stat['all_visits'] = [];
        }
    }
    unset($stat);
    
    json_out(['ok' => true, 'stats' => $stats], 200);
    
} catch (Throwable $e) {
    error_log("visited_stats error: " . $e->getMessage());
    json_out(['ok' => false, 'error' => 'DB error'], 500);
}