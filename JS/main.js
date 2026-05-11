(async () => {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          window.AppServiceWorker = reg;
        })
        .catch(() => {});
    });
  }

  const MODE_ENTRY = {
    mode1: "startMode1",
    mode2: "startMode2",
    mode3: "startMode3",
    mode4: "startMode4",
  };

  const INTERNAL_WIFI_URL = "http://192.168.1.136:8080/";
  const INTERNAL_LAN_URL = "http://192.168.2.136:8080/";
  const IOT_CACHE_NAME = "app-config-v1";
  const IOT_CACHE_KEY = "/config/iot";

  async function loadIoTConfig() {
    try {
      if (typeof caches === "undefined") return null;
      const cache = await caches.open(IOT_CACHE_NAME);
      const resp = await cache.match(IOT_CACHE_KEY);
      if (!resp) return null;
      const data = await resp.json();
      if (
        data &&
        typeof data.ip === "string" &&
        typeof data.port === "string"
      ) {
        const portNum = Number(data.port);
        if (portNum > 0 && portNum < 65536) {
          return { ip: data.ip.trim(), port: String(portNum) };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async function saveIoTConfig(ip, port) {
    try {
      if (typeof caches === "undefined") return false;
      const cache = await caches.open(IOT_CACHE_NAME);
      const payload = JSON.stringify({
        ip: ip.trim(),
        port: String(port),
        savedAt: Date.now(),
      });
      const resp = new Response(payload, {
        headers: { "Content-Type": "application/json" },
      });
      await cache.put(IOT_CACHE_KEY, resp);
      return true;
    } catch {
      return false;
    }
  }

  window.IoTConfig = { load: loadIoTConfig, save: saveIoTConfig };

  const iotConfig = await loadIoTConfig();

  window.AppConfig = {
    build: "2026-05-08",
    internalWifiUrl: INTERNAL_WIFI_URL,
    internalLanUrl: INTERNAL_LAN_URL,
    iotUrl: iotConfig ? `http://${iotConfig.ip}:${iotConfig.port}/` : null,
  };

  const TARGETS = [
    {
      mode: "mode3",
      name: "内网有线",
      url: INTERNAL_LAN_URL,
      timeoutMs: 1000,
    },
    ...(iotConfig
      ? [
          {
            mode: "mode3",
            name: "物联网卡",
            url: `http://${iotConfig.ip}:${iotConfig.port}/`,
            timeoutMs: 1000,
          },
        ]
      : []),
    {
      mode: "mode2",
      name: "内网WiFi",
      url: INTERNAL_WIFI_URL,
      timeoutMs: 1000,
    },
    {
      mode: "mode1",
      name: "外网",
      url: "https://www.baidu.com/",
      timeoutMs: 1000,
    },
  ];

  const INTERNAL_TARGETS = TARGETS.filter(
    (t) => t.mode === "mode2" || t.mode === "mode3",
  );

  const PRIORITY_TARGETS = TARGETS.slice();
  const INTERNAL_PRIORITY_TARGETS = TARGETS.filter(
    (t) => t.mode === "mode2" || t.mode === "mode3",
  );

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
      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd, { passive: true });
      document.addEventListener("touchcancel", onTouchCancel, {
        passive: true,
      });
    }

    function enable({ autoReloadMs, pullToRefresh } = {}) {
      if (typeof autoReloadMs === "number" && autoReloadMs > 0) {
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
    u.searchParams.set("_probe", Date.now().toString(36));
    return u.toString();
  }

  function timeoutAfter(ms) {
    return new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    });
  }

  async function probeUrl(url, timeoutMs) {
    if (typeof fetch !== "function") return false;

    try {
      const finalUrl = cacheBust(url);
      let sameOrigin = false;
      try {
        sameOrigin = new URL(finalUrl).origin === window.location.origin;
      } catch {
        sameOrigin = false;
      }

      const requestInit = {
        method: sameOrigin ? "HEAD" : "GET",
        mode: sameOrigin ? "same-origin" : "no-cors",
        cache: "no-store",
        redirect: "follow",
      };

      const isSuccess = (response) => {
        if (!sameOrigin) return true;
        if (!response) return false;
        if (response.type === "opaque") return true;
        return response.status >= 200 && response.status < 400;
      };

      if (typeof AbortController === "undefined") {
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

  async function selectModeByPriority(targets, fallbackMode) {
    const startedAt = performance.now();
    const tasks = targets.map((t, idx) => {
      const taskStartedAt = performance.now();
      return probeUrl(t.url, t.timeoutMs)
        .then((ok) => ({
          idx,
          mode: t.mode,
          name: t.name,
          url: t.url,
          ok,
          timeoutMs: t.timeoutMs,
          elapsedMs: Math.round(performance.now() - taskStartedAt),
        }))
        .catch((err) => ({
          idx,
          mode: t.mode,
          name: t.name,
          url: t.url,
          ok: false,
          timeoutMs: t.timeoutMs,
          elapsedMs: Math.round(performance.now() - taskStartedAt),
          reason: String(err?.message ?? err),
        }));
    });

    const results = [];
    for (let idx = 0; idx < tasks.length; idx += 1) {
      const r = await tasks[idx];
      results.push(r);
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
      const currentMode = window.APP_MODE;
      if (currentMode !== "mode1" && currentMode !== "mode4") return;

      running = true;
      try {
        const externalTarget = TARGETS.find((t) => t.mode === "mode1");
        const externalStartedAt = performance.now();
        const externalPromise = externalTarget
          ? probeUrl(externalTarget.url, externalTarget.timeoutMs)
              .then((ok) => ({
                mode: externalTarget.mode,
                name: externalTarget.name,
                url: externalTarget.url,
                ok,
                timeoutMs: externalTarget.timeoutMs,
                elapsedMs: Math.round(performance.now() - externalStartedAt),
              }))
              .catch((err) => ({
                mode: externalTarget.mode,
                name: externalTarget.name,
                url: externalTarget.url,
                ok: false,
                timeoutMs: externalTarget.timeoutMs,
                elapsedMs: Math.round(performance.now() - externalStartedAt),
                reason: String(err?.message ?? err),
              }))
          : Promise.resolve(null);

        const internalSelection = await selectModeByPriority(
          INTERNAL_PRIORITY_TARGETS,
          null,
        );

        if (internalSelection.mode && internalSelection.mode !== currentMode) {
          if (
            internalSelection.mode === "mode3" &&
            internalSelection.winner?.name === "物联网卡"
          ) {
            window.AppConfig.activeLanUrl = internalSelection.winner.url;
          } else if (internalSelection.mode === "mode3") {
            delete window.AppConfig.activeLanUrl;
          }
          startMode(internalSelection.mode, {
            ...internalSelection,
            source: "poll",
          });
          return;
        }

        const external = await externalPromise;
        const externalOk = Boolean(external?.ok);
        if (!internalSelection.mode) {
          if (currentMode === "mode1" && !externalOk) {
            startMode("mode4", {
              source: "poll",
              internal: internalSelection,
              external,
            });
          } else if (currentMode === "mode4" && externalOk) {
            startMode("mode1", {
              source: "poll",
              internal: internalSelection,
              external,
            });
          }
        }
      } finally {
        running = false;
      }
    }

    function enable(intervalMs = 1500) {
      clear();
      if (!INTERNAL_TARGETS.length && !TARGETS.some((t) => t.mode === "mode1"))
        return;
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
    if (mode === "mode3" && diagnostics?.winner?.name === "物联网卡") {
      window.AppConfig.activeLanUrl = diagnostics.winner.url;
    } else if (mode === "mode3") {
      delete window.AppConfig.activeLanUrl;
    }

    if (mode === "mode1" || mode === "mode4") {
      AppReload.enable({ pullToRefresh: true });
      InternalWatch.enable(1500);
    } else {
      InternalWatch.disable();
      AppReload.disable();
    }

    const entryName = MODE_ENTRY[mode];
    const entryFn = entryName ? window[entryName] : undefined;
    if (typeof entryFn === "function") {
      entryFn({ mode, diagnostics });
    } else {
      const init = window.AppModes?.[mode];
      if (typeof init === "function") init({ mode, diagnostics });
    }

    window.dispatchEvent(
      new CustomEvent("app:mode-selected", { detail: { mode, diagnostics } }),
    );
  }

  const domReadyPromise =
    document.readyState === "loading"
      ? new Promise((resolve) =>
          document.addEventListener("DOMContentLoaded", resolve, {
            once: true,
          }),
        )
      : Promise.resolve();

  const selectionPromise = selectModeByPriority(
    PRIORITY_TARGETS,
    "mode4",
  ).catch((err) => ({
    mode: "mode4",
    winner: null,
    results: [
      {
        idx: -1,
        mode: "mode4",
        name: "异常",
        url: "",
        ok: false,
        timeoutMs: 0,
        elapsedMs: 0,
        reason: String(err?.message ?? err),
      },
    ],
    elapsedMs: 0,
  }));

  let started = false;
  Promise.all([domReadyPromise, selectionPromise]).then(([, selection]) => {
    if (started) return;
    started = true;
    const { mode, ...diagnostics } = selection;
    if (mode === "mode3" && diagnostics?.winner?.name === "物联网卡") {
      window.AppConfig.activeLanUrl = diagnostics.winner.url;
    }
    startMode(mode, diagnostics);
  });
})();
