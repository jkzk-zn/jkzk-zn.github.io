(() => {
	'use strict';

	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker
				.register('./sw.js')
				.then((reg) => {
					window.AppServiceWorker = reg;
				})
				.catch(() => {});
		});
	}

	const MODE_ENTRY = {
		mode1: 'startMode1',
		mode2: 'startMode2',
		mode3: 'startMode3',
		mode4: 'startMode4',
	};

	const TARGETS = [
		{
			mode: 'mode1',
			name: '外网',
			url: 'https://www.baidu.com/',
			timeoutMs: 1000,
		},
		{
			mode: 'mode2',
			name: '内网WiFi',
			url: '/proxy/wifi/',
			timeoutMs: 1500,
		},
		{
			mode: 'mode3',
			name: '内网有线',
			url: '/proxy/lan/',
			timeoutMs: 1500,
		},
	];

	const INTERNAL_TARGETS = TARGETS.filter(
		(t) => t.mode === 'mode2' || t.mode === 'mode3',
	);

	const EXTERNAL_TARGET = TARGETS.find((t) => t.mode === 'mode1') ?? null;

	const AppReload = (() => {
		let autoReloadTimerId = null;
		let pullEnabled = false;
		let listenersAttached = false;
		let touchActive = false;
		let startY = 0;
		let startX = 0;
		let maxDeltaY = 0;

		function getThresholdPx() {
			const h = Math.max(0, window.innerHeight || 0);
			return Math.min(260, Math.max(140, Math.round(h * 0.25)));
		}

		function reloadNow() {
			try {
				window.location.reload();
			} catch {
				window.location.href = window.location.href;
			}
		}

		function clearAutoReload() {
			if (autoReloadTimerId != null) {
				window.clearTimeout(autoReloadTimerId);
				autoReloadTimerId = null;
			}
		}

		function setAutoReload(ms) {
			clearAutoReload();
			autoReloadTimerId = window.setTimeout(() => {
				reloadNow();
			}, ms);
		}

		function onTouchStart(e) {
			if (!pullEnabled) return;
			if (!e.touches || e.touches.length !== 1) return;
			touchActive = true;
			maxDeltaY = 0;
			startY = e.touches[0].clientY;
			startX = e.touches[0].clientX;
		}

		function onTouchMove(e) {
			if (!pullEnabled || !touchActive) return;
			if (!e.touches || e.touches.length !== 1) return;
			const dy = e.touches[0].clientY - startY;
			const dx = e.touches[0].clientX - startX;
			if (Math.abs(dx) > 120) return;
			if (dy <= 0) return;
			maxDeltaY = Math.max(maxDeltaY, dy);
		}

		function onTouchEnd() {
			if (!pullEnabled) return;
			if (!touchActive) return;
			touchActive = false;
			if (maxDeltaY >= getThresholdPx()) reloadNow();
		}

		function onTouchCancel() {
			touchActive = false;
			maxDeltaY = 0;
		}

		function attachListeners() {
			if (listenersAttached) return;
			listenersAttached = true;
			document.addEventListener('touchstart', onTouchStart, { passive: true });
			document.addEventListener('touchmove', onTouchMove, { passive: true });
			document.addEventListener('touchend', onTouchEnd, { passive: true });
			document.addEventListener('touchcancel', onTouchCancel, { passive: true });
		}

		function enable({ autoReloadMs, pullToRefresh } = {}) {
			if (typeof autoReloadMs === 'number' && autoReloadMs > 0) {
				setAutoReload(autoReloadMs);
			} else {
				clearAutoReload();
			}

			pullEnabled = Boolean(pullToRefresh);
			if (pullEnabled) attachListeners();
		}

		function disable() {
			clearAutoReload();
			pullEnabled = false;
			touchActive = false;
			maxDeltaY = 0;
		}

		return {
			enable,
			disable,
			reloadNow,
			setAutoReload,
			clearAutoReload,
		};
	})();

	window.AppReload = AppReload;

	function cacheBust(url) {
		const u = new URL(url, window.location.href);
		u.searchParams.set('_probe', Date.now().toString(36));
		return u.toString();
	}

	function timeoutAfter(ms) {
		return new Promise((_, reject) => {
			window.setTimeout(() => reject(new Error('timeout')), ms);
		});
	}

	async function probeUrl(url, timeoutMs) {
		if (typeof fetch !== 'function') return false;

		try {
			const finalUrl = cacheBust(url);
			let sameOrigin = false;
			try {
				sameOrigin = new URL(finalUrl).origin === window.location.origin;
			} catch {
				sameOrigin = false;
			}

			const requestInit = {
				method: 'GET',
				mode: sameOrigin ? 'same-origin' : 'no-cors',
				cache: 'no-store',
				redirect: 'follow',
			};

			const isSuccess = (response) => {
				if (!sameOrigin) return true;
				if (!response) return false;
				if (response.type === 'opaque') return true;
				return response.status >= 200 && response.status < 400;
			};

			if (typeof AbortController === 'undefined') {
				const response = await Promise.race([
					fetch(finalUrl, requestInit),
					timeoutAfter(timeoutMs),
				]);
				return isSuccess(response);
			}

			const controller = new AbortController();
			const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
			try {
				const response = await fetch(finalUrl, {
					...requestInit,
					signal: controller.signal,
				});
				return isSuccess(response);
			} finally {
				window.clearTimeout(timeoutId);
			}
		} catch {
			return false;
		}
	}

	async function selectModeByFirstSuccess(targets, fallbackMode) {
		const startedAt = performance.now();

		const tasks = targets.map((t, idx) => {
			const taskStartedAt = performance.now();
			return {
				idx,
				promise: (async () => {
					const ok = await probeUrl(t.url, t.timeoutMs);
					return {
						idx,
						mode: t.mode,
						name: t.name,
						url: t.url,
						ok,
						timeoutMs: t.timeoutMs,
						elapsedMs: Math.round(performance.now() - taskStartedAt),
					};
				})(),
			};
		});

		const pending = [...tasks];
		const results = [];

		while (pending.length) {
			const r = await Promise.race(pending.map((x) => x.promise));
			results.push(r);
			const i = pending.findIndex((x) => x.idx === r.idx);
			if (i >= 0) pending.splice(i, 1);
			if (r.ok) {
				return {
					mode: r.mode,
					winner: r,
					results,
					elapsedMs: Math.round(performance.now() - startedAt),
				};
			}
		}

		return {
			mode: fallbackMode ?? null,
			winner: null,
			results,
			elapsedMs: Math.round(performance.now() - startedAt),
		};
	}

	function buildProbeResult(target, ok, startedAt, idxOverride) {
		return {
			idx: typeof idxOverride === 'number' ? idxOverride : 0,
			mode: target.mode,
			name: target.name,
			url: target.url,
			ok,
			timeoutMs: target.timeoutMs,
			elapsedMs: Math.round(performance.now() - startedAt),
		};
	}

	async function selectInitialMode() {
		if (!EXTERNAL_TARGET) {
			return selectModeByFirstSuccess(INTERNAL_TARGETS, 'mode4');
		}

		const startedAt = performance.now();
		const externalStartedAt = performance.now();
		const externalOk = await probeUrl(
			EXTERNAL_TARGET.url,
			EXTERNAL_TARGET.timeoutMs,
		);
		const externalResult = buildProbeResult(
			EXTERNAL_TARGET,
			externalOk,
			externalStartedAt,
			-1,
		);

		if (externalOk) {
			return {
				mode: EXTERNAL_TARGET.mode,
				winner: externalResult,
				results: [externalResult],
				elapsedMs: Math.round(performance.now() - startedAt),
			};
		}

		const internalSelection = await selectModeByFirstSuccess(
			INTERNAL_TARGETS,
			'mode4',
		);
		return {
			...internalSelection,
			results: [externalResult, ...internalSelection.results],
			elapsedMs: Math.round(performance.now() - startedAt),
		};
	}

	const InternalWatch = (() => {
		let intervalId = null;
		let running = false;

		function clear() {
			if (intervalId != null) {
				window.clearInterval(intervalId);
				intervalId = null;
			}
		}

		async function runOnce() {
			if (running) return;
			running = true;
			try {
				if (EXTERNAL_TARGET) {
					const externalOk = await probeUrl(
						EXTERNAL_TARGET.url,
						EXTERNAL_TARGET.timeoutMs,
					);
					if (externalOk) {
						if (window.APP_MODE !== 'mode1') {
							startMode('mode1', {
								source: 'external-poll',
								winner: {
									idx: -1,
									mode: EXTERNAL_TARGET.mode,
									name: EXTERNAL_TARGET.name,
									url: EXTERNAL_TARGET.url,
									ok: true,
									timeoutMs: EXTERNAL_TARGET.timeoutMs,
									elapsedMs: 0,
								},
								results: [],
								elapsedMs: 0,
							});
						}
						return;
					}
				}

				const selection = await selectModeByFirstSuccess(
					INTERNAL_TARGETS,
					null,
				);
				if (!selection.mode) return;
				if (selection.mode === window.APP_MODE) return;
				startMode(selection.mode, {
					...selection,
					source: 'internal-poll',
				});
			} finally {
				running = false;
			}
		}

		function enable(intervalMs = 3000) {
			clear();
			if (!INTERNAL_TARGETS.length) return;
			intervalId = window.setInterval(runOnce, intervalMs);
			runOnce();
		}

		function disable() {
			clear();
			running = false;
		}

		return {
			enable,
			disable,
		};
	})();

	function startMode(mode, diagnostics) {
		window.AppModes = window.AppModes ?? {};
		window.APP_MODE = mode;
		document.documentElement.dataset.appMode = mode;

		if (mode === 'mode1' || mode === 'mode4') {
			AppReload.enable({ pullToRefresh: true });
			InternalWatch.enable(3000);
		} else {
			InternalWatch.disable();
			AppReload.disable();
		}

		const entryName = MODE_ENTRY[mode];
		const entryFn = entryName ? window[entryName] : undefined;
		if (typeof entryFn === 'function') {
			entryFn({ mode, diagnostics });
		} else {
			const init = window.AppModes?.[mode];
			if (typeof init === 'function') init({ mode, diagnostics });
		}

		window.dispatchEvent(
			new CustomEvent('app:mode-selected', { detail: { mode, diagnostics } }),
		);
	}

	const domReadyPromise =
		document.readyState === 'loading'
			? new Promise((resolve) =>
				document.addEventListener('DOMContentLoaded', resolve, { once: true }),
			)
			: Promise.resolve();

	const selectionPromise = selectInitialMode().catch(
		(err) => ({
			mode: 'mode4',
			winner: null,
			results: [
				{
					idx: -1,
					mode: 'mode4',
					name: '异常',
					url: '',
					ok: false,
					timeoutMs: 0,
					elapsedMs: 0,
					reason: String(err?.message ?? err),
				},
			],
			elapsedMs: 0,
		}),
	);

	let started = false;
	Promise.all([domReadyPromise, selectionPromise]).then(([, selection]) => {
		if (started) return;
		started = true;
		const { mode, ...diagnostics } = selection;
		startMode(mode, diagnostics);
	});
})();