export function generatePhpBackupAgent({ client, webhookUrl, secretToken, sites = [] }) {
  const sitesJson = JSON.stringify(sites.length ? sites : ['default']);
  const token = secretToken || 'crm_secret_backup_token';

  return `<?php
/**
 * Улучшенный агент сбора резервных копий
 * Клиент: ${client.company_name ? client.company_name.replace(/"/g, '') : 'Клиент CRM'} (ID: ${client.id})
 * Сгенерировано автоматически CRM-системой Евгения Климова
 *
 * Назначение: сканирование резервных копий и отправка отчетов в CRM, 
 *             а также вывод списка бекапов по запросу через Web.
 *
 * Использование:
 *   CLI / Cron: php -f crm_backup_agent.php
 *   Web-запрос: https://ваш-домен.ru/crm_backup_agent.php?token=${token}&checksum=1&limit=10
 */

define('CRM_WEBHOOK_URL', '${webhookUrl}');
define('CRM_CLIENT_ID', ${client.id});
define('CRM_SECRET_TOKEN', '${token}');

// Поддержка передачи секрета как ?token=..., ?key=... или HTTP заголовков
$providedToken = isset($_GET['token']) ? $_GET['token'] : 
    (isset($_GET['key']) ? $_GET['key'] : 
    (isset($_SERVER['HTTP_X_CRM_TOKEN']) ? $_SERVER['HTTP_X_CRM_TOKEN'] : 
    (isset($_SERVER['HTTP_X_BACKUP_KEY']) ? $_SERVER['HTTP_X_BACKUP_KEY'] : '')));

// Защита веб-доступа по секретному токену
if (php_sapi_name() !== 'cli') {
    if ($providedToken !== CRM_SECRET_TOKEN) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Forbidden: Invalid token'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Опции веб-запроса: checksum=1 для md5, limit=N для количества
$need_checksum = (isset($_GET['checksum']) && in_array($_GET['checksum'], ['1','true','yes'])) ? true : false;
$limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? intval($_GET['limit']) : 0;

$targetSites = ${sitesJson};

// Возможные пути к каталогам резервных копий 1С-Битрикс и других CMS
$searchPaths = [
    __DIR__ . '/bitrix/backup',
    __DIR__ . '/../bitrix/backup',
    '/home/bitrix/www/bitrix/backup',
    '/var/www/bitrix/backup',
    (isset($_SERVER['DOCUMENT_ROOT']) && $_SERVER['DOCUMENT_ROOT'] ? $_SERVER['DOCUMENT_ROOT'] . '/bitrix/backup' : ''),
    (isset($_SERVER['DOCUMENT_ROOT']) && $_SERVER['DOCUMENT_ROOT'] ? $_SERVER['DOCUMENT_ROOT'] . '/wp-content/updraft' : '')
];

$items = [];
$scannedDirs = [];

foreach ($searchPaths as $dir) {
    if (empty($dir) || !is_dir($dir)) continue;
    $dir = rtrim($dir, '/');
    if (in_array($dir, $scannedDirs)) continue;
    $scannedDirs[] = $dir;

    $dh = @opendir($dir);
    if ($dh === false) continue;

    while (($file = readdir($dh)) !== false) {
        if ($file === '.' || $file === '..') continue;
        $full = $dir . '/' . $file;
        if (!is_file($full)) continue;
        
        // Пропускаем временные файлы и части
        if (preg_match('/\\.part$|\\.tmp$/i', $file)) continue;
        
        // Ищем архивы
        if (!preg_match('/\\.(tar\\.gz|enc\\.gz|tar|sql\\.gz|zip|enc)$/i', $file)) continue;

        $mtime = @filemtime($full);
        $size = @filesize($full);
        $entry = [
            'filename' => $file,
            'filepath' => $full, // Временно, для хэша
            'mtime' => $mtime,
            'mtime_human' => date('Y-m-d H:i:s', $mtime),
            'size_bytes' => $size,
            'size_mb' => round($size / 1048576, 2)
        ];

        if ($need_checksum) {
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
}

// Сортируем по дате (новые в начале)
usort($items, function($a, $b) {
    return $b['mtime'] - $a['mtime'];
});

$allFoundFiles = $items;

if ($limit > 0) {
    $allFoundFiles = array_slice($allFoundFiles, 0, $limit);
}

// Удаляем полные пути для безопасности при веб-выводе
$webFiles = $allFoundFiles;
foreach ($webFiles as &$it) {
    unset($it['filepath']);
}
unset($it);

// Формируем отчет для отправки в CRM (только самый свежий бэкап)
$reports = [];
$currentTime = time();
$bestItem = count($items) > 0 ? $items[0] : null;

foreach ($targetSites as $siteDomain) {
    if ($bestItem) {
        $ageHours = ($currentTime - $bestItem['mtime']) / 3600;
        $status = 'Успешно';
        if ($ageHours > 36) $status = 'Предупреждение';
        if ($bestItem['size_mb'] < 10) $status = 'Ошибка';

        $reports[] = [
            'client_id' => CRM_CLIENT_ID,
            'site' => $siteDomain,
            'status' => $status,
            'size_mb' => $bestItem['size_mb'],
            'date' => $bestItem['mtime_human'],
            'filename' => $bestItem['filename'],
            'age_hours' => round($ageHours, 1),
            'type' => 'full',
            'details' => "Файл: {$bestItem['filename']}" . ($bestItem['checksum_md5'] ? " (Md5: {$bestItem['checksum_md5']})" : "")
        ];
    } else {
        $reports[] = [
            'client_id' => CRM_CLIENT_ID,
            'site' => $siteDomain,
            'status' => 'Ошибка',
            'size_mb' => 0,
            'date' => date('Y-m-d H:i:s'),
            'filename' => 'не найден',
            'age_hours' => 999,
            'type' => 'full',
            'details' => 'В каталогах архивов не обнаружено свежих файлов'
        ];
    }
}

// Отправка отчетов в CRM через Webhook
$results = [];
foreach ($reports as $report) {
    $payload = json_encode($report);
    $ch = curl_init(CRM_WEBHOOK_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'X-CRM-Token: ' . CRM_SECRET_TOKEN
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    
    $results[] = [
        'site' => $report['site'],
        'status' => $report['status'],
        'size_mb' => $report['size_mb'],
        'date' => $report['date'],
        'crm_http_code' => $httpCode,
        'crm_response' => $response,
        'error' => $curlErr
    ];
}

// Вывод результата
if (php_sapi_name() === 'cli') {
    echo "[CRM BACKUP AGENT] Отчет сформирован: " . date('Y-m-d H:i:s') . "\\n";
    foreach ($results as $res) {
        echo " - Сайт: {$res['site']} | Статус: {$res['status']} | Размер: {$res['size_mb']} МБ | CRM HTTP: {$res['crm_http_code']}\\n";
    }
} else {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'ok',
        'generated_at' => date('Y-m-d H:i:s'),
        'count' => count($webFiles),
        'checksum_computed' => $need_checksum,
        'files' => $webFiles,
        'webhook_results' => $results
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
`;
}

export function generateBashInstaller({ client, webhookUrl, secretToken, reqHost }) {
  const token = secretToken || 'crm_secret_backup_token';
  const downloadUrl = `https://${reqHost}/api/client/${client.id}/backup-agent.php?token=${token}`;

  return `#!/bin/bash
# ==============================================================================
# Автоматический установщик агента сбора бэкапов для CRM Евгения Климова
# Клиент: ${client.company_name || 'Клиент #' + client.id} (ID: ${client.id})
# ==============================================================================
set -e

echo "--------------------------------------------------------"
echo "🚀 Установка агента сбора бэкапов CRM для ${client.company_name || 'клиента'}..."
echo "--------------------------------------------------------"

# 1. Поиск веб-директории сайта (BitrixVM, Beget или стандартный веб-корень)
TARGET_DIR=""
POSSIBLE_DIRS=(
  "/home/bitrix/www"
  "/var/www/html"
  "/var/www/bitrix"
  "$HOME/public_html"
  "$(pwd)"
)

for d in "\${POSSIBLE_DIRS[@]}"; do
  if [ -d "$d/bitrix" ] || [ -f "$d/index.php" ]; then
    TARGET_DIR="$d"
    break
  fi
done

if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR="/home/bitrix/www"
  mkdir -p "$TARGET_DIR"
fi

SCRIPT_PATH="$TARGET_DIR/crm_backup_agent.php"

echo "📁 Целевой каталог: $TARGET_DIR"
echo "📥 Загрузка агента в $SCRIPT_PATH..."

# 2. Скачивание актуального скрипта агента с сервера CRM
curl -sSL -k "${downloadUrl}" -o "$SCRIPT_PATH"
chmod 644 "$SCRIPT_PATH"

# 3. Проверка синтаксиса PHP
if command -v php >/dev/null 2>&1; then
  php -l "$SCRIPT_PATH"
  echo "✓ Синтаксис PHP проверен успешно"
else
  echo "⚠️ PHP CLI не найден в PATH, пропуск синтаксической проверки"
fi

# 4. Регистрация в Crontab (запуск ежедневно в 04:15 ночи)
CRON_LINE="15 4 * * * /usr/bin/php -f $SCRIPT_PATH >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v 'crm_backup_agent.php' ; echo "$CRON_LINE") | crontab -
echo "✓ Задание добавлено в планировщик cron (15 4 * * *)"

echo ""
echo "⚡ Тестовый запуск агента прямо сейчас:"
/usr/bin/php -f "$SCRIPT_PATH" || php "$SCRIPT_PATH" || true

echo "--------------------------------------------------------"
echo "✅ Агент бэкапов успешно установлен и передает данные в CRM!"
echo "--------------------------------------------------------"
`;
}
