<?php
// Поменяйте секрет на уникальный и храните в безопасном месте
$secret = 'CHANGE_THIS_SECRET';

// Поддержка передачи секрета как ?key=... или HTTP заголовка X-Backup-Key
$provided = isset($_GET['key']) ? $_GET['key'] : (isset($_SERVER['HTTP_X_BACKUP_KEY']) ? $_SERVER['HTTP_X_BACKUP_KEY'] : null);
if (!$provided || $provided !== $secret) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Каталог с бекапами — по умолчанию /bitrix/backup рядом с document root.
// При необходимости измените путь.
$backup_dir = rtrim($_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) . '/bitrix/backup/';

// Опции: checksum=1 чтобы вычислять md5 (может быть медленно для больших файлов)
//         limit=N — ограничение количества возвращаемых файлов (по умолчанию 0 = все)
$need_checksum = (isset($_GET['checksum']) && in_array($_GET['checksum'], ['1','true','yes'])) ? true : false;
$limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? intval($_GET['limit']) : 0;

// Безопасная проверка каталога
if (!is_dir($backup_dir)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Backup directory not found', 'path' => $backup_dir], JSON_UNESCAPED_UNICODE);
    exit;
}

// Собираем список файлов, игнорируем скрытые и временные (начинающиеся с .)
$items = [];
$dh = opendir($backup_dir);
if ($dh === false) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Cannot open backup directory'], JSON_UNESCAPED_UNICODE);
    exit;
}

while (($file = readdir($dh)) !== false) {
    if ($file === '.' || $file === '..') continue;
    $full = $backup_dir . $file;
    if (!is_file($full)) continue;
    // optional: skip files that look like temp (.part, .tmp)
    if (preg_match('/\.part$|\.tmp$/i', $file)) continue;
    $mtime = filemtime($full);
    $size = filesize($full);
    $entry = [
        'filename' => $file,
        'filepath' => $full, // для дебага — можно убрать, если не нужно
        'mtime' => $mtime,
        'mtime_human' => date('Y-m-d H:i:s', $mtime),
        'size_bytes' => $size,
        'size_mb' => round($size/1024/1024, 2),
    ];
    if ($need_checksum) {
        // вычисляем md5 файла; для больших файлов это может занять время
        try {
            $entry['checksum_md5'] = md5_file($full);
        } catch (Exception $e) {
            $entry['checksum_md5'] = null;
        }
    } else {
        $entry['checksum_md5'] = null;
    }
    $items[] = $entry;
}
closedir($dh);

// Отсортируем по времени (новые в начале)
usort($items, function($a, $b){
    return $b['mtime'] - $a['mtime'];
});

// Применим лимит если задан
if ($limit > 0) {
    $items = array_slice($items, 0, $limit);
}

// Сформируем аккуратный вывод: не обязательно отдавать filepath в продакшне
foreach ($items as &$it) {
    // при желании скрыть полный путь:
    unset($it['filepath']);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'status' => 'ok',
    'generated_at' => date('Y-m-d H:i:s'),
    'count' => count($items),
    'checksum_computed' => $need_checksum,
    'files' => $items
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
exit;
?>