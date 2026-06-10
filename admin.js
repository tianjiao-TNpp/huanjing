/* 环境百词斩 · 管理后台逻辑 */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var SECRET_KEY = "hj_admin_secret";
  var secret = sessionStorage.getItem(SECRET_KEY) || "";

  function apiUrl() { return (window.HJ_CONFIG && window.HJ_CONFIG.apiUrl) || ""; }
  function api(sub, extra) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error("后台未配置：config.js 的 apiUrl 为空"));
    var body = { action: "admin", sub: sub, secret: secret };
    for (var k in (extra || {})) body[k] = extra[k];
    var full = url + (url.indexOf("?") >= 0 ? "&" : "?") +
      "action=admin&data=" + encodeURIComponent(JSON.stringify(body)) + "&t=" + Date.now();
    return fetch(full, { method: "GET", cache: "no-store" }).then(function (r) { return r.json(); });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function showPanel(show) {
    $("loginView").style.display = show ? "none" : "";
    $("panel").style.display = show ? "" : "none";
    $("logoutAdmin").style.display = show ? "" : "none";
  }

  function login() {
    secret = $("secret").value.trim();
    if (!secret) { $("loginErr").textContent = "请输入密码"; return; }
    $("loginBtn").disabled = true; $("loginBtn").textContent = "登录中…";
    api("list").then(function (res) {
      $("loginBtn").disabled = false; $("loginBtn").textContent = "进入";
      if (res && res.ok) {
        sessionStorage.setItem(SECRET_KEY, secret);
        showPanel(true);
        render(res);
      } else {
        $("loginErr").textContent = (res && res.error) || "登录失败";
      }
    }).catch(function (e) {
      $("loginBtn").disabled = false; $("loginBtn").textContent = "进入";
      $("loginErr").textContent = e.message || "网络错误";
    });
  }

  function action(sub, deviceId, name) {
    var labels = { revoke: "强制登出", activate: "恢复", delete: "彻底删除" };
    if (!confirm("确定要对「" + name + "」执行【" + labels[sub] + "】吗？")) return;
    api(sub, { deviceId: deviceId }).then(function (res) {
      if (res && res.ok) refresh();
      else alert((res && res.error) || "操作失败");
    }).catch(function (e) { alert(e.message); });
  }
  window.__hjAction = action;

  function render(res) {
    var list = res.devices || [];
    $("serverTime").textContent = res.serverTime ? "服务器时间 " + res.serverTime : "";
    var active = list.filter(function (d) { return d.status !== "revoked"; }).length;
    $("summary").textContent = "共 " + list.length + " 台设备 · 在用 " + active + " · 已登出 " + (list.length - active);

    var head = "<tr><th>名字</th><th>持码人</th><th>状态</th><th>词库</th>" +
      "<th>简易学/掌</th><th>进阶学/掌</th><th>待复习</th><th>学习次数</th>" +
      "<th>最后活跃</th><th>注册</th><th>操作</th></tr>";
    var rows = list.map(function (d) {
      return "<tr><td><b>" + esc(d.name) + "</b></td><td>" + esc(d.code) + "</td>" +
        '<td><span class="pill ' + (d.status === "revoked" ? "revoked" : "active") + '">' +
        (d.status === "revoked" ? "已登出" : "在用") + "</span></td>" +
        "<td>" + esc(d.book) + "</td>" +
        "<td>" + n(d.s_learned) + " / " + n(d.s_mastered) + "</td>" +
        "<td>" + n(d.a_learned) + " / " + n(d.a_mastered) + "</td>" +
        "<td>" + n(d.due) + "</td><td>" + n(d.actions) + "</td>" +
        "<td>" + esc(d.lastSeen) + "</td><td>" + esc(d.createdAt) + "</td>" +
        "<td>" + actionBtns(d) + "</td></tr>";
    }).join("");
    $("tableBox").innerHTML = list.length
      ? "<table>" + head + rows + "</table>"
      : '<p class="muted">还没有设备登录。</p>';

    // 移动端卡片
    $("cardsBox").innerHTML = list.map(function (d) {
      return '<div class="card"><h3>' + esc(d.name) +
        ' <span class="pill ' + (d.status === "revoked" ? "revoked" : "active") + '">' +
        (d.status === "revoked" ? "已登出" : "在用") + "</span></h3>" +
        '<div class="kv">持码人：' + esc(d.code) + "</div>" +
        '<div class="kv">简易 已学' + n(d.s_learned) + " 已掌握" + n(d.s_mastered) +
        " ｜ 进阶 已学" + n(d.a_learned) + " 已掌握" + n(d.a_mastered) + "</div>" +
        '<div class="kv">待复习 ' + n(d.due) + " ｜ 学习次数 " + n(d.actions) + "</div>" +
        '<div class="kv">最后活跃：' + esc(d.lastSeen) + "</div>" +
        '<div style="margin-top:8px">' + actionBtns(d) + "</div></div>";
    }).join("");
  }
  function n(v) { return (v === "" || v == null) ? 0 : v; }
  function actionBtns(d) {
    var nm = esc(d.name).replace(/'/g, "");
    var b = "";
    if (d.status === "revoked")
      b += '<button class="act restore" onclick="__hjAction(\'activate\',\'' + d.deviceId + "','" + nm + "')\">恢复</button>";
    else
      b += '<button class="act logout" onclick="__hjAction(\'revoke\',\'' + d.deviceId + "','" + nm + "')\">强制登出</button>";
    b += '<button class="act del" onclick="__hjAction(\'delete\',\'' + d.deviceId + "','" + nm + "')\">删除</button>";
    return b;
  }

  var curView = "devices";
  function refresh() {
    if (curView === "feedback") return refreshFb();
    refreshDevices();
  }
  function refreshDevices() {
    $("errBox").textContent = "加载中…";
    api("list").then(function (res) {
      if (res && res.ok) { $("errBox").textContent = ""; render(res); }
      else $("errBox").textContent = (res && res.error) || "加载失败";
    }).catch(function (e) { $("errBox").textContent = e.message; });
  }
  function refreshFb() {
    $("errBox").textContent = "加载中…";
    api("fb_list").then(function (res) {
      if (res && res.ok) { $("errBox").textContent = ""; renderFb(res.feedback || []); }
      else $("errBox").textContent = (res && res.error) || "加载失败";
    }).catch(function (e) { $("errBox").textContent = e.message; });
  }
  function renderFb(list) {
    var pending = list.filter(function (f) { return f.status !== "已处理"; }).length;
    $("fbCount").textContent = pending ? "(" + pending + ")" : "";
    $("summary").textContent = "共 " + list.length + " 条反馈 · 待处理 " + pending;
    $("fbBox").innerHTML = list.length ? list.map(function (f) {
      return '<div class="fb-item' + (f.status === "已处理" ? " done" : "") + '">' +
        '<div class="fb-meta"><span class="fb-tag">' + esc(f.type || "其他") + "</span>" +
        '<span class="w">' + esc(f.word || "(无单词)") + "</span>" +
        "<span>· " + esc(f.name) + " · " + esc(f.book) + " · " + esc(f.time) + "</span></div>" +
        '<div class="msg">' + esc(f.message) + "</div>" +
        '<div>' + (f.status === "已处理" ? '<span class="muted">已处理</span> ' :
          '<button class="act restore" onclick="__fbAct(\'fb_done\',' + f.row + ')">标记已处理</button>') +
        '<button class="act del" onclick="__fbAct(\'fb_delete\',' + f.row + ')">删除</button></div></div>';
    }).join("") : '<p class="muted">还没有学生反馈。</p>';
  }
  window.__fbAct = function (sub, row) {
    if (sub === "fb_delete" && !confirm("确定删除这条反馈？")) return;
    api(sub, { row: row }).then(function (res) {
      if (res && res.ok) refreshFb(); else alert((res && res.error) || "操作失败");
    }).catch(function (e) { alert(e.message); });
  };
  function switchView(v) {
    curView = v;
    [].forEach.call(document.querySelectorAll("#viewSeg .seg-btn"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-v") === v);
    });
    var dev = v === "devices";
    $("tableBox").style.display = dev ? "" : "none";
    $("cardsBox").style.display = dev ? "" : "none";
    $("fbBox").style.display = dev ? "none" : "";
    $("serverTime").style.display = dev ? "" : "none";
    refresh();
  }
  document.getElementById("viewSeg").onclick = function (e) {
    var b = e.target.closest(".seg-btn"); if (b) switchView(b.getAttribute("data-v"));
  };

  $("loginBtn").onclick = login;
  $("secret").onkeydown = function (e) { if (e.key === "Enter") login(); };
  $("refresh").onclick = refresh;
  $("logoutAdmin").onclick = function () {
    sessionStorage.removeItem(SECRET_KEY); secret = ""; showPanel(false); $("secret").value = "";
  };

  // 已有会话密码则自动进入
  if (secret) { api("list").then(function (res) { if (res && res.ok) { showPanel(true); render(res); } }).catch(function () { }); }
})();
