#!/bin/sh
# v2rayA 2.x (Entware): флаги из init-скрипта (-b, --nftables-support после
# --v2ray-bin) разбираются с ошибкой «unknown flag» — служба молча не стартует.
# Передаём настройки переменными окружения, в командной строке только -c.
S=/opt/etc/init.d/S24v2raya
[ -f "$S" ] || exit 1
grep -q V2RAYA_V2RAY_BIN "$S" || sed -i '/^ARGS=/,/"$/c\
export V2RAYA_V2RAY_BIN=/opt/sbin/xray V2RAYA_V2RAY_ASSETSDIR=/opt/share/v2ray\
export V2RAYA_NFTABLES_SUPPORT=off V2RAYA_LOG_FILE=/opt/var/log/v2raya.log\
ARGS="-c /opt/etc/v2raya"' "$S"
echo "v2rayA: http://<роутер>:2017 — при первом входе создайте учётную запись"
