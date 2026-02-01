<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/**
 * PDO Verbindung
 * Passe Host/DB/User/Pass an.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $host = 'localhost';
    $dbname = 'qebaptor';
    $user = 'qebaptor';
    $pass = 'y6MLJ8EJXoVHryPXFD6t';
    $charset = 'utf8mb4';

    $dsn = "mysql:host={$host};dbname={$dbname};charset={$charset}";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
