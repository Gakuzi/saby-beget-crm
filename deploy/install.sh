#!/bin/bash
# Скрипт автоматической установки CRM на Ubuntu/Debian VPS
set -e

echo "================================================"
echo "Установка Saby & Beget CRM на ваш VPS сервер"
echo "================================================"

if [ "$EUID" -ne 0 ]; then 
  echo "Пожалуйста, запустите скрипт от имени root (sudo ./install.sh)"
  exit 1
fi

echo "-> Установка Docker и Git..."
apt-get update >/dev/null 2>&1
apt-get install -y git curl >/dev/null 2>&1

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

INSTALL_DIR="/opt/saby-crm"
mkdir -p $INSTALL_DIR

echo "Введите ссылку на ваш GitHub репозиторий с CRM (например, https://github.com/EKlimov/crm.git):"
read -p "Репозиторий: " REPO_URL

if [ ! -d "$INSTALL_DIR/.git" ]; then
    git clone $REPO_URL $INSTALL_DIR
else
    cd $INSTALL_DIR && git pull
fi

cd $INSTALL_DIR
mkdir -p data
chmod 777 data

cat << 'DOCKER_EOF' > docker-compose.yml
version: '3.8'
services:
  crm:
    image: node:20-alpine
    container_name: saby-crm
    working_dir: /app
    volumes:
      - .:/app
      - ./data:/app/data
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    command: sh -c "apk add --no-cache python3 make g++ && npm install && node server.js"
    restart: always
DOCKER_EOF

docker compose up -d

echo "================================================"
echo "✅ Установка завершена!"
echo "CRM запущена и доступна по IP-адресу вашего сервера (порт 80)."
echo "База данных SQLite хранится в $INSTALL_DIR/data/ и больше не удалится."
echo "================================================"
