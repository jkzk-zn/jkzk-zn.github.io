(() => {
  "use strict";

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

  window.startMode1 = ({ diagnostics } = {}) => {
    const app = ensureAppRoot();
    const panel = document.createElement("div");
    panel.className = "app-message";

    const titleCn = document.createElement("div");
    titleCn.className = "app-message-title";
    titleCn.textContent = "检测到WIFI连接到互联网，请关闭WIFI开关！";

    const titleEn = document.createElement("div");
    titleEn.className = "app-message-sub";
    titleEn.textContent =
      "Detected that WIFI is connected to the internet. Please turn off the WIFI switch!";

    panel.append(titleCn, titleEn);
    app.appendChild(panel);
    window.AppModeDiagnostics = diagnostics;
  };
})();
