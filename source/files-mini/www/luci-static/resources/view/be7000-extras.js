'use strict';
'require view';
'require form';

/* Ночной режим подсветки, расписание Wi-Fi и действие кнопки WPS (/etc/config/be7000). */

function hhmm(id, v) { return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v) ? true : _('Время в формате ЧЧ:ММ, например 23:00'); }

return view.extend({
	render: function() {
		var m = new form.Map('be7000', _('Подсветка, кнопка и расписание Wi-Fi')), s, o;

		s = m.section(form.NamedSection, 'leds', 'leds', _('Ночной режим подсветки'),
			_('Все светодиоды гаснут на заданное время, потом возвращаются как были (настройки из «Система → Светодиоды»).'));
		s.option(form.Flag, 'night', _('Включить'));
		o = s.option(form.Value, 'off', _('Гасить в')); o.validate = hhmm; o.depends('night', '1');
		o = s.option(form.Value, 'on', _('Включать в')); o.validate = hhmm; o.depends('night', '1');

		s = m.section(form.NamedSection, 'wifi_schedule', 'wifi_schedule', _('Расписание Wi-Fi'),
			_('Wi-Fi (все сети, включая гостевую) выключается в заданное время и включается обратно. Включение срабатывает каждый день. Кабельные подключения работают всегда.'));
		s.option(form.Flag, 'enabled', _('Включить'));
		o = s.option(form.Value, 'off', _('Выключать в')); o.validate = hhmm; o.depends('enabled', '1');
		o = s.option(form.Value, 'on', _('Включать в')); o.validate = hhmm; o.depends('enabled', '1');
		o = s.option(form.ListValue, 'days', _('Дни выключения'), _('День, в который наступает время выключения: 01:00 в понедельник — это ночь с воскресенья на понедельник.'));
		o.value('*', _('Каждый день'));
		o.value('1-5', _('Только по будням (пн–пт)'));
		o.value('0,6', _('Только по выходным (сб, вс)'));
		o.depends('enabled', '1');

		s = m.section(form.NamedSection, 'button', 'button', _('Кнопка WPS'));
		o = s.option(form.ListValue, 'wps', _('Короткое нажатие'));
		o.value('wps', _('Подключение по WPS (как обычно)'));
		o.value('wifi', _('Выключить / включить Wi-Fi'));
		o.value('leds', _('Погасить / зажечь подсветку'));

		return m.render();
	}
});
