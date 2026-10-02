# Источники и благодарности

Эта сборка стоит на работе многих людей. Ниже — кто что сделал, что именно взято и что
доработано в этой сборке сверх исходного.

## Поддержка Xiaomi BE7000 в OpenWrt

| Автор / проект | Что взято | Что доработано здесь |
|---|---|---|
| **[OpenWrt](https://github.com/openwrt/openwrt)** (main, 01.10.2026) и [openwrt/backports](https://github.com/openwrt/backports) | Вся система, ядро 6.18.54, драйверы Wi-Fi из ядра 7.2, LuCI, пакеты | — |
| **[kravasuper](https://github.com/kravasuper/openwrt)** (ветка `xiaomi_be7000`, коммит `790d036a`) | Основа порта: DTS платы, профиль образа, калибровка Wi-Fi (caldata), патчи ath11k для IPQ9574 (2,4 ГГц) и ath12k (5 ГГц, QCN9274), скрипты платы, NFC; фикс приёма Ethernet «qualcommbe: fix PPE EDMA RX DMA mappings» (принят в OpenWrt, патч 0362 — работает и в этой сборке) | Порт перенесён на свежий OpenWrt main (ядро 6.18.36 → 6.18.54, backports 6.18 → 7.2): два патча ath11k/ath12k уже вошли в upstream и убраны, патч поддержки IPQ9574 адаптирован под новую структуру драйвера; образ под разметку QWRT (один UBI 80 МБ), лимит ядра поднят под неё |
| **[timofey-maykov / Beam WRT](https://github.com/timofey-maykov/be7000-openwrt)** | Патчи Ethernet `0900` (зависание napi_disable в qcom-ppe), `0901` (BaseR QCA8084 не фатален), `0902` (выход за массив при откате порта), `0903` (повторная настройка XPCS после захвата BaseR); правка DTS — ядро не голосует за регулятор l2 через RPM (на части плат глушило приём по Ethernet); идея добавить ath11k-ahb в профиль; скрипт подтверждения загрузки `be7000-bootconfirm`; подход к Wi-Fi на чистой установке. **С beta3:** исправления аппаратной разгрузки PPE `0905` (приём EDMA), `0906` (строки таблицы пишутся целиком — без него потоки не срабатывали), `0907` (мост на PPE отдельным выбором), mac80211 `393` (путь пересылки до клиентов Wi-Fi), страница LuCI «Аппаратная разгрузка» и `be7000-ppe`; режимы 5 ГГц «два радио» и MLO: ath12k `308`–`311`, iwinfo `008`, DTS `006` (память MLO) и `007` (RF-линии TLMM6/7 через pinctrl), `be7000-5g-split`, панель LuCI, калибровка по режиму, данные платы dual-MAC; DTS `011` (резервы TrustZone как в стоке); CMA для DT-пулов (`010`); `packet-steering.sh` (приём Ethernet не сводится на CPU0); журнал загрузки во флеше `be7000-bootlog`; восстановление пустого `board.json`. **В beta4:** логика sysupgrade «писать раздел, с которого система загрузилась» (их патч `003`) — основа нашего sysupgrade на разметке QWRT; идея возвращать после обновления пакеты, поставленные пользователем; устройство extroot — набор команд `be7000-extroot`, проверки занятых дисков, delay_root 15 с, фоновый запуск из LuCI и страница «Накопитель» | Скрипт `be7000-ppe`: выключение снимает только аппаратную разгрузку, программная остаётся; наш RPS-тюнинг не трогает порты qcom_ppe; bootlog — под разметку QWRT (crash_syslog = mtd26); sysupgrade на одноразделной разметке QWRT (номера томов, освобождение раздела, проверки образа до и после записи), возврат пакетов — через штатный список `sysupgrade -k`; extroot: привязка диска к сборке прошивки (у Beam после обновления подключается старый upper), перенос настроек на диск после обновления, сторож отвала диска, перенос без форматирования, возврат с настройками, исправление fstools (gpiochip0 вместо корня) |
| **[Quarx2k / OpenWRT-BE7000](https://github.com/Quarx2k/OpenWRT-BE7000)** (Quarx2k, Nickolai Semendiaev) | Точная разводка «все четыре цепи на одно 5 ГГц радио» (TLMM6/7), идеи по нативным WCSS-драйверам. **С beta3:** патчи ядра `9511` (такты QCA8084 читаются в контексте, где можно спать), `9518` (такты MAC QCA8084 не меняют источник — таймаут на MAC4 при падении линка), `0374` (статус линка PHY передаётся в XPCS) | — |
| **[openwrt/openwrt#20604](https://github.com/openwrt/openwrt/pull/20604)** (dima424658 и участники) | Сведения о плате: UART 1,8 В, загрузка через UART + TFTP | — |
| **[openwrt-xiaomi/xmir-patcher](https://github.com/openwrt-xiaomi/xmir-patcher)** | Доступ к стоковой прошивке (SSH) — первый шаг перехода | — |
| **QWRT** | Загрузчик и разметка с одним разделом `rootfs` 80 МБ, веб-recovery | Найдена и описана мина загрузчика `loadaddr=0x0` (recovery стирает раздел, но не пишет). Вывод beta1–beta3 «sysupgrade на одном разделе стирает систему» оказался неверным: загрузчик берёт ядро и систему по номерам томов UBI, а sysupgrade их сдвигал. С beta4 sysupgrade на этой разметке работает |

## Аппаратная разгрузка NAT (PPE) и NSS

| Автор / проект | Что взято |
|---|---|
| **[hurrian / Kenneth Kasilag](https://github.com/openwrt/openwrt/pull/24178)** — openwrt/openwrt#24178 «[RFC] qualcommbe: add PPE offload support» | Серия патчей `0500`–`0520` и generic `767`–`769`: мост через switchdev, таблица потоков L3, разгрузка flowtable из netfilter, IPv4/IPv6, PPPoE, VLAN на WAN, DS-Lite/MAP-E, шейпер TBF, виртуальные порты. Взята в том виде, как её собрал Beam WRT (tree `014`) |
| **[JuliusBairaktaris](https://github.com/JuliusBairaktaris)** | HPPE-драйвер разгрузки для IPQ807x — основа варианта разгрузки у Quarx2k (в эту сборку не входит, указан как предшественник) |
| **[qosmio](https://github.com/qosmio/openwrt-ipq)** ([nss-packages](https://github.com/qosmio/nss-packages), [qca-sdk-nss-fw](https://github.com/qosmio/qca-sdk-nss-fw)) | Патчи ядра поддержки qca-nss-ecm (`0910`–`0917`) — были в beta1–beta2; в beta3 убраны (ECM без прошивки NSS не работает, хуки конфликтовали с разгрузкой PPE) |
| **[JuliusBairaktaris/nss-packages](https://github.com/JuliusBairaktaris/nss-packages)** | Исходники пакетов NSS (драйвер, ECM, clients) — не входят в образ: для IPQ9574 нет открытой прошивки NSS, разгрузка сделана через PPE (выше) |

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

## Что сделано в этой сборке

Часть идей уже была у других авторов — это отмечено.

- **Перенос на свежий OpenWrt** (ядро 6.18.54, драйверы Wi-Fi 7.2) с адаптацией патчей BE7000
  (тот же перенос на backports 7.2, включая правку `max_tx_ring`, Beam WRT сделал раньше, 29.09).
- **Образ под разметку QWRT 80 МБ** и обновление на ней из LuCI с сохранением настроек (с beta4):
  образ проверяется до записи (в том числе при «Force upgrade») и сверяется после.
- **Каталог приложений**: ~50 программ, установка во флеш, на USB-диск или в Entware одной кнопкой.
- **Фид драйверов и пакетов под ядро прошивки** на GitHub Pages (свой фид kmod раньше появился у Beam WRT).
- **«ПО на внешнем диске»**: Docker, Jackett, qBittorrent, Xray, Tailscale, Entware на USB-диск;
  на NTFS/exFAT — ext4-том в файле, на ext4 — прямо на диск; форматирование диска в ext4 из LuCI
  (Docker на USB есть и в Beam WRT).
- **VPN → Быстрая настройка**: ключи `vpn://` из AmneziaVPN, режимы «сайты»/«весь трафик», защита от утечек IPv6.
- **Обход блокировок в прошивке**: Podkop, zapret, byedpi, pbr; исправлен конфликт Podkop с Docker.
- **Живучесть USB-диска**: usb-watchdog, восстановление «грязного» NTFS (`scanvol`), автомонтирование.
- **IPv6 за роутером провайдера**: если префикс не выдаётся, сам включается relay + NAT66;
  исправлено обучение адресов клиентов (`accept_untracked_na`).
- **Тюнинг Wi-Fi и сети**: AQL, распределение прерываний ath12k, RPS, flow offload, U-APSD off,
  802.11k/v, CPU governor; проверка `be7000-wifi-check`.
- **Диагностика**: журнал падений ядра (mtdoops), постоянный лог на диск, ночной бэкап
  настроек, страж памяти, `be7000-health-check`.
- Списки пакетов скачиваются сами; LuCI на русском.
