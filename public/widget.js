/*! falconchato widget — <script async src="https://TU_DOMINIO/widget.js" data-site="CLAVE"></script> */
(function () {
  "use strict";
  if (window.FalconChato) return;

  var script =
    document.currentScript ||
    (function () {
      var list = document.querySelectorAll('script[src*="widget.js"][data-site]');
      return list[list.length - 1];
    })();
  if (!script) return;

  var site = script.getAttribute("data-site");
  var origin = new URL(script.src, location.href).origin;
  if (!site) return console.warn("[falconchato] falta data-site en el <script>");

  // La clave del visitante se guarda en el sitio anfitrión (almacenamiento de
  // primera parte), así no depende de cookies/almacenamiento de terceros.
  var KEY = "falconchato_v";
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
  }
  var visitor;
  try {
    visitor = localStorage.getItem(KEY);
    if (!visitor) localStorage.setItem(KEY, (visitor = uid()));
  } catch (e) {
    visitor = uid();
  }

  var iframe = document.createElement("iframe");
  iframe.title = "Chat en vivo";
  iframe.src = origin + "/widget/" + encodeURIComponent(site) + "?v=" + encodeURIComponent(visitor);
  iframe.setAttribute("allowtransparency", "true");
  iframe.setAttribute("allow", "clipboard-write");
  var s = iframe.style;
  s.position = "fixed";
  s.bottom = "0";
  s.right = "0";
  s.width = "0";
  s.height = "0";
  s.border = "0";
  s.margin = "0";
  s.padding = "0";
  s.background = "transparent";
  s.colorScheme = "normal";
  s.zIndex = "2147483000";
  s.maxWidth = "100%";
  s.maxHeight = "100%";

  function page() {
    return { url: location.href, title: document.title, referrer: document.referrer };
  }
  function post(type, data) {
    if (iframe.contentWindow) iframe.contentWindow.postMessage({ source: "falconchato-host", type: type, data: data }, origin);
  }

  // Título parpadeante ("Marlon: Hola que tal") cuando llega un mensaje con el chat minimizado.
  var blink = null;
  var baseTitle = document.title;
  function stopBlink() {
    if (!blink) return;
    clearInterval(blink);
    blink = null;
    document.title = baseTitle;
  }
  function notify(text) {
    if (!blink) baseTitle = document.title;
    else clearInterval(blink);
    var on = true;
    document.title = text;
    blink = setInterval(function () {
      on = !on;
      document.title = on ? text : baseTitle;
    }, 1200);
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && last.mode === "open") stopBlink();
  });

  var last = { mode: "closed", width: 0, height: 0, position: "right" };
  function layout() {
    var mobile = window.innerWidth < 520;
    var full = last.mode === "open" && mobile;
    s.left = last.position === "left" ? "0" : "auto";
    s.right = last.position === "left" ? "auto" : "0";
    s.width = full ? "100%" : last.width + "px";
    s.height = full ? "100%" : Math.min(last.height, window.innerHeight) + "px";
    post("layout", { full: full });
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || e.source !== iframe.contentWindow) return;
    var m = e.data || {};
    if (m.source !== "falconchato") return;
    if (m.type === "ready") post("page", page());
    if (m.type === "resize") {
      last = m.data;
      layout();
      if (last.mode === "open" && !document.hidden) stopBlink();
    }
    if (m.type === "notify" && m.data && m.data.text) notify(String(m.data.text).slice(0, 80));
  });
  window.addEventListener("resize", layout);

  // Sitios SPA: avisar cuando cambia la URL sin recargar.
  var lastUrl = location.href;
  function urlChanged() {
    setTimeout(function () {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      post("page", page());
    }, 60);
  }
  ["pushState", "replaceState"].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      urlChanged();
      return r;
    };
  });
  window.addEventListener("popstate", urlChanged);

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.FalconChato = {
    open: function () {
      post("open");
    },
    close: function () {
      post("close");
    },
  };
})();
