#!/bin/sh
# File Browser (Entware): по умолчанию слушает :8080 (занят qBittorrent) и
# показывает /opt. Переносим на :8088, корень — USB-диск. Пароль admin
# задаём сами: случайный пароль первого запуска пишется только в лог.
C=/opt/etc/filebrowser/filebrowser.conf
DB=/opt/etc/filebrowser/filebrowser.db
F=/opt/sbin/filebrowser
[ -f "$C" ] || exit 1
/opt/etc/init.d/S99filebrowser stop >/dev/null 2>&1
sed -i -e 's|^ADDR=.*|ADDR="-a 0.0.0.0"|' -e 's|^PORT=.*|PORT="-p 8088"|' \
	-e 's|^ROOT=.*|ROOT="-r /mnt/sda1"|' "$C"
[ -f "$DB" ] && { echo "File Browser: база уже есть, пароль не меняю"; exit 0; }
PW=$(head -c 64 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 14)
$F -d "$DB" config init >/dev/null && \
	$F -d "$DB" users add admin "$PW" --perm.admin --locale ru >/dev/null || exit 1
echo "File Browser: http://<роутер>:8088 — логин admin, пароль $PW (смените: Настройки → Профиль)"
