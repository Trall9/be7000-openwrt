'use strict';
'require baseclass';
'require fs';

/* Уведомление о новой версии на главной: читает кэш проверки (cron раз в сутки),
   в сеть не ходит. Нет обновления — блок скрыт. */

return baseclass.extend({
	title: _('Обновление прошивки'),

	load: function() {
		return L.resolveDefault(fs.exec_direct('/usr/bin/be7000-update', ['status'], 'json'), null);
	},

	render: function(s) {
		if (!s || !s.available)
			return null;
		return E('p', {}, [ _('Доступна новая версия сборки: '), E('strong', {}, s.latest), ' — ',
			E('a', { 'href': L.url('admin/system/be7000-update') }, _('обновить')) ]);
	}
});
