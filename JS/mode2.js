(() => {
  "use strict";

  function getIframeSrc() {
    return window.AppConfig?.internalWifiUrl || "http://192.168.1.136:8080/";
  }

  function cacheBust(url) {
    const u = new URL(url, window.location.href);
    u.searchParams.set("_reload", Date.now().toString(36));
    return u.toString();
  }

  function ensureAppRoot() {
    let app = document.getElementById("app");
    if (!app) {
      app = document.createElement("div");
      app.id = "app";
      document.body.innerHTML = "";
      document.body.appendChild(app);
    }
    app.innerHTML = "";
    return app;
  }

  function toggleFullscreen(el) {
    try {
      if (!document.fullscreenElement) {
        el.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch {
      // ignore
    }
  }

  window.startMode2 = ({ diagnostics } = {}) => {
    const app = ensureAppRoot();
    const iframeSrc = getIframeSrc();

    const iframe = document.createElement("iframe");
    iframe.className = "app-iframe";
    iframe.src = iframeSrc;
    iframe.setAttribute("allowfullscreen", "");
    iframe.allow = "fullscreen";
    app.appendChild(iframe);

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "fullscreen-btn refresh-btn";
    refreshBtn.setAttribute("aria-label", "刷新");
    refreshBtn.textContent = "↻";
    refreshBtn.addEventListener("click", () => {
      iframe.src = cacheBust(iframeSrc);
    });
    app.appendChild(refreshBtn);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fullscreen-btn";
    btn.setAttribute("aria-label", "全屏");
    btn.textContent = "⛶";
    btn.addEventListener("click", () => toggleFullscreen(app));
    app.appendChild(btn);

    toggleFullscreen(app);

    window.AppModeDiagnostics = diagnostics;
  };
})();
