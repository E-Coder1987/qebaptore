<?php
$gallery_dir = __DIR__ . '/gallery';
$images = [];

if (is_dir($gallery_dir)) {
    $files = scandir($gallery_dir);
    foreach ($files as $file) {
        if (preg_match('/\.(jpg|jpeg|png|gif)$/i', $file)) {
            $images[] = $file;
        }
    }
    sort($images);
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode($images);
?>
