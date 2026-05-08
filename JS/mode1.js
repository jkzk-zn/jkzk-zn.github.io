(() => {
	'use strict';

	function ensureAppRoot() {
		let app = document.getElementById('app');
		if (!app) {
			app = document.createElement('div');
			app.id = 'app';
			document.body.innerHTML = '';
			document.body.appendChild(app);
		}
		app.innerHTML = '';
		return app;
	}

	window.startMode1 = ({ diagnostics } = {}) => {
		const app = ensureAppRoot();
		const panel = document.createElement('div');
		panel.className = 'app-message';

		const titleCn = document.createElement('div');
		titleCn.className = 'app-message-title';
		titleCn.textContent = '您正处于公网环境下，请关闭公网WIFI开关！';

		const titleEn = document.createElement('div');
		titleEn.className = 'app-message-sub';
		titleEn.textContent =
			'You are in a public network environment. Please turn off the public Wi-Fi switch.';

		panel.append(titleCn, titleEn);
		app.appendChild(panel);
		window.AppModeDiagnostics = diagnostics;
	};
})();
