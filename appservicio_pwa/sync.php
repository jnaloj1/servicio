<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Obtener y sanear el ID de usuario
$userId = $_GET['userId'] ?? 'default';
$userId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $userId);
$file = "datos_{$userId}.json";

// Manejo de peticiones OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Recibir datos (POST) - Guardar copia de seguridad en el servidor
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $json = file_get_contents('php://input');
    if ($json) {
        if (file_put_contents($file, $json)) {
            echo json_encode(["status" => "ok", "message" => "Datos sincronizados para usuario $userId"]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo escribir el archivo en el servidor"]);
        }
    } else {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "No se recibieron datos"]);
    }
}

// Enviar datos (GET) - Recuperar datos del servidor
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($file)) {
        echo file_get_contents($file);
    } else {
        echo json_encode(["servicios" => [], "settings" => []]);
    }
}
?>
