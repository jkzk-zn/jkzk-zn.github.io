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

	window.startMode4 = ({ diagnostics } = {}) => {
		const app = ensureAppRoot();
		const panel = document.createElement('div');
		panel.className = 'app-message';

		const titleCn = document.createElement('div');
		titleCn.className = 'app-message-title';
		titleCn.textContent = '无连接，请检查相关设置和线路';

		const titleEn = document.createElement('div');
		titleEn.className = 'app-message-sub';
		titleEn.textContent =
			'No connection. Please check the relevant settings and cables.';

		const faq = document.createElement('div');
		faq.className = 'app-faq';

		const faqTitle = document.createElement('div');
		faqTitle.className = 'app-faq-title';
		faqTitle.textContent = 'FAQ / 常见问题';

		const list = document.createElement('ol');
		list.className = 'app-faq-list';

		const items = [
			{
				cn: '检查设备硬件连接',
				en: 'Check the device hardware connections.',
			},
			{
				cn: '检查平板网络设置',
				en: 'Check the tablet network settings.',
			},
			{
				cn: '联系我们：0313-3883554',
				en: 'Contact us: 0313-3883554',
			},
		];

		for (const it of items) {
			const li = document.createElement('li');
			li.className = 'app-faq-item';

			const cn = document.createElement('div');
			cn.className = 'app-faq-cn';
			cn.textContent = it.cn;

			const en = document.createElement('div');
			en.className = 'app-faq-en';
			en.textContent = it.en;

			li.append(cn, en);
			list.appendChild(li);
		}

		faq.append(faqTitle, list);
		panel.append(titleCn, titleEn, faq);
		app.appendChild(panel);
		window.AppModeDiagnostics = diagnostics;
	};
})();
