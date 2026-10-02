#!/bin/sh
# Syncthing 2.x (Entware): init-скрипт рассчитан на 1.x — без --home конфиг
# и база ложатся во флеш (/root/.local/state), веб-морда только на 127.0.0.1.
S=/opt/etc/init.d/S92syncthing
[ -f "$S" ] || exit 1
$S stop >/dev/null 2>&1
sed -i 's|^ARGS=.*|ARGS="serve --home=/opt/etc/syncthing --gui-address=http://0.0.0.0:8384 --no-browser"|' "$S"
rm -rf /root/.local/state/syncthing
echo "Syncthing: http://<роутер>:8384 — задайте пароль веб-морды при первом входе (Действия → Настройки → Графический интерфейс)"
