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

  function createIoTConfigPanel() {
    const existing = document.querySelector(".iot-config-panel");
    if (existing) {
      existing.classList.remove("iot-config-hidden");
      if (typeof existing.__iotOpen === "function") existing.__iotOpen();
      return existing;
    }

    const DEFAULT_PIN = "1234";

    const panel = document.createElement("div");
    panel.className = "iot-config-panel iot-config-hidden";

    const title = document.createElement("div");
    title.className = "iot-config-title";
    title.textContent = "物联网卡配置";
    panel.appendChild(title);

    const pinRow = document.createElement("div");
    pinRow.className = "iot-config-row";
    const pinLabel = document.createElement("span");
    pinLabel.textContent = "PIN：";
    const pinInput = document.createElement("input");
    pinInput.type = "password";
    pinInput.className = "iot-config-input";
    pinInput.placeholder = "请输入PIN码";
    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "iot-config-btn";
    pinBtn.textContent = "确认";
    pinRow.append(pinLabel, pinInput, pinBtn);
    panel.appendChild(pinRow);

    const configRow = document.createElement("div");
    configRow.className = "iot-config-row iot-config-hidden";
    const ipLabel = document.createElement("span");
    ipLabel.textContent = "IP：";
    const ipInput = document.createElement("input");
    ipInput.type = "text";
    ipInput.className = "iot-config-input";
    ipInput.placeholder = "192.168.x.x";
    const portLabel = document.createElement("span");
    portLabel.textContent = "端口：";
    const portInput = document.createElement("input");
    portInput.type = "text";
    portInput.className = "iot-config-input iot-config-input-port";
    portInput.placeholder = "8080";
    configRow.append(ipLabel, ipInput, portLabel, portInput);
    panel.appendChild(configRow);

    const msg = document.createElement("div");
    msg.className = "iot-config-msg";
    panel.appendChild(msg);

    const btnRow = document.createElement("div");
    btnRow.className = "iot-config-btns";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "iot-config-btn";
    saveBtn.textContent = "保存";
    saveBtn.disabled = true;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "iot-config-btn iot-config-btn-cancel";
    cancelBtn.textContent = "取消";

    function setMsg(text, kind) {
      msg.textContent = text || "";
      if (kind === "success")
        msg.className = "iot-config-msg iot-config-success";
      else if (kind === "error")
        msg.className = "iot-config-msg iot-config-error";
      else msg.className = "iot-config-msg";
    }

    function validateIP(ip) {
      const parts = ip.split(".");
      if (parts.length !== 4) return false;
      return parts.every(function (p) {
        var n = Number(p);
        return p === String(n) && n >= 0 && n <= 255;
      });
    }

    function validatePort(p) {
      var n = Number(p);
      return p === String(n) && Number.isInteger(n) && n > 0 && n < 65536;
    }

    async function unlockInputs() {
      var pin = pinInput.value.trim();
      if (pin !== DEFAULT_PIN) {
        setMsg("PIN 码错误", "error");
        return;
      }
      setMsg("", "");
      pinInput.disabled = true;
      pinBtn.disabled = true;
      pinRow.classList.add("iot-config-hidden");
      configRow.classList.remove("iot-config-hidden");
      saveBtn.disabled = false;

      try {
        if (window.IoTConfig && typeof window.IoTConfig.load === "function") {
          var saved = await window.IoTConfig.load();
          if (saved && typeof saved.ip === "string") ipInput.value = saved.ip;
          if (saved && typeof saved.port === "string")
            portInput.value = saved.port;
        }
      } catch {}

      try {
        ipInput.focus();
        if (typeof ipInput.select === "function") ipInput.select();
      } catch {}
    }

    pinBtn.addEventListener("click", function () {
      unlockInputs();
    });
    pinInput.addEventListener("keydown", function (e) {
      if (e && e.key === "Enter") unlockInputs();
    });

    saveBtn.addEventListener("click", async function () {
      if (configRow.classList.contains("iot-config-hidden")) {
        setMsg("请先输入 PIN 码", "error");
        return;
      }
      var ip = ipInput.value.trim();
      var port = portInput.value.trim();

      if (!validateIP(ip)) {
        setMsg("IP 格式不正确", "error");
        return;
      }
      if (!validatePort(port)) {
        setMsg("端口格式不正确（1-65535）", "error");
        return;
      }

      var ok = false;
      if (window.IoTConfig && typeof window.IoTConfig.save === "function") {
        ok = await window.IoTConfig.save(ip, port);
      }
      if (ok) {
        setMsg("已保存，正在刷新页面…", "success");
        ipInput.disabled = true;
        portInput.disabled = true;
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        setTimeout(function () {
          try {
            window.location.reload();
          } catch {
            window.location.href = window.location.href;
          }
        }, 300);
      } else {
        setMsg("保存失败", "error");
      }
    });

    cancelBtn.addEventListener("click", function () {
      panel.classList.add("iot-config-hidden");
    });

    btnRow.append(saveBtn, cancelBtn);
    panel.appendChild(btnRow);

    panel.__iotOpen = function () {
      panel.classList.remove("iot-config-hidden");
      pinRow.classList.remove("iot-config-hidden");
      configRow.classList.add("iot-config-hidden");
      pinInput.disabled = false;
      pinBtn.disabled = false;
      pinInput.value = "";
      ipInput.value = "";
      portInput.value = "";
      ipInput.disabled = false;
      portInput.disabled = false;
      saveBtn.disabled = true;
      cancelBtn.disabled = false;
      setMsg("", "");
      try {
        pinInput.focus();
      } catch {}
    };

    panel.__iotOpen();

    return panel;
  }

  window.startMode4 = function (opts) {
    var diagnostics = opts && opts.diagnostics;
    var app = ensureAppRoot();
    var panel = document.createElement("div");
    panel.className = "app-message";

    var titleCn = document.createElement("div");
    titleCn.className = "app-message-title";
    titleCn.textContent = "无连接，请检查相关设置和线路";

    var titleEn = document.createElement("div");
    titleEn.className = "app-message-sub";
    titleEn.textContent =
      "No connection. Please check the relevant settings and cables.";

    var faq = document.createElement("div");
    faq.className = "app-faq";

    var faqTitle = document.createElement("div");
    faqTitle.className = "app-faq-title";
    faqTitle.textContent = "FAQ / 常见问题";

    var list = document.createElement("ol");
    list.className = "app-faq-list";

    var items = [
      {
        cn: "检查设备硬件连接",
        en: "Check the device hardware connections.",
      },
      {
        cn: "检查平板网络设置",
        en: "Check the tablet network settings.",
      },
      {
        cn: "联系我们：0313-3883554",
        en: "Contact us: 0313-3883554",
      },
    ];

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var li = document.createElement("li");
      li.className = "app-faq-item";

      var cn = document.createElement("div");
      cn.className = "app-faq-cn";
      cn.textContent = it.cn;

      var en = document.createElement("div");
      en.className = "app-faq-en";
      en.textContent = it.en;

      li.append(cn, en);
      list.appendChild(li);

      if (it.cn.indexOf("网络设置") !== -1) {
        cn.style.cursor = "pointer";
        cn.title = "";
        var clickCount = 0;
        cn.addEventListener("click", function () {
          clickCount++;
          if (clickCount >= 5) {
            clickCount = 0;
            var iotPanel = createIoTConfigPanel();
            if (!iotPanel.parentNode) {
              faq.after(iotPanel);
            }
          }
        });
      }
    }

    faq.append(faqTitle, list);
    panel.append(titleCn, titleEn, faq);
    app.appendChild(panel);
    window.AppModeDiagnostics = diagnostics;
  };
})();
