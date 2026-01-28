<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['size'])) {
        $size = intval($_GET['size']);
        // Cap size to 100MB to prevent abuse
        if ($size > 104857600) $size = 104857600;

        header('Content-Type: application/octet-stream');
        header('Content-Length: ' . $size);
        header('Cache-Control: no-cache, no-store, must-revalidate');

        $chunkSize = 1024 * 1024; // 1MB
        $chunk = str_repeat('0', $chunkSize);

        for ($i = 0; $i < $size; $i += $chunkSize) {
            $currentChunkSize = min($chunkSize, $size - $i);
            if ($currentChunkSize < $chunkSize) {
                echo substr($chunk, 0, $currentChunkSize);
            } else {
                echo $chunk;
            }
            flush();
        }
    } else {
        echo "OK";
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = fopen("php://input", "r");
    $total = 0;
    while ($data = fread($input, 8192)) {
        $total += strlen($data);
    }
    fclose($input);
    echo json_encode(["status" => "success", "received" => $total]);
}
?>
