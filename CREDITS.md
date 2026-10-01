# Источники и благодарности

Эта сборка стоит на работе многих людей. Ниже — кто что сделал, что именно взято и что
доработано в этой сборке сверх исходного.

## Поддержка Xiaomi BE7000 в OpenWrt

| Автор / проект | Что взято | Что доработано здесь |
|---|---|---|
| **[OpenWrt](https://github.com/openwrt/openwrt)** (main, 01.10.2026) и [openwrt/backports](https://github.com/openwrt/backports) | Вся система, ядро 6.18.54, драйверы Wi-Fi из ядра 7.2, LuCI, пакеты | — |
| **[kravasuper](https://github.com/kravasuper/openwrt)** (ветка `xiaomi_be7000`, коммит `790d036a`) | Основа порта: DTS платы, профиль образа, калибровка Wi-Fi (caldata), патчи ath11k для IPQ9574 (2,4 ГГц) и ath12k (5 ГГц, QCN9274), скрипты платы, NFC | Порт перенесён на свежий OpenWrt main (ядро 6.18.36 → 6.18.54, backports 6.18 → 7.2): два патча ath11k/ath12k уже вошли в upstream и убраны, патч поддержки IPQ9574 адаптирован под новую структуру драйвера; образ под разметку QWRT (один UBI 80 МБ), лимит ядра поднят под неё |
| **[timofey-maykov / Beam WRT](https://github.com/timofey-maykov/be7000-openwrt)** | Патчи Ethernet `0900` (зависание napi_disable в qcom-ppe), `0901` (BaseR QCA8084 не фатален), `0902` (выход за массив при откате порта), `0903` (повторная настройка XPCS после захвата BaseR); правка DTS — ядро не голосует за регулятор l2 через RPM (на части плат глушило приём по Ethernet); идея добавить ath11k-ahb в профиль; переключение RF-линий TLMM6/TLMM7 для приёма 5 ГГц; практика «безопасных настроек при первой загрузке» | TLMM6/7 включаются через GPIO при загрузке, а не в DTS (DTS-вариант давал циклическую перезагрузку): 5 ГГц −31 dBm вместо −55…−60 dBm в метре от роутера |
| **[Quarx2k / OpenWRT-BE7000](https://github.com/Quarx2k/OpenWRT-BE7000)** | Точная разводка «все четыре цепи на одно 5 ГГц радио» (TLMM6/7), идеи по нативным WCSS-драйверам | — |
| **[openwrt/openwrt#20604](https://github.com/openwrt/openwrt/pull/20604)** (dima424658 и участники) | Сведения о плате: UART 1,8 В, загрузка через UART + TFTP | — |
| **[openwrt-xiaomi/xmir-patcher](https://github.com/openwrt-xiaomi/xmir-patcher)** | Доступ к стоковой прошивке (SSH) — первый шаг перехода | — |
| **QWRT** | Загрузчик и разметка с одним разделом `rootfs` 80 МБ, веб-recovery | Найдены и описаны две мины загрузчика: `loadaddr=0x0` (recovery стирает раздел, но не пишет) и `sysupgrade` на одном разделе (стирает систему) — sysupgrade на этой разметке отключён |

## Ускорение NSS / PPE (патчи ядра)

| Автор / проект | Что взято |
|---|---|
| **[qosmio](https://github.com/qosmio/openwrt-ipq)** ([nss-packages](https://github.com/qosmio/nss-packages), [qca-sdk-nss-fw](https://github.com/qosmio/qca-sdk-nss-fw)) | Патчи ядра поддержки qca-nss-ecm (`0910`–`0914`), прошивка NSS |
| **[JuliusBairaktaris/nss-packages](https://github.com/JuliusBairaktaris/nss-packages)** | Исходники пакетов NSS (драйвер, ECM, clients) — пока не входят в образ: под это ядро не собираются |

## VPN и обход блокировок

| Автор / проект | Что взято | Что доработано здесь |
|---|---|---|
| **[Amnezia VPN](https://github.com/amnezia-vpn)** ([amneziawg-linux-kernel-module](https://github.com/amnezia-vpn/amneziawg-linux-kernel-module)) | Модуль ядра AmneziaWG | Страница **VPN → Быстрая настройка**: вставка `.conf` или ключа `vpn://` из приложения AmneziaVPN (распаковка в браузере), выбор «только сайты»/«весь трафик», защита от утечек через IPv6 |
| **[YAAWG](https://github.com/this-username-has-been-taken/amneziawg-openwrt)** | Пакеты amneziawg-tools, kmod-amneziawg, luci-proto-amneziawg 3.1.2 для OpenWrt (протокол AWG 2.0) | — |
| **[ITDog / Podkop](https://github.com/itdoginfo/podkop)** | Podkop и luci-app-podkop | Исправлен конфликт с Docker (фильтрация iptables на всех мостах ломала прозрачный прокси Podkop) |
| **[SagerNet / sing-box](https://github.com/SagerNet/sing-box)** | Ядро Podkop (VLESS/Reality, Trojan, Shadowsocks, Hysteria2) | Собран без встроенного Tailscale (−10 МБ) |
| **[bol-van / zapret](https://github.com/bol-van/zapret)** и **[remittor / zapret-openwrt](https://github.com/remittor/zapret-openwrt)** | Обход DPI и его пакеты/страница LuCI для OpenWrt | Работает рядом с томом `/opt` на USB-диске (каталог прошивки прокидывается поверх тома) |
| **[hufrea / byedpi](https://github.com/hufrea/byedpi)** | ByeDPI | Свой пакет для OpenWrt (init + uci) |
| **[XTLS / Xray-core](https://github.com/XTLS/Xray-core)**, **[Tailscale](https://tailscale.com)** | Ставятся на USB-диск из официальных релизов | Рецепты установки, автозапуск после загрузки диска |
| [Тема «Способы обхода блокировок на OpenWrt» на 4PDA](https://4pda.to/forum/index.php?showtopic=1085698) | Подборка актуальных методов обхода, по которой выбирался состав | — |

## Приложения и списки

| Автор / проект | Что взято | Что доработано здесь |
|---|---|---|
| **[c0re100 / qBittorrent Enhanced Edition](https://github.com/c0re100/qBittorrent-Enhanced-Edition)** | Статическая сборка qBittorrent (с рабочим HTTPS) | Торренты по умолчанию только через WAN (не утекают в VPN); кнопка «Пароль WebUI» |
| **[Jackett](https://github.com/Jackett/Jackett)** | Индексатор трекеров | Установка на ext4-том, лимит памяти, ICU ставится сам |
| **[Entware](https://github.com/Entware/Entware)** | Репозиторий ~3000 пакетов для роутеров | Установка из каталога одной кнопкой, автозапуск служб |
| **[Hagezi DNS blocklists](https://github.com/hagezi/dns-blocklists)** | Список Hagezi Pro для adblock-fast по умолчанию | — |

## Что сделано в этой сборке сверх источников

- **Перенос на свежий OpenWrt** (ядро 6.18.54, драйверы Wi-Fi 7.2) с адаптацией патчей BE7000.
- **Каталог приложений**: ~50 программ, установка во флеш, на USB-диск или в Entware одной кнопкой.
- **Фид драйверов под ядро прошивки** (~930 kmod) на GitHub Pages — USB-модемы, тетеринг, NFS,
  принтеры ставятся, хотя официальные kmod OpenWrt под это ядро не подходят.
- **«ПО на внешнем диске»**: Docker, Jackett, qBittorrent, Xray, Tailscale, Entware на USB-диск;
  на NTFS/exFAT — ext4-том в файле, на ext4 — прямо на диск; форматирование диска в ext4 из LuCI.
- **Живучесть USB-диска**: usb-watchdog, восстановление «грязного» NTFS (`scanvol`), автомонтирование.
- **IPv6 за роутером провайдера**: если префикс не выдаётся, сам включается relay + NAT66;
  исправлено обучение адресов клиентов (`accept_untracked_na`).
- **Тюнинг Wi-Fi и сети**: AQL, распределение прерываний ath12k, RPS, flow offload, U-APSD off,
  802.11k/v, CPU governor; проверка `be7000-wifi-check`.
- **Диагностика**: журнал падений ядра (mtdoops), постоянный лог на диск, ночной бэкап
  настроек, страж памяти, `be7000-health-check`.
- **Защита от кирпича на QWRT-разметке**: sysupgrade и «Прошить образ» отказывают, ничего не записав.
- Списки пакетов скачиваются сами; LuCI на русском.
