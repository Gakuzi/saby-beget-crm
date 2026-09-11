/**
 * Generator for standalone PHP and Bash backup agents for client sites
 */

export function generatePhpBackupAgent({ client, webhookUrl, secretToken, sites = [] }) {
  const domains = (sites && sites.length > 0) 
    ? sites.map(s => typeof s === 'string' ? s : s.domain).filter(Boolean)
    : (client.sites ? client.sites.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) : ['site.ru']);

  const sitesJson = JSON.stringify(domains);
  const token = secretToken || 'crm_secret_backup_token';

  return `<?php
/**
 * CRM Backup Monitoring & Reporting Agent
 * Клиент: ${client.company_name ? client.company_name.replace(/"/g, '') : 'Клиент CRM'} (ID: ${client.id})
 * Сгенерировано автоматически CRM-системой Евгения Климова
 * 
 * Назначение: сканирование резервных копий 1С-Битрикс и отправка отчетов в CRM
 * Использование:
 *   CLI / Cron: php -f crm_backup_agent.php
 *   Web-запрос: https://ваш-домен.ru/crm_backup_agent.php?token=${token}
 */

// Конфигурация агента
define('CRM_WEBHOOK_URL', '${webhookUrl}');
define('CRM_CLIENT_ID', ${client.id});
define('CRM_SECRET_TOKEN', '${token}');

// Защита веб-доступа по секретному токену
if (php_sapi_name() !== 'cli') {
    $providedToken = isset($_GET['token']) ? $_GET['token'] : (isset($_SERVER['HTTP_X_CRM_TOKEN']) ? $_SERVER['HTTP_X_CRM_TOKEN'] : '');
    if ($providedToken !== CRM_SECRET_TOKEN) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Доступ запрещен: неверный токен']);
        exit;
    }
}

// Список доменов/сайтов клиента для мониторинга
$targetSites = ${sitesJson};

// Возможные пути к каталогам резервных копий 1С-Битрикс
$searchPaths = [
    __DIR__ . '/bitrix/backup',
    __DIR__ . '/../bitrix/backup',
    '/home/bitrix/www/bitrix/backup',
    '/var/www/bitrix/backup',
    $_SERVER['DOCUMENT_ROOT'] . '/bitrix/backup'
];

$reports = [];
$currentTime = time();

foreach ($targetSites as $siteDomain) {
    $bestFile = null;
    $bestMtime = 0;
    $bestSize = 0;

    // Сканируем каталоги бэкапов
    foreach ($searchPaths as $dir) {
        if (!is_dir($dir)) continue;
        
        $files = @scandir($dir);
        if (!$files) continue;

        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            // Ищем архивы Битрикс (.tar.gz, .enc.gz, .tar, .sql.gz, .zip)
            if (preg_match('/\\.(tar\\.gz|enc\\.gz|tar|sql\\.gz|zip|enc)$/i', $f)) {
                $fullPath = rtrim($dir, '/') . '/' . $f;
                $mtime = @filemtime($fullPath);
                if ($mtime > $bestMtime) {
                    $bestMtime = $mtime;
                    $bestFile = $f;
                    $bestSize = @filesize($fullPath);
                }
            }
        }
    }

    if ($bestFile && $bestMtime > 0) {
        $ageHours = ($currentTime - $bestMtime) / 3600;
        $sizeMb = round($bestSize / 1048576, 1);
        $dateStr = date('Y-m-d H:i:s', $bestMtime);

        $status = 'Успешно';
        if ($ageHours > 36) {
            $status = 'Предупреждение'; // Бэкап старше 36 часов
        }
        if ($sizeMb < 10) {
            $status = 'Ошибка'; // Подозрительно маленький архив
        }

        $reports[] = [
            'client_id' => CRM_CLIENT_ID,
            'site' => $siteDomain,
            'status' => $status,
            'size_mb' => $sizeMb,
            'date' => $dateStr,
            'filename' => $bestFile,
            'age_hours' => round($ageHours, 1),
            'type' => 'full',
            'details' => "Файл: {$bestFile} (" . date('d.m.Y H:i', $bestMtime) . ")"
        ];
    } else {
        // Если архив на диске не найден
        $reports[] = [
            'client_id' => CRM_CLIENT_ID,
            'site' => $siteDomain,
            'status' => 'Ошибка',
            'size_mb' => 0,
            'date' => date('Y-m-d H:i:s'),
            'filename' => 'не найден',
            'age_hours' => 999,
            'type' => 'full',
            'details' => 'В каталоге /bitrix/backup/ свежих архивов не обнаружено'
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
        'ok' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'results' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
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
