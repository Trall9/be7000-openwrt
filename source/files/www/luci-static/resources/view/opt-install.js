'use strict';
'require view';
'require rpc';
'require ui';

return view.extend({
	appMeta: {
		qbittorrent: { port: 8080, title: 'qBittorrent (торрент-клиент)', desc: 'Веб-морда :8080. Закачки и конфиг хранятся на диске (/mnt/sda1/opt/apps/qbittorrent). Вход: логин admin, пароль временный — нажмите «Пароль WebUI» (qBittorrent перезапустится и покажет его), затем задайте свой: Настройки → WebUI → Аутентификация. Лимиты скорости стоит задать там же.' },
		xray: { title: 'Xray-core (VLESS/Reality)', desc: 'Резервный прокси. После установки отредактируйте /mnt/sda1/opt/apps/xray/config.json и перезапустите сервис.' },
		tailscale: { title: 'Tailscale (доступ домой)', desc: 'Доступ к домашней сети из любой точки, в том числе из-за CGNAT. После установки выполните по SSH: /mnt/sda1/opt/apps/tailscale/tailscale up' },
		docker: { title: 'Docker (контейнеры)', desc: 'dockerd + containerd + docker-compose из фида OpenWrt, ~230 МБ на ext4-томе /opt (на диске создаётся файл ext4store.img, 16 ГБ, sparse). Управление — LuCI → Службы → Docker. RAM: dockerd ~100 МБ — держите включённым, только если есть контейнеры.' },
		jackett: { port: 9117, title: 'Jackett (индексатор трекеров)', desc: 'Поиск по торрент-трекерам для qBittorrent (Torznab). Ставится на ext4-том /opt, память ограничена 320 МБ. Первый старт ~1 мин.' }
	},

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

	/* вызов opt-install: ошибки ubus/сессии/таймаута показываем, а не глотаем
	   (раньше страница оставалась с «…», а лог был пустым) */
	run: function(args) {
		return this.fexec('/usr/bin/opt-install', args).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Ошибка вызова opt-install %s: %s. Обновите страницу (Ctrl+F5); если повторяется — войдите в LuCI заново.').format(args.join(' '), (err && err.message) || err)), 'danger');
			return null;
		});
	},

	load: function() {
		return this.run(['status']);
	},

	pollStatus: function(ev) {
		var self = this;
		return this.run(['status']).then(function(res) {
			var st = null;
			try { st = JSON.parse(res.stdout); } catch (e) {}
			if (!st) {
				var d = document.getElementById('opt-disk-status');
				if (d) {
					d.textContent = _('Не удалось получить статус (%s). Обновите страницу.').format(res ? (res.stderr || 'код ' + res.code) : _('ошибка вызова'));
					d.className = 'alert-message error';
				}
				return;
			}
			self.renderStatus(st);
			if (st.busy && !self.pollTimer) {
				self.pollTimer = window.setInterval(function() { self.pollStatus(); }, 2500);
			} else if (!st.busy && self.pollTimer) {
				window.clearInterval(self.pollTimer);
				self.pollTimer = null;
			}
		});
	},

	renderStatus: function(st) {
		var self = this;
		var diskEl = document.getElementById('opt-disk-status');
		if (diskEl) {
			diskEl.textContent = st.disk
				? ('Диск смонтирован. Свободно: ' + (st.disk_free || '?'))
				: 'Диск НЕ смонтирован! Установка невозможна.';
			diskEl.className = st.disk ? 'alert-message success' : 'alert-message error';
		}
		for (var app in this.appMeta) {
			var meta = this.appMeta[app];
			var a = (st.apps && st.apps[app]) || {};
			var stateEl = document.getElementById('opt-state-' + app);
			var btnI = document.getElementById('opt-install-' + app);
			var btnR = document.getElementById('opt-remove-' + app);
			var btnStart = document.getElementById('opt-service-start-' + app);
			var btnStop = document.getElementById('opt-service-stop-' + app);
			var btnEn = document.getElementById('opt-service-enable-' + app);
			var linkEl = document.getElementById('opt-link-' + app);
			if (!stateEl) continue;
			var txt = [];
			if (st.busy === app) {
				txt = [E('span', { 'class': 'label label-warning' }, 'Установка идёт…')];
			} else if (a.installed) {
				txt = [E('span', { 'class': 'label label-success' }, 'Установлено'),
				       E('span', { 'style': 'margin-left:.5em' }, a.version || ''),
				       (a.running ? E('span', { 'class': 'label label-success', 'style': 'margin-left:.5em' }, 'работает')
				                  : E('span', { 'class': 'label label-important', 'style': 'margin-left:.5em' }, 'не работает'))];
			} else {
				txt = [E('span', { 'class': 'label' }, 'Не установлено')];
			}
			stateEl.replaceChildren.apply(stateEl, txt);
			/* показываем только кнопки, имеющие смысл: не установлено — «Установить»,
			   установлено — управление службой и «Удалить» */
			var show = function(el, on) { if (el) el.style.display = on ? '' : 'none'; };
			show(btnI, !a.installed);
			show(btnR, a.installed);
			show(btnStart, a.installed && !a.running);
			show(btnStop, a.installed && a.running);
			show(btnEn, a.installed);
			show(document.getElementById('opt-qbt-pw-' + app), a.installed && a.running);
			if (btnI) btnI.disabled = !!st.busy || !st.disk;
			if (btnR) btnR.disabled = !!st.busy;
			if (btnStart) btnStart.disabled = !!st.busy;
			if (btnStop) btnStop.disabled = !!st.busy;
			if (btnEn) {
				btnEn.disabled = !!st.busy;
				btnEn.textContent = a.enabled ? _('Автозапуск: вкл') : _('Автозапуск: выкл');
				btnEn.setAttribute('data-enabled', a.enabled ? '1' : '0');
			}
			if (linkEl) linkEl.style.display = (a.installed && a.running) ? '' : 'none';
		}
	},

	/* ui.createHandlerFn(ctx, fn, ...args) передаёт args ПЕРВЫМИ, event — последним */
	handleInstall: function(app, ev) {
		var self = this;
		ui.showModal(_('Установить %s на внешний диск?').format(this.appMeta[app].title) +
			'<br><small>' + _('Скачивается ~30–80 МБ, роутер должен иметь интернет. Установка идёт в фоне.') + '</small>', [
			E('div', { 'class': 'btn-row' }, [
				E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(self, function() {
					ui.hideModal();
					return self.run(['install', app]).then(function(res) {
						if (res && res.stderr) ui.addNotification(null, E('p', {}, res.stderr), 'warning');
						return self.pollStatus();
					});
				}) }, _('Установить')),
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена'))
			])
		]);
	},

	handleRemove: function(app, ev) {
		var self = this;
		ui.showModal(_('Удалить %s?').format(this.appMeta[app].title) +
			'<br><small>' + _('Будет удалён только бинарь и сервис. Данные на диске останутся.') + '</small>', [
			E('div', { 'class': 'btn-row' }, [
				E('button', { 'class': 'btn cbi-button-negative', 'click': ui.createHandlerFn(self, function() {
					ui.hideModal();
					return self.run(['remove', app]).then(function(res) {
						if (res && res.stderr) ui.addNotification(null, E('p', {}, res.stderr), 'warning');
						return self.pollStatus();
					});
				}) }, _('Удалить')),
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена'))
			])
		]);
	},

	handleService: function(app, action, ev) {
		var self = this;
		return this.run([action, app]).then(function(res) {
			if (res && res.stderr) ui.addNotification(null, E('p', {}, res.stderr));
			self.pollStatus();
		});
	},

	handleToggle: function(app, ev) {
		var en = document.getElementById('opt-service-enable-' + app);
		var op = (en && en.getAttribute('data-enabled') === '1') ? 'disable' : 'enable';
		return this.handleService(app, op, ev);
	},

	handleQbtPassword: function(ev) {
		var self = this;
		if (!confirm(_('qBittorrent будет перезапущен, чтобы выдать новый временный пароль WebUI. Продолжить?'))) return;
		ui.showModal(_('Пароль WebUI qBittorrent'), [ E('p', { 'class': 'spinning' }, _('Перезапуск qBittorrent…')) ]);
		return this.run(['qbt-password']).then(function(res) {
			res = res || {};
			var out = (res.stdout || '').trim(), body;
			if (out === 'SET')
				body = E('p', {}, _('Пароль WebUI уже задан вами в настройках qBittorrent. Если забыли — удалите строки WebUI\\Password_PBKDF2 из qBittorrent.conf на диске и нажмите кнопку снова.'));
			else if (out.indexOf('TEMP ') === 0)
				body = E('div', {}, [
					E('p', {}, [ _('Логин: '), E('strong', {}, 'admin') ]),
					E('p', {}, [ _('Временный пароль: '), E('strong', { 'style': 'font-family:monospace; font-size:1.2em' }, out.substr(5)) ]),
					E('p', {}, _('Он действует до следующего перезапуска qBittorrent. Сразу задайте свой: Настройки → WebUI → Аутентификация.'))
				]);
			else
				body = E('p', {}, res.stderr || out || _('Не удалось получить пароль'));
			ui.showModal(_('Пароль WebUI qBittorrent'), [ body,
				E('div', { 'class': 'btn-row' }, [ E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Закрыть')) ]) ]);
			self.pollStatus();
		});
	},

	handleLog: function(ev) {
		var self = this;
		return this.run(['log']).then(function(res) {
			if (!res) return;
			ui.showModal(_('Лог установки'), [
				E('pre', { 'style': 'max-height:400px; overflow:auto; font-size:12px' }, [res.stdout || '(пусто)']),
				E('div', { 'class': 'btn-row' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Закрыть'))
				])
			]);
		});
	},

	render: function() {
		var self = this;
		var cards = [];
		for (var app in this.appMeta) {
			(function(app) {
				cards.push(E('div', { 'class': 'cbi-section', 'style': 'margin-bottom:1em' }, [
					E('h3', {}, self.appMeta[app].title),
					E('div', { 'class': 'cbi-section-descr' }, self.appMeta[app].desc),
					E('div', { 'id': 'opt-state-' + app, 'style': 'margin:.5em 0' }, [E('span', { 'class': 'label' }, '…')]),
					E('div', { 'class': 'control-group' }, [
						E('button', { 'id': 'opt-install-' + app, 'class': 'btn cbi-button-action', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleInstall', app) }, _('Установить')),
						' ',
						E('button', { 'id': 'opt-service-start-' + app, 'class': 'btn', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleService', app, 'start') }, _('Старт')),
						' ',
						E('button', { 'id': 'opt-service-stop-' + app, 'class': 'btn', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleService', app, 'stop') }, _('Стоп')),
						' ',
						E('button', { 'id': 'opt-service-enable-' + app, 'class': 'btn', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleToggle', app) }, _('Автозапуск')),
						' ',
						E('button', { 'id': 'opt-remove-' + app, 'class': 'btn cbi-button-negative', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleRemove', app) }, _('Удалить')),
						app == 'qbittorrent' ? E('span', {}, [ ' ',
							E('button', { 'id': 'opt-qbt-pw-' + app, 'class': 'btn', 'style': 'display:none', 'click': ui.createHandlerFn(self, 'handleQbtPassword') }, _('Пароль WebUI')) ]) : '',
						self.appMeta[app].port ? E('a', {
							'id': 'opt-link-' + app, 'style': 'display:none; margin-left:1em',
							'href': window.location.protocol + '//' + window.location.hostname + ':' + self.appMeta[app].port + '/',
							/* без Referer: qBittorrent (защита от CSRF) отвечает 401 Unauthorized
						   на переход со страницы с другим портом (LuCI :80 → WebUI :8080) */
						'target': '_blank', 'rel': 'noopener noreferrer', 'referrerpolicy': 'no-referrer'
						}, _('Открыть веб-интерфейс →')) : ''
					])
				]));
			})(app);
		}

		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('ПО на внешнем диске')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Тяжёлые приложения ставятся на USB-диск (/mnt/sda1/opt), а не в память роутера. После загрузки роутера служба opt-apps дожидается диска и сама запускает приложения с включённым автозапуском.')),
			E('div', { 'id': 'opt-disk-status', 'class': 'alert-message' }, '…'),
			E('div', { 'style': 'margin:.5em 0' }, [
				E('button', { 'class': 'btn', 'click': ui.createHandlerFn(self, 'handleLog') }, _('Лог установки'))
			])
		].concat(cards));

		window.setTimeout(function() { self.pollStatus(); }, 300);
		return root;
	}
});
