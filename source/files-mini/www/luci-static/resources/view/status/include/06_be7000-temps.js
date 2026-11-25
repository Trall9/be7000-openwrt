'use strict';
'require baseclass';
'require fs';

/* Температуры: процессор, NSS, Wi-Fi и USB-диски (be7000-temps, диски — из кэша). */

return baseclass.extend({
	title: _('Температуры'),

	load: function() {
		return L.resolveDefault(fs.exec_direct('/usr/bin/be7000-temps', [], 'json'), null);
	},

	render: function(t) {
		if (!Array.isArray(t) || !t.length)
			return null;
		var table = E('table', { 'class': 'table' });
		t.forEach(function(s) {
			var hot = s.t >= (s.name.indexOf('Диск') == 0 ? 60 : 85);
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, s.name),
				E('td', { 'class': 'td left' }, hot ? E('strong', { 'style': 'color:#c00' }, s.t + ' °C') : s.t + ' °C')
			]));
		});
		return table;
	}
});
