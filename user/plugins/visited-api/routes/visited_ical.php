<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

// Content-Type fuer iCal ueberschreiben (visited-api.php setzt json)
header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: inline; filename="hangouts.ics"');

/**
 * iCal-Textfelder escapen (RFC 5545)
 */
function ical_escape(string $s): string {
    return str_replace(['\\', ';', ',', "\r\n", "\n", "\r"], ['\\\\', '\;', '\,', '\n', '\n', '\n'], $s);
}

/**
 * iCal-Zeilenumbruch bei 75 Zeichen (RFC 5545 Pflicht)
 */
function ical_fold(string $line): string {
    $out = '';
    while (strlen($line) > 75) {
        $out .= substr($line, 0, 75) . "\r\n ";
        $line = substr($line, 75);
    }
    return $out . $line;
}

try {
    $pdo = db();

    // Alle Hangouts inkl. geplanter holen
    $stmt = $pdo->query("
        SELECT id, visited_at, custom_label, label, address, notes, lat, lng, planned, created_at
        FROM visited_places
        ORDER BY visited_at ASC, id ASC
    ");
    $items = $stmt->fetchAll();

    $domain  = $_SERVER['HTTP_HOST'] ?? 'qebaptore.local';
    $calName = 'Qebaptore Hangouts';

    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Qebaptore//Hangouts//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' . $calName,
        'X-WR-TIMEZONE:Europe/Vienna',
        'X-WR-CALDESC:Alle Qebaptore Hangouts inkl. geplanter Termine',
    ];

    foreach ($items as $item) {
        $uid       = 'hangout-' . $item['id'] . '@' . $domain;
        $dateStart = str_replace('-', '', (string)$item['visited_at']);
        $dateEnd   = date('Ymd', strtotime($item['visited_at'] . ' +1 day'));

        $name    = trim((string)($item['custom_label'] ?: $item['label'] ?: ''));
        $summary = $item['planned'] ? 'Geplant: ' . $name : $name;

        $descParts = [];
        if (!empty($item['notes']))   $descParts[] = $item['notes'];
        if (!empty($item['address'])) $descParts[] = $item['address'];
        $description = implode('\n', $descParts);

        // DTSTAMP: Erstellungszeitpunkt in UTC
        if (!empty($item['created_at'])) {
            $dt = new DateTime($item['created_at']);
            $dt->setTimezone(new DateTimeZone('UTC'));
            $dtstamp = $dt->format('Ymd\THis\Z');
        } else {
            $dtstamp = gmdate('Ymd\THis\Z');
        }

        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:' . $uid;
        $lines[] = 'DTSTAMP:' . $dtstamp;
        $lines[] = 'DTSTART;VALUE=DATE:' . $dateStart;
        $lines[] = 'DTEND;VALUE=DATE:' . $dateEnd;
        $lines[] = 'SUMMARY:' . ical_escape($summary);

        if ($description !== '') {
            $lines[] = 'DESCRIPTION:' . $description; // bereits mit \n escapten Zeilenumbruechen
        }

        if (!empty($item['address'])) {
            $lines[] = 'LOCATION:' . ical_escape((string)$item['address']);
        }

        if (!empty($item['lat']) && !empty($item['lng'])) {
            $lines[] = 'GEO:' . (float)$item['lat'] . ';' . (float)$item['lng'];
        }

        // Geplante Termine als TRANSPARENT markieren (belegen keine Zeit im Kalender)
        if ($item['planned']) {
            $lines[] = 'TRANSP:TRANSPARENT';
        }

        $lines[] = 'END:VEVENT';
    }

    $lines[] = 'END:VCALENDAR';

    // Zeilenumbrueche gemaess RFC 5545 (CRLF) + Zeilenlaenge max 75 Zeichen
    foreach ($lines as $line) {
        echo ical_fold($line) . "\r\n";
    }

} catch (Throwable $e) {
    // Leerer Kalender als Fallback
    echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Qebaptore//Hangouts//DE\r\nEND:VCALENDAR\r\n";
}
