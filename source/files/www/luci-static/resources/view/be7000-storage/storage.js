'use strict';
'require view';
'require rpc';
'require ui';

// Система, Оверлей на USB-диске: перенос /overlay на раздел ext4.
// Работу делает /usr/sbin/be7000-extroot за rpcd-объектом be7000-storage.
// Устройство страницы — по образцу «Накопитель» из Beam WRT.

var callStatus = rpc.declare({ object: 'be7000-storage', method: 'status' });
var callList = rpc.declare({ object: 'be7000-storage', method: 'list' });
var callUse = rpc.declare({ object: 'be7000-storage', method: 'use', params: [ 'device', 'keep' ] });
var callRevert = rpc.declare({ object: 'be7000-storage', method: 'revert' });
var callJob = rpc.declare({ object: 'be7000-storage', method: 'job' });
var callReboot = rpc.declare({ object: 'system', method: 'reboot' });

function waitJob() {
	return new Promise(function(resolve) {
		var tick = function() {
			callJob().then(function(r) {
				if (r && r.done) resolve(r); else window.setTimeout(tick, 2000);
			}).catch(function() { window.setTimeout(tick, 2000); });
		};
		window.setTimeout(tick, 2000);
	});
}

function mb(kb) {
	if (kb == null || isNaN(kb)) return '—';
	return kb >= 1048576 ? _('%.1f ГБ').format(kb / 1048576) : _('%.1f МБ').format(kb / 1024);
}

var STATE = {
	off: [ '', _('Во внутренней флеш-памяти. Extroot не настроен.') ],
	active: [ 'success', _('На USB-диске.') ],
	inactive: [ 'warning', _('Extroot настроен, но /overlay сейчас во флеш-памяти: диск не подключился при загрузке. Изменения сохраняются только во флеше и пропадут из вида, когда диск подключится. Подробности: Статус → Системный журнал, «be7000-extroot».') ],
	missing: [ 'warning', _('Extroot настроен, но диска нет. /overlay во флеш-памяти. Вставьте диск и перезагрузите роутер или верните /overlay во флеш.') ],
	fallback: [ 'danger', _('Extroot выключен автоматически: USB-диск дважды отваливался во время работы, и роутер вернулся на флеш-память с настройками на момент переноса. Проверьте диск и кабель (лучше — питание диска от отдельного блока) и перенесите /overlay снова.') ]
};

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callList(), {})
		]);
	},

	reload: function() {
		return this.load().then(L.bind(function(data) {
			var node = document.getElementById('be-storage');
			node.parentNode.replaceChild(this.render(data), node);
		}, this));
	},

	done: function(text) {
		ui.showModal(_('Готово'), [
			E('p', {}, text),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': L.bind(function() { ui.hideModal(); this.reload(); }, this) }, _('Позже')),
				' ',
				E('button', { 'class': 'btn cbi-button-action important', 'click': function() {
					callReboot().then(function() {
						ui.showModal(_('Перезагрузка'), [ E('p', { 'class': 'spinning' }, _('Роутер перезагружается, страница обновится сама.')) ]);
						ui.awaitReconnect();
					});
				} }, _('Перезагрузить сейчас'))
			])
		]);
	},

	handleUse: function(d, keep) {
		var self = this;
		var what = d.device + ' — ' + [ d.model, d.label, d.type ].filter(Boolean).join(', ');
		var agree = E('input', { 'type': 'checkbox', 'id': 'be-agree' });
		var go = E('button', { 'class': 'btn ' + (keep ? 'cbi-button-action' : 'cbi-button-negative'), 'disabled': keep ? null : '' },
			keep ? _('Перенести') : _('Форматировать и перенести'));
		agree.addEventListener('change', function() { go.disabled = !agree.checked; });
		go.addEventListener('click', function() {
			ui.showModal(_('Переношу'), [ E('p', { 'class': 'spinning' }, keep ? _('Копирование, это может занять минуту') : _('Форматирование и копирование, это может занять минуту')) ]);
			callUse(d.device, keep).then(function(r) {
				return (r && r.started) ? waitJob() : r;
			}).then(function(r) {
				if (r && r.ok)
					self.done(_('/overlay переедет на %s после перезагрузки.').format(d.device));
				else {
					ui.hideModal();
					ui.addNotification(null, E('pre', {}, (r && r.output) || _('Не получилось')), 'danger');
				}
			});
		});
		ui.showModal(keep ? _('Перенести /overlay на %s').format(d.device) : _('Форматировать %s и перенести /overlay').format(d.device), [
			E('p', { 'class': 'alert-message warning' }, what),
			keep
				? E('p', {}, _('Раздел уже ext4, файлы на нём останутся. Настройки и пакеты скопируются в каталог upper в корне раздела.'))
				: E('p', {}, [ E('strong', {}, _('Всё содержимое раздела будет удалено.')), ' ', _('Раздел станет ext4, настройки и пакеты скопируются на него.') ]),
			E('p', {}, _('Изменение вступит в силу после перезагрузки. Пока /overlay на диске, не отключайте диск от работающего роутера.')),
			keep ? '' : E('p', {}, [ agree, ' ', E('label', { 'for': 'be-agree' }, _('Я понимаю, что данные на %s пропадут').format(d.device)) ]),
			E('div', { 'class': 'right' }, [ E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ', go ])
		]);
	},

	handleRevert: function() {
		var self = this;
		ui.showModal(_('Вернуть /overlay во флеш-память'), [
			E('p', {}, _('Настройки скопируются во флеш. Пакеты, поставленные на диск, во флеш не переносятся — на диске они остаются, но использоваться перестанут.')),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ',
				E('button', { 'class': 'btn cbi-button-action', 'click': function() {
					callRevert().then(function(r) {
						if (r && r.ok)
							self.done(_('/overlay вернётся во флеш-память после перезагрузки.'));
						else {
							ui.hideModal();
							ui.addNotification(null, E('pre', {}, (r && r.output) || _('Не получилось')), 'danger');
						}
					});
				} }, _('Вернуть'))
			])
		]);
	},

	render: function(data) {
		var self = this;
		var st = (data[0] && data[0].data) || {};
		var disks = (data[1] && data[1].data) || [];
		var state = STATE[st.state] || [ '', '—' ];
		var configured = st.state && st.state != 'off' && st.state != 'fallback';

		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Раздел')),
				E('th', { 'class': 'th' }, _('Размер')),
				E('th', { 'class': 'th' }, _('Файловая система')),
				E('th', { 'class': 'th' }, _('Диск')),
				E('th', { 'class': 'th' }, '')
			])
		]);
		disks.forEach(function(d) {
			var act;
			if (d.device == st.extroot_device)
				act = E('em', {}, st.state == 'active' ? _('здесь /overlay') : _('выбран для /overlay'));
			else if (d.busy)
				act = E('span', { 'class': 'cbi-value-description' }, d.busy);
			else
				act = E('span', {}, [
					d.type == 'ext4' ? E('button', { 'class': 'btn cbi-button-action', 'click': function() { self.handleUse(d, true); } }, _('Перенести')) : '',
					d.type == 'ext4' ? ' ' : '',
					E('button', { 'class': 'btn cbi-button-negative', 'click': function() { self.handleUse(d, false); } }, _('Форматировать и перенести'))
				]);
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, d.device),
				E('td', { 'class': 'td' }, mb(d.size_mb * 1024)),
				E('td', { 'class': 'td' }, [ d.type || '—', d.label ? ' [' + d.label + ']' : '' ]),
				E('td', { 'class': 'td' }, d.model || '—'),
				E('td', { 'class': 'td' }, act)
			]));
		});

		return E('div', { 'id': 'be-storage' }, [
			E('h2', {}, _('Оверлей на USB-диске')),
			E('div', { 'class': 'cbi-map-descr' }, _('В /overlay хранится всё, что роутер помнит между перезагрузками: настройки, установленные пакеты, списки. Во флеш-памяти под него около 20 МБ. Его можно перенести на раздел USB-диска с файловой системой ext4 (extroot), тогда места будет столько, сколько на разделе.')),

			E('h3', {}, _('Сейчас')),
			E('div', { 'class': state[0] ? 'alert-message ' + state[0] : '' }, state[1]),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'width': '33%' }, _('Устройство /overlay')), E('td', { 'class': 'td' }, st.device || '—') ]),
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td' }, _('Всего')), E('td', { 'class': 'td' }, mb(st.total_kb)) ]),
				E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td' }, _('Свободно')), E('td', { 'class': 'td' }, mb(st.available_kb)) ])
			]),
			configured ? E('p', {}, E('button', { 'class': 'btn cbi-button-reset', 'click': function() { self.handleRevert(); } }, _('Вернуть /overlay во флеш-память'))) : '',

			E('h3', {}, _('Разделы')),
			disks.length ? table : E('p', {}, _('Дисков нет. Вставьте диск в порт USB и обновите страницу.')),
			E('div', { 'class': 'cbi-section-descr' }, [
				E('p', {}, _('Нужен отдельный раздел от 256 МБ. NTFS, exFAT и FAT не подходят: на них нет прав доступа Linux, которые нужны системе. Раздел с данными (например, NTFS с фильмами) форматировать не нужно — создайте рядом второй раздел, например в «Управлении дисками» Windows, и выберите его здесь.')),
				E('p', {}, _('Обновление прошивки с сохранением настроек работает: при первой загрузке новой версии настройки сами переедут на диск, роутер перезагрузится ещё раз, затем вернутся пакеты, которые вы ставили. Старое содержимое диска остаётся в каталоге upper.prev.')),
				E('p', {}, _('Если диск не подключится при загрузке, роутер запустится с настройками из флеш-памяти — теми, что были на момент переноса.'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
