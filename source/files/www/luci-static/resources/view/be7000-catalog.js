'use strict';
'require view';
'require rpc';
'require ui';

/* Каталог приложений BE7000: избранный софт по категориям, установка в один клик —
   во флеш (apk), на USB-диск (рецепты opt-install) или в Entware на диске. */

var KIND = {
	apk: { label: 'флеш', title: 'Ставится во внутреннюю память роутера' },
	disk: { label: 'USB-диск', title: 'Ставится на USB-диск (/mnt/sda1/opt)' },
	entware: { label: 'USB-диск · Entware', title: 'Ставится в Entware на USB-диске (/opt)' }
};

return view.extend({
	pollTimer: null,
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	fexec: rpc.declare({
		object: 'file',
		method: 'exec',
		params: ['command', 'params'],
		expect: { '': {} },
		reject: true
	}),

	fread: rpc.declare({
		object: 'file',
		method: 'read',
		params: ['path'],
		expect: { data: '' },
		reject: true
	}),

	call: function(cmd, args) {
		return this.fexec(cmd, args).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Ошибка вызова %s: %s. Обновите страницу (Ctrl+F5); если повторяется — войдите в LuCI заново.')
				.format(args.join(' '), (err && err.message) || err)), 'danger');
			return null;
		});
	},

	load: function() {
		return Promise.all([
			this.fread('/usr/share/be7000/catalog.json').then(JSON.parse).catch(function() { return null; }),
			this.call('/usr/bin/opt-install', ['disk-info'])
		]);
	},

	statusText: function(it, st) {
		if (!st) return E('span', { 'class': 'label' }, '…');
		if (st.builtin) return E('span', { 'class': 'label label-success' }, _('встроено'));
		if (st.installed) {
			if (it.kind == 'disk' && !st.running)
				return E('span', { 'class': 'label label-warning' }, _('установлено, остановлено'));
			return E('span', { 'class': 'label label-success' }, _('установлено'));
		}
		return E('span', { 'class': 'label' }, _('не установлено'));
	},

	renderStatus: function(s) {
		var self = this;
		this.lastStatus = s;
		var info = document.getElementById('cat-info');
		if (info) {
			var parts = [ _('Флеш: свободно %s МБ').format(s.flash_free != null ? s.flash_free : '?') ];
			parts.push(s.disk ? _('USB-диск: свободно %s').format(s.disk_free || '?') : _('USB-диск не подключён'));
			parts.push(s.entware ? _('Entware: установлен') : _('Entware: будет установлен при первой установке из него'));
			info.textContent = parts.join(' · ');
		}
		var busy = s.busy || s.disk_busy;
		var bb = document.getElementById('cat-busy');
		if (bb) {
			bb.style.display = busy ? '' : 'none';
			bb.textContent = busy ? _('Идёт установка: %s… Лог обновляется ниже.').format(busy) : '';
		}
		(this.catalog.items || []).forEach(function(it) {
			var st = s.items[it.id] || {};
			var stEl = document.getElementById('cat-st-' + it.id);
			if (stEl) stEl.replaceChildren(self.statusText(it, st));
			var bi = document.getElementById('cat-in-' + it.id);
			var br = document.getElementById('cat-rm-' + it.id);
			var bo = document.getElementById('cat-open-' + it.id);
			var needDisk = it.kind != 'apk';
			if (bi) {
				bi.style.display = st.installed ? 'none' : '';
				bi.disabled = !!busy || (needDisk && !s.disk);
				bi.title = (needDisk && !s.disk) ? _('Подключите USB-диск') : '';
			}
			if (br) {
				br.style.display = (st.installed && !st.builtin) ? '' : 'none';
				br.disabled = !!busy;
			}
			if (bo) bo.style.display = st.installed ? '' : 'none';
		});
	},

	poll: function() {
		var self = this;
		return this.call('/usr/bin/be7000-catalog', ['status']).then(function(res) {
			var s = null;
			try { s = JSON.parse(res.stdout); } catch (e) {}
			if (!s) return;
			self.renderStatus(s);
			var busy = s.busy || s.disk_busy;
			if (busy || self.logOpen) self.refreshLog();
			if (busy && !self.pollTimer)
				self.pollTimer = window.setInterval(function() { self.poll(); }, 2500);
			else if (!busy && self.pollTimer) {
				window.clearInterval(self.pollTimer);
				self.pollTimer = null;
			}
		});
	},

	refreshLog: function() {
		var pre = document.getElementById('cat-log');
		if (!pre) return;
		return this.call('/usr/bin/be7000-catalog', ['log']).then(function(res) {
			if (!res) return;
			pre.parentNode.style.display = '';
			pre.textContent = res.stdout || _('(пусто)');
			pre.scrollTop = pre.scrollHeight;
		});
	},

	handleInstall: function(it, ev) {
		var self = this;
		var where = KIND[it.kind] ? KIND[it.kind].title : '';
		ui.showModal(_('Установить «%s»?').format(it.title), [
			E('p', {}, where + (it.size ? _(' (~%s МБ).').format(it.size) : '.')),
			it.kmod ? E('p', { 'class': 'alert-message warning' }, _('Нужны драйверы (kmod) под ядро этой прошивки — они ставятся из репозитория драйверов BE7000.')) : '',
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ',
				E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, function() {
					ui.hideModal();
					self.logOpen = true;
					return self.call('/usr/bin/be7000-catalog', ['install', it.id]).then(function(res) {
						if (res && res.stderr) ui.addNotification(null, E('p', {}, res.stderr), 'warning');
						return self.poll();
					});
				}) }, _('Установить'))
			])
		]);
	},

	handleRemove: function(it, ev) {
		var self = this;
		ui.showModal(_('Удалить «%s»?').format(it.title), [
			E('p', {}, it.kind == 'apk' ? _('Пакеты будут удалены из флеша. Настройки в /etc/config сохранятся.')
				: _('Программа будет удалена с диска. Данные программы на диске сохранятся.')),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ',
				E('button', { 'class': 'btn cbi-button-negative', 'click': ui.createHandlerFn(this, function() {
					ui.hideModal();
					self.logOpen = true;
					return self.call('/usr/bin/be7000-catalog', ['remove', it.id]).then(function(res) {
						if (res && res.stderr) ui.addNotification(null, E('p', {}, res.stderr), 'warning');
						return self.poll();
					});
				}) }, _('Удалить'))
			])
		]);
	},

	/* ---------- USB-диск: форматирование в ext4 ---------- */
	renderDisk: function(d) {
		var self = this;
		if (!d || !d.present)
			return E('div', { 'class': 'alert-message' }, _('USB-диск не подключён. Приложения «USB-диск» и «Entware» станут доступны после подключения диска.'));
		var fsName = d.fstype == 'none' || !d.fstype ? _('нет файловой системы') : d.fstype;
		var good = d.fstype == 'ext4';
		return E('div', { 'class': 'alert-message ' + (good ? 'success' : 'notice') }, [
			E('strong', {}, _('USB-диск: ')), '%s %s, %s'.format(d.model || '', d.size || '', fsName),
			good ? _(' — оптимально: приложения ставятся прямо на диск.')
				: _(' — работает, но для приложений на диске создаётся файл-образ ext4. Для максимальной скорости и надёжности диск лучше отформатировать в ext4 (Windows его без доп. программ читать не будет).'),
			' ',
			E('button', { 'class': 'btn cbi-button-negative', 'style': 'margin-left:.5em',
				'click': ui.createHandlerFn(this, 'handleFormat', d) }, _('Отформатировать в ext4…'))
		]);
	},

	handleFormat: function(d, ev) {
		var self = this;
		var word = 'FORMAT-' + d.dev;
		var inp = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': word });
		ui.showModal(_('Форматирование USB-диска'), [
			E('p', { 'class': 'alert-message error' }, _('ВСЕ данные на диске %s (%s %s) будут УДАЛЕНЫ безвозвратно: файлы, торренты, Docker, Entware и установленные на диск приложения.').format('/dev/' + d.dev, d.model || '', d.size || '')),
			E('p', {}, _('Диск будет размечен заново: один раздел ext4. После форматирования приложения с диска нужно установить заново.')),
			E('p', {}, [ _('Для подтверждения введите: '), E('code', {}, word) ]),
			inp,
			E('div', { 'class': 'right', 'style': 'margin-top:1em' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ',
				E('button', { 'class': 'btn cbi-button-negative', 'click': ui.createHandlerFn(this, function() {
					if (inp.value.trim() != word) {
						ui.addNotification(null, E('p', {}, _('Слово подтверждения не совпало — форматирование отменено.')), 'warning');
						ui.hideModal();
						return;
					}
					ui.showModal(_('Форматирование…'), [ E('p', { 'class': 'spinning' }, _('Остановка служб, разметка и форматирование. Не отключайте диск.')), E('pre', { 'id': 'fmt-log', 'style': 'max-height:250px;overflow:auto;font-size:12px' }) ]);
					return self.call('/usr/bin/opt-install', ['format-disk', d.dev, word]).then(function(res) {
						if (!res || res.code != 0) {
							ui.showModal(_('Ошибка'), [ E('p', {}, (res && res.stderr) || _('не удалось запустить')),
								E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Закрыть'))) ]);
							return;
						}
						return self.waitFormat();
					});
				}) }, _('Стереть и отформатировать'))
			])
		]);
	},

	waitFormat: function() {
		var self = this;
		return new Promise(function(resolve) {
			var t = window.setInterval(function() {
				self.call('/usr/bin/opt-install', ['format-log']).then(function(res) {
					var txt = (res && res.stdout) || '';
					var pre = document.getElementById('fmt-log');
					if (pre) pre.textContent = txt;
					var m = txt.match(/format done (\d+)/);
					if (!m) return;
					window.clearInterval(t);
					ui.showModal(m[1] == '0' ? _('Готово') : _('Ошибка форматирования'), [
						E('pre', { 'style': 'max-height:300px;overflow:auto;font-size:12px' }, txt),
						E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': function() { location.reload(); } }, _('Закрыть')))
					]);
					resolve();
				});
			}, 2000);
		});
	},

	render: function(data) {
		var self = this;
		this.catalog = data[0];
		var diskInfo = null;
		try { diskInfo = JSON.parse(data[1].stdout); } catch (e) {}

		if (!this.catalog)
			return E('div', { 'class': 'alert-message error' }, _('Нет файла каталога /usr/share/be7000/catalog.json'));

		var sections = this.catalog.categories.map(function(cat) {
			var items = self.catalog.items.filter(function(it) { return it.cat == cat.id; });
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, cat.title),
				E('table', { 'class': 'table' }, items.map(function(it) {
					var k = KIND[it.kind] || { label: it.kind, title: '' };
					var link = it.page ? E('a', { 'id': 'cat-open-' + it.id, 'class': 'btn', 'style': 'display:none',
							'href': L.url.apply(L, it.page.split('/')) }, _('Открыть'))
						: it.web ? E('a', { 'id': 'cat-open-' + it.id, 'class': 'btn', 'style': 'display:none', 'target': '_blank', 'rel': 'noopener noreferrer',
							'href': window.location.protocol + '//' + window.location.hostname + ':' + it.web + '/' }, _('Веб-интерфейс'))
						: '';
					return E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width:60%' }, [
							E('strong', {}, it.title), ' ',
							E('span', { 'class': 'label', 'title': k.title, 'style': 'font-weight:normal' }, k.label),
							it.size ? E('small', { 'style': 'opacity:.7' }, ' ~' + it.size + ' МБ') : '',
							E('br'),
							E('small', {}, it.desc)
						]),
						E('td', { 'class': 'td', 'id': 'cat-st-' + it.id, 'style': 'width:15%' }, E('span', { 'class': 'label' }, '…')),
						E('td', { 'class': 'td right', 'style': 'width:25%;white-space:nowrap' }, [
							link, ' ',
							E('button', { 'id': 'cat-in-' + it.id, 'class': 'btn cbi-button-action', 'style': 'display:none',
								'click': ui.createHandlerFn(self, 'handleInstall', it) }, _('Установить')), ' ',
							E('button', { 'id': 'cat-rm-' + it.id, 'class': 'btn cbi-button-negative', 'style': 'display:none',
								'click': ui.createHandlerFn(self, 'handleRemove', it) }, _('Удалить'))
						])
					]);
				}))
			]);
		});

		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Каталог приложений')),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Избранный софт для роутера. «флеш» — ставится во внутреннюю память, «USB-диск» — на подключённый диск. Полный список (~7 500 программ OpenWrt) — в разделе '),
				E('a', { 'href': L.url('admin', 'system', 'package-manager') }, _('Система → Программное обеспечение')), '.'
			]),
			E('div', { 'id': 'cat-info', 'class': 'alert-message' }, '…'),
			this.renderDisk(diskInfo),
			E('div', { 'id': 'cat-busy', 'class': 'alert-message warning', 'style': 'display:none' }),
			E('div', { 'class': 'cbi-section', 'style': 'display:none' }, [
				E('h3', {}, _('Лог установки')),
				E('pre', { 'id': 'cat-log', 'style': 'max-height:300px;overflow:auto;font-size:12px' })
			])
		].concat(sections));

		window.setTimeout(function() { self.poll(); }, 100);
		return root;
	}
});
