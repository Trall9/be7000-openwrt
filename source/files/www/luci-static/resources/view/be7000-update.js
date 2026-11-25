'use strict';
'require view';
'require fs';
'require ui';

/* Обновление прошивки BE7000 в один клик: проверка новой версии, скачивание,
   проверка образа и прошивка с сохранением настроек и списка пакетов. */

var BIN = '/usr/bin/be7000-update';

function run(cmd) {
	return fs.exec(BIN, [cmd]).then(function(r) {
		try { return JSON.parse(r.stdout); } catch (e) { return { error: r.stderr || r.stdout || _('нет ответа') }; }
	}).catch(function(e) { return { error: e.message || String(e) }; });
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() { return run('check'); },

	show: function(s) {
		var box = document.getElementById('upd-box');
		if (s.error) {
			box.replaceChildren(E('p', { 'class': 'alert-message warning' }, s.error),
				E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, 'recheck') }, _('Проверить снова')));
			return;
		}
		var els = [ E('p', {}, [ _('Установлена: '), E('strong', {}, s.current + (s.variant == 'mini' ? ' (mini)' : '')) ]) ];
		if (!s.available) {
			els.push(E('p', {}, _('Обновлений нет — это последняя версия.')));
			els.push(E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, 'recheck') }, _('Проверить снова')));
		} else {
			els.push(E('p', {}, [ _('Доступна новая версия: '), E('strong', {}, s.latest), '. ',
				E('a', { 'href': s.notes, 'target': '_blank', 'rel': 'noreferrer' }, _('Что нового')) ]));
			if (s.blocked) {
				els.push(E('p', { 'class': 'alert-message warning' }, _('С версии %s на %s обновиться кнопкой нельзя (нужна версия не ниже %s) — установите вручную по инструкции к релизу.').format(s.current, s.latest, s.min)));
				box.replaceChildren.apply(box, els);
				return;
			}
			if (s.state == 'error')
				els.push(E('p', { 'class': 'alert-message warning' }, s.msg));
			els.push(E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, 'confirm', s) }, _('Обновить')));
		}
		box.replaceChildren.apply(box, els);
	},

	recheck: function() {
		return run('check').then(L.bind(this.show, this));
	},

	confirm: function(s) {
		ui.showModal(_('Обновление до %s').format(s.latest), [
			E('p', {}, _('Роутер скачает прошивку, проверит её и установит. Настройки и установленные пакеты сохранятся.')),
			E('p', {}, _('Интернет пропадёт примерно на 4–5 минут. Не выключайте питание роутера, пока он не загрузится.')),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Отмена')), ' ',
				E('button', { 'class': 'btn cbi-button-apply', 'click': ui.createHandlerFn(this, 'start') }, _('Обновить'))
			])
		]);
	},

	start: function() {
		var self = this;
		ui.showModal(_('Обновление'), [ E('p', { 'class': 'spinning', 'id': 'upd-step' }, _('Скачивание и проверка прошивки…')) ]);
		return fs.exec(BIN, ['download']).then(function() {
			return self.wait();
		});
	},

	wait: function() {
		var self = this;
		return new Promise(function(r) { window.setTimeout(r, 2000); }).then(function() {
			return run('status');
		}).then(function(s) {
			if (s.state == 'downloading')
				return self.wait();
			if (s.state != 'ready') {
				ui.hideModal();
				self.show(s.error ? s : Object.assign(s, { state: 'error', msg: s.msg || _('Не удалось подготовить прошивку') }));
				return;
			}
			document.getElementById('upd-step').textContent = _('Прошивка установлена в память, роутер перезагружается. Не выключайте питание…');
			return fs.exec(BIN, ['install']).catch(function() {}).then(function() {
				ui.awaitReconnect();
			});
		});
	},

	report: function() {
		var st = document.getElementById('rep-st');
		st.textContent = _('Сбор…');
		return fs.exec('/usr/bin/be7000-report').then(function(r) {
			if (r.code != 0) throw new Error(r.stderr || 'code ' + r.code);
			return fs.read_direct('/tmp/be7000-report.tar.gz', 'blob');
		}).then(function(b) {
			var a = E('a', { 'href': URL.createObjectURL(b), 'download': 'be7000-report-%s.tar.gz'.format(new Date().toISOString().slice(0, 10)) });
			document.body.appendChild(a); a.click(); a.remove();
			st.textContent = _('Готово — файл скачан. Приложите его к сообщению автору.');
		}).catch(function(e) { st.textContent = _('Ошибка: ') + (e.message || e); });
	},

	render: function(s) {
		var v = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Обновление прошивки')),
			E('div', { 'class': 'cbi-map-descr' }, _('Проверка и установка новой версии сборки в один клик. Обновление идёт с сохранением настроек и установленных пакетов — так же, как через «Резервная копия / Обновление ПО» с отмеченными галками.')),
			E('div', { 'class': 'cbi-section', 'id': 'upd-box' }),
			E('h3', {}, _('Отчёт для автора')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', {}, _('Если что-то работает не так — соберите отчёт и приложите файл к сообщению в теме прошивки. В нём журналы, состояние Wi-Fi, USB и сведения о сбоях. Пароли и ключи вырезаются, MAC-адреса и внешние IP скрываются.')),
				E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, 'report') }, _('Скачать отчёт')), ' ',
				E('span', { 'id': 'rep-st' })
			])
		]);
		window.setTimeout(L.bind(this.show, this, s), 0);
		return v;
	}
});
