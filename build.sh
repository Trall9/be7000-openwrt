#!/bin/sh
# Сборка прошивки BE7000 из исходников OpenWrt + патчей этого репозитория.
# Требования: Linux (или WSL2), ~40 ГБ диска, пакеты для сборки OpenWrt:
#   https://openwrt.org/docs/guide-developer/toolchain/install-buildsystem
# Использование: ./build.sh [каталог] [потоков]
#   MINI=1 ./build.sh … — минимальный вариант (состав стокового OpenWrt + поддержка BE7000)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
DIR=${1:-openwrt-be7000}
JOBS=${2:-$(nproc)}
rev() { awk -v n="$1" '$1==n{print $2}' "$HERE/source/feeds.lock"; }

[ -d "$DIR/.git" ] || git clone https://github.com/openwrt/openwrt.git "$DIR"
cd "$DIR"
git checkout -q "$(rev openwrt)"
git am -q "$HERE"/source/patches/*.patch

# фиды — на тех же коммитах, что и релиз
cp feeds.conf.default feeds.conf
for f in packages luci routing telephony video; do
	sed -i "s|^\(src-git $f [^ ;^]*\).*|\1^$(rev $f)|" feeds.conf
done
./scripts/feeds update -a
./scripts/feeds install -a
./feed-patches/apply.sh

SFX=${MINI:+-mini}
rm -rf files && cp -a "$HERE/source/files$SFX" files
cp "$HERE/source/diffconfig$SFX" .config
make defconfig
make download -j"$JOBS"
# IGNORE_ERRORS=m: необязательные модули (kmod для фида), которые не собираются, пропускаются
make -j"$JOBS" IGNORE_ERRORS=m
ls -la bin/targets/qualcommbe/ipq95xx/*factory.ubi
