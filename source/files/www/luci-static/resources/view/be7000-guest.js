'use strict';
'require view';
'require form';

/* Гостевая сеть: отдельная точка доступа на всех радио, только интернет.
   Секции создаёт /usr/libexec/be7000-features при сохранении. */

return view.extend({
	render: function() {
		var m = new form.Map('be7000', _('Гостевая сеть'),
			_('Отдельная сеть Wi-Fi для гостей: только интернет, без доступа к роутеру, дискам, принтерам и другим устройствам дома; гости не видят и друг друга. Адреса — 192.168.77.x, только IPv4. При сохранении Wi-Fi на несколько секунд перезапустится.'));
		var s = m.section(form.NamedSection, 'guest', 'guest');
		s.addremove = false;
		s.option(form.Flag, 'enabled', _('Включить'));
		var o = s.option(form.Value, 'ssid', _('Имя сети (SSID)'));
		o.datatype = 'maxlength(32)';
		o.rmempty = false;
		o = s.option(form.Value, 'key', _('Пароль'), _('Пусто — открытая сеть без пароля. Иначе не короче 8 символов (WPA2/WPA3).'));
		o.password = true;
		o.validate = function(id, v) { return (!v || v.length >= 8 && v.length <= 63) ? true : _('От 8 до 63 символов или пусто'); };
		return m.render();
	}
});
