'use strict';
'require view';
'require rpc';
'require ui';
'require fs';

/* Быстрая настройка VPN: вставить .conf (WireGuard/AmneziaWG) или ключ vpn://
   из приложения AmneziaVPN → выбрать «весь трафик» или «только сайты» → готово.
   Бэкенд: /usr/bin/be7000-vpn (интерфейс + зона vpn + правила pbr). */

var IMPORT_FILE = '/tmp/be7000-vpn-import.conf';

var PRESETS = [
	{ title: 'YouTube', domains: 'youtube.com youtu.be googlevideo.com ytimg.com ggpht.com youtube-nocookie.com youtubei.googleapis.com' },
	{ title: 'Instagram / Facebook', domains: 'instagram.com cdninstagram.com facebook.com fbcdn.net fb.com messenger.com' },
	{ title: 'X (Twitter)', domains: 'x.com twitter.com twimg.com t.co' },
	{ title: 'ChatGPT', domains: 'chatgpt.com openai.com oaistatic.com oaiusercontent.com' },
	{ title: 'Discord', domains: 'discord.com discord.gg discordapp.com discordapp.net discord.media' },
	{ title: 'Проверка (2ip)', domains: '2ip.ru 2ip.io' }
];

var fexec = rpc.declare({
	object: 'file', method: 'exec', params: ['command', 'params'],
	expect: { '': {} }
});

function fmtBytes(n) {
	if (n > 1073741824) return (n / 1073741824).toFixed(2) + ' ГБ';
	if (n > 1048576) return (n / 1048576).toFixed(1) + ' МБ';
	if (n > 1024) return (n / 1024).toFixed(0) + ' КБ';
	return n + ' Б';
}

function fmtAge(s) {
	if (s < 0) return null;
	if (s < 90) return s + ' с назад';
	if (s < 5400) return Math.round(s / 60) + ' мин назад';
	return Math.round(s / 3600) + ' ч назад';
}

/* vpn://<base64url(qCompress(JSON))> — формат ключей приложения AmneziaVPN.
   qCompress = 4 байта длины (big-endian) + поток zlib. */
function decodeAmneziaKey(key) {
	var b64 = key.trim().replace(/^vpn:\/\//, '').replace(/-/g, '+').replace(/_/g, '/');
	while (b64.length % 4) b64 += '=';
	var bin = atob(b64), bytes = new Uint8Array(bin.length);
	for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	if (typeof DecompressionStream === 'undefined')
		return Promise.reject(new Error(_('Браузер не умеет распаковывать ключи vpn:// — вставьте .conf')));
	var ds = new DecompressionStream('deflate');
	var stream = new Blob([bytes.slice(4)]).stream().pipeThrough(ds);
	// window.Response: внутри view LuCI «Response» — это его собственный класс запросов
	return new window.Response(stream).text().then(function(text) {
		var j = JSON.parse(text), conts = j.containers || [], pick = null;
		['amnezia-awg2', 'amnezia-awg', 'amnezia-wireguard'].forEach(function(name) {
			conts.forEach(function(c) { if (!pick && c.container == name) pick = c; });
		});
		if (!pick)
			throw new Error(_('В ключе нет AmneziaWG/WireGuard (поддерживаются только они; Xray/OpenVPN — нет)'));
		var p = pick.awg || pick.wireguard || {}, lc = p.last_config;
		if (typeof lc == 'string') lc = JSON.parse(lc);
		if (!lc || !lc.config) throw new Error(_('В ключе нет готовой конфигурации клиента'));
		return lc.config
			.replace(/\$PRIMARY_DNS/g, j.dns1 || '1.1.1.1')
			.replace(/\$SECONDARY_DNS/g, j.dns2 || '1.0.0.1');
	});
}

return view.extend({
	load: function() {
		return fexec('/usr/bin/be7000-vpn', ['status']);
	},

	parseStatus: function(res) {
		try { return JSON.parse(res.stdout).tunnels || []; } catch (e) { return []; }
	},

	renderTunnels: function(list) {
		var self = this, box = document.getElementById('vpn-tunnels');
		if (!box) return;
		if (!list.length) {
			box.replaceChildren(E('em', {}, _('Туннелей, созданных здесь, пока нет.')));
			return;
		}
		var rows = list.map(function(t) {
			var age = fmtAge(t.handshake_age);
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ E('strong', {}, t.name), E('br'),
					E('small', {}, t.proto == 'amneziawg' ? 'AmneziaWG' : 'WireGuard') ]),
				E('td', { 'class': 'td' }, t.mode == 'full' ? _('весь трафик устройств') :
					[ _('только сайты:'), E('br'), E('small', {}, t.sites) ]),
				E('td', { 'class': 'td' }, t.endpoint),
				E('td', { 'class': 'td' }, age && t.handshake_age < 180
					? E('span', { 'class': 'label label-success' }, _('работает') + ', ' + age)
					: E('span', { 'class': 'label label-important' }, age ? _('нет связи') + ' (' + age + ')' : _('нет связи'))),
				E('td', { 'class': 'td' }, '↓ ' + fmtBytes(t.rx) + ' ↑ ' + fmtBytes(t.tx)),
				E('td', { 'class': 'td' }, [
					E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(self, 'handleTest', t.name) }, _('Мой IP через VPN')),
					' ',
					E('button', { 'class': 'btn cbi-button-negative', 'click': ui.createHandlerFn(self, 'handleDelete', t.name) }, _('Удалить'))
				])
			]);
		});
		box.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Туннель')), E('th', { 'class': 'th' }, _('Что идёт через VPN')),
				E('th', { 'class': 'th' }, _('Сервер')), E('th', { 'class': 'th' }, _('Связь')),
				E('th', { 'class': 'th' }, _('Трафик')), E('th', { 'class': 'th' }, '')
			])
		].concat(rows)));
	},

	refresh: function() {
		var self = this;
		return fexec('/usr/bin/be7000-vpn', ['status']).then(function(res) {
			self.renderTunnels(self.parseStatus(res));
		});
	},

	handleTest: function(name) {
		return fexec('/usr/bin/be7000-vpn', ['test', name]).then(function(res) {
			ui.addNotification(null, E('p', {}, res.code == 0
				? _('Внешний IP через %s: %s').format(name, (res.stdout || '').trim())
				: _('Через %s ответа нет: %s').format(name, (res.stderr || '').trim())), res.code == 0 ? 'info' : 'warning');
		});
	},

	handleDelete: function(name) {
		var self = this;
		if (!confirm(_('Удалить туннель %s и его правила?').format(name))) return;
		return fexec('/usr/bin/be7000-vpn', ['delete', name]).then(function(res) {
			if (res.code != 0) ui.addNotification(null, E('p', {}, res.stderr || res.stdout), 'danger');
			return self.refresh();
		});
	},

	handleFile: function(ev) {
		var f = ev.target.files && ev.target.files[0];
		if (!f) return;
		f.text().then(function(t) { document.getElementById('vpn-conf').value = t; });
	},

	handleConnect: function() {
		var self = this;
		var raw = document.getElementById('vpn-conf').value.trim();
		var name = document.getElementById('vpn-name').value.trim() || 'vpn1';
		var mode = document.querySelector('input[name="vpn-mode"]:checked').value;
		var sites = document.getElementById('vpn-sites').value.split(/[\s,;]+/)
			.map(function(s) { return s.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(); })
			.filter(function(s) { return /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(s); });

		if (!raw) return ui.addNotification(null, E('p', {}, _('Вставьте конфигурацию или ключ vpn://')), 'warning');
		if (mode == 'sites' && !sites.length)
			return ui.addNotification(null, E('p', {}, _('Укажите хотя бы один сайт или выберите «весь трафик»')), 'warning');

		var confP = /^vpn:\/\//.test(raw) ? decodeAmneziaKey(raw) : Promise.resolve(raw);

		return confP.then(function(conf) {
			if (!/\[Interface\]/i.test(conf) || !/\[Peer\]/i.test(conf))
				throw new Error(_('Это не похоже на конфигурацию WireGuard/AmneziaWG (нет [Interface]/[Peer])'));
			ui.showModal(_('Подключение…'), [ E('p', { 'class': 'spinning' }, _('Создаю туннель и правила, ждём рукопожатия с сервером…')) ]);
			return fs.write(IMPORT_FILE, conf + '\n');
		}).then(function() {
			return fexec('/usr/bin/be7000-vpn', ['import', IMPORT_FILE, name, mode].concat(mode == 'sites' ? sites : []));
		}).then(function(res) {
			if (res.code != 0) throw new Error(res.stderr || res.stdout || 'error');
			return new Promise(function(r) { window.setTimeout(r, 9000); });
		}).then(function() {
			return fexec('/usr/bin/be7000-vpn', ['status']);
		}).then(function(res) {
			ui.hideModal();
			var t = self.parseStatus(res).filter(function(x) { return x.name == name; })[0];
			self.renderTunnels(self.parseStatus(res));
			document.getElementById('vpn-conf').value = '';
			if (t && t.handshake_age >= 0)
				ui.addNotification(null, E('p', {}, _('Готово: туннель %s связался с сервером. %s').format(name,
					mode == 'sites' ? _('Откройте один из указанных сайтов — он пойдёт через VPN.') : _('Весь интернет устройств сети идёт через VPN.'))), 'info');
			else
				ui.addNotification(null, E('p', {}, _('Туннель %s создан, но сервер пока не ответил. Проверьте, что конфигурация действующая (не отозвана) и не используется на другом устройстве одновременно.').format(name)), 'warning');
		}).catch(function(e) {
			ui.hideModal();
			fs.remove(IMPORT_FILE).catch(function() {});
			ui.addNotification(null, E('p', {}, _('Не получилось: %s').format(e.message || e)), 'danger');
		});
	},

	render: function(res) {
		var self = this;
		var presetBtns = PRESETS.map(function(p) {
			return E('button', { 'class': 'btn cbi-button', 'style': 'margin:0 .3em .3em 0', 'click': function(ev) {
				ev.preventDefault();
				var ta = document.getElementById('vpn-sites');
				var cur = ta.value.split(/\s+/).filter(Boolean);
				p.domains.split(' ').forEach(function(d) { if (cur.indexOf(d) < 0) cur.push(d); });
				ta.value = cur.join('\n');
				document.querySelector('input[name="vpn-mode"][value="sites"]').checked = true;
			} }, '+ ' + p.title);
		});

		var view = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('VPN — быстрая настройка')),
			E('div', { 'class': 'cbi-map-descr' }, _('Вставьте конфигурацию WireGuard / AmneziaWG (файл .conf) или ключ vpn:// из приложения AmneziaVPN, выберите, что пускать через VPN, и нажмите «Подключить». Интерфейс, межсетевой экран и маршрутизация настроятся сами. Для тонкой настройки есть Сеть → Интерфейсы и Службы → Policy Routing.')),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Мои туннели')),
				E('div', { 'id': 'vpn-tunnels' }, E('em', {}, '…'))
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Добавить туннель')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Конфигурация')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('textarea', { 'id': 'vpn-conf', 'rows': 9, 'style': 'width:100%; font-family:monospace',
							'placeholder': '[Interface]\nPrivateKey = …\nAddress = …\n\n[Peer]\nPublicKey = …\nEndpoint = …\n\n' + _('или ключ vpn://…') }),
						E('div', { 'style': 'margin-top:.4em' }, [
							E('input', { 'type': 'file', 'accept': '.conf,.txt,.vpn', 'change': ui.createHandlerFn(self, 'handleFile') })
						])
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Имя')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('input', { 'id': 'vpn-name', 'type': 'text', 'class': 'cbi-input-text', 'value': 'vpn1', 'maxlength': 11 }),
						E('div', { 'class': 'cbi-value-description' }, _('Латиница и цифры, до 11 символов, например vpn1, awg_nl.'))
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Через VPN')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('label', { 'style': 'display:block' }, [ E('input', { 'type': 'radio', 'name': 'vpn-mode', 'value': 'sites', 'checked': true }), ' ', _('только выбранные сайты (остальное — напрямую)') ]),
						E('label', { 'style': 'display:block' }, [ E('input', { 'type': 'radio', 'name': 'vpn-mode', 'value': 'full' }), ' ', _('весь трафик всех устройств сети') ]),
						E('div', { 'class': 'cbi-value-description' }, _('Сам роутер (обновления, торренты) всегда ходит напрямую. IPv6 для выбранных сайтов (или весь IPv6 устройств в режиме «весь трафик») закрывается, чтобы трафик не шёл мимо VPN.'))
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Сайты')),
					E('div', { 'class': 'cbi-value-field' }, [
						E('div', {}, presetBtns),
						E('textarea', { 'id': 'vpn-sites', 'rows': 5, 'style': 'width:100%; font-family:monospace', 'placeholder': 'example.com\nanother-site.org' }),
						E('div', { 'class': 'cbi-value-description' }, _('По одному домену в строке; поддомены включаются автоматически. Браузер должен брать DNS у роутера — «безопасный DNS» (DoH) в браузере отключите.'))
					])
				]),
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', { 'class': 'btn cbi-button-action important', 'click': ui.createHandlerFn(self, 'handleConnect') }, _('Подключить'))
				])
			])
		]);

		window.setTimeout(function() { self.renderTunnels(self.parseStatus(res)); }, 0);
		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
