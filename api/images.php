<?php
/**
 * Image upload API for Eatinator
 * Stores food images with 24h retention - works with static hosting
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$dataDir = __DIR__ . '/images_data';
$maxFileSize = 5 * 1024 * 1024; // 5MB max file size
$retentionHours = 24;
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Ensure data directory exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// Utility functions
function sanitizeKey($key) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
}

function getImageDir($dishKey) {
    global $dataDir;
    return $dataDir . '/' . sanitizeKey($dishKey);
}

function generateImageKey($dishName, $menuType, $date) {
    return "img_{$date}_" . sanitizeKey($dishName) . "_" . sanitizeKey($menuType);
}

function cleanupOldImages() {
    global $dataDir, $retentionHours;
    
    $cutoffTime = time() - ($retentionHours * 3600);
    $dirs = glob($dataDir . '/img_*', GLOB_ONLYDIR);
    
    foreach ($dirs as $dir) {
        // Check if directory is older than retention period
        if (filemtime($dir) < $cutoffTime) {
            // Remove all files in directory
            $files = glob($dir . '/*');
            foreach ($files as $file) {
                unlink($file);
            }
            rmdir($dir);
        }
    }
}

function saveImageMetadata($dishKey, $filename, $originalName, $uploadTime) {
    $imageDir = getImageDir($dishKey);
    $metadataFile = $imageDir . '/metadata.json';
    
    $metadata = [];
    if (file_exists($metadataFile)) {
        $metadata = json_decode(file_get_contents($metadataFile), true) ?: [];
    }
    
    $metadata[] = [
        'filename' => $filename,
        'originalName' => $originalName,
        'uploadTime' => $uploadTime,
        'timestamp' => date('Y-m-d H:i:s', $uploadTime)
    ];
    
    return file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT)) !== false;
}

function getImageMetadata($dishKey) {
    $imageDir = getImageDir($dishKey);
    $metadataFile = $imageDir . '/metadata.json';
    
    if (!file_exists($metadataFile)) {
        return [];
    }
    
    return json_decode(file_get_contents($metadataFile), true) ?: [];
}

// Main request handling
try {
    // Clean up old images on every request
    cleanupOldImages();
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Check if this is a request to view/serve an image file
        if (isset($_GET['action']) && $_GET['action'] === 'view') {
            // Serve image file
            $dishKey = $_GET['key'] ?? '';
            $filename = $_GET['file'] ?? '';
            
            if (empty($dishKey) || empty($filename)) {
                throw new Exception('Key and filename are required');
            }
            
            $imageDir = getImageDir($dishKey);
            $filePath = $imageDir . '/' . $filename;
            
            if (!file_exists($filePath)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Image not found']);
                exit();
            }
            
            // Determine content type
            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $contentType = 'image/jpeg'; // default
            
            switch ($extension) {
                case 'png':
                    $contentType = 'image/png';
                    break;
                case 'webp':
                    $contentType = 'image/webp';
                    break;
                case 'jpg':
                case 'jpeg':
                    $contentType = 'image/jpeg';
                    break;
            }
            
            header('Content-Type: ' . $contentType);
            header('Content-Length: ' . filesize($filePath));
            header('Cache-Control: public, max-age=86400'); // Cache for 1 day
            
            readfile($filePath);
            exit();
        }
        
        // Get images for a specific dish
        $dishKey = $_GET['key'] ?? '';
        if (empty($dishKey)) {
            throw new Exception('Dish key is required');
        }
        
        $metadata = getImageMetadata($dishKey);
        $images = [];
        
        foreach ($metadata as $item) {
            $imageDir = getImageDir($dishKey);
            $filePath = $imageDir . '/' . $item['filename'];
            
            if (file_exists($filePath)) {
                $images[] = [
                    'filename' => $item['filename'],
                    'originalName' => $item['originalName'],
                    'uploadTime' => $item['uploadTime'],
                    'timestamp' => $item['timestamp'],
                    'url' => '/api/images.php?action=view&key=' . urlencode($dishKey) . '&file=' . urlencode($item['filename'])
                ];
            }
        }
        
        echo json_encode(['success' => true, 'images' => $images]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Handle image upload
        $dishKey = $_POST['key'] ?? '';
        if (empty($dishKey)) {
            throw new Exception('Dish key is required');
        }
        
        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('No valid image uploaded');
        }
        
        $file = $_FILES['image'];
        
        // Validate file size
        if ($file['size'] > $maxFileSize) {
            throw new Exception('File too large. Maximum size is 5MB');
        }
        
        // Validate file type
        if (!in_array($file['type'], $allowedTypes)) {
            throw new Exception('Invalid file type. Only JPEG, PNG, and WebP are allowed');
        }
        
        // Create dish directory
        $imageDir = getImageDir($dishKey);
        if (!is_dir($imageDir)) {
            mkdir($imageDir, 0755, true);
        }
        
        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = time() . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
        $targetPath = $imageDir . '/' . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new Exception('Failed to save image');
        }
        
        // Save metadata
        if (!saveImageMetadata($dishKey, $filename, $file['name'], time())) {
            throw new Exception('Failed to save image metadata');
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Image uploaded successfully',
            'filename' => $filename
        ]);
        
    } else {
        throw new Exception('Method not allowed');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>