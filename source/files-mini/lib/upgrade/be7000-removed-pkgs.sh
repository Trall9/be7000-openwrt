# BE7000: при создании бэкапа (sysupgrade -b / обновление с сохранением
# настроек) запоминаем встроенные пакеты, которые пользователь удалил:
# есть в /rom, нет среди установленных. После обновления be7000-pkg-restore
# удаляет их снова.
add_be7000_removed_pkgs()
{
	local filelist="$1" f=/etc/backup/removed_packages.txt
	[ -f /rom/lib/apk/db/installed ] || return 0
	mkdir -p /etc/backup
	apk info 2>/dev/null | sort > /tmp/be7000-installed.$$
	# пустой список установленных = apk не ответил; иначе «удалено» всё
	[ "$(wc -l < /tmp/be7000-installed.$$)" -ge 50 ] || { rm -f /tmp/be7000-installed.$$; return 0; }
	sed -n 's/^P://p' /rom/lib/apk/db/installed | sort -u |
		grep -vxF -f /tmp/be7000-installed.$$ > "$f"
	rm -f /tmp/be7000-installed.$$
	# на этой системе список уже выполнен; .done в бэкап не идёт, поэтому
	# после обновления/восстановления be7000-pkg-restore применит список
	cp "$f" /etc/backup/removed_packages.done
	echo "$f" >> "$filelist"
}

sysupgrade_init_conffiles="$sysupgrade_init_conffiles add_be7000_removed_pkgs"
