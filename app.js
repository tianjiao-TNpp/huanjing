/* 环境百词斩 — 备考闪卡 PWA  (vanilla JS, 无依赖) */
(function () {
  "use strict";

  var DAY = 86400000;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 日语朗读 (浏览器内置语音合成, 免费) ----------
  var TTS = {
    voice: null,
    supported: function () { return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window; },
    init: function () {
      if (!TTS.supported()) return;
      var pick = function () {
        var vs = window.speechSynthesis.getVoices() || [];
        var ja = vs.filter(function (v) { return /ja([-_]|$)/i.test(v.lang) || /japan/i.test(v.name); });
        if (ja.length) TTS.voice = ja[0];
      };
      pick();
      try { window.speechSynthesis.onvoiceschanged = pick; } catch (e) { }
    },
    speak: function (text) {
      if (!text || !TTS.supported()) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(String(text));
        u.lang = "ja-JP";
        if (TTS.voice) u.voice = TTS.voice;
        u.rate = 0.92; u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch (e) { }
    }
  };
  function sayOf(w) { return w ? (w.reading || w.word) : ""; }       // 优先念假名读音, 发音更准
  function autoOn() { return localStorage.getItem("hj_autoplay") === "1"; }
  function setAuto(v) { localStorage.setItem("hj_autoplay", v ? "1" : "0"); }
  function speakBtnHtml(w) {
    if (!TTS.supported()) return "";
    return '<button class="speak-btn" data-speak="' + esc(sayOf(w)) + '" title="朗读发音">🔊</button>';
  }
  function handleSpeakClick(e) {
    var b = e.target.closest && e.target.closest(".speak-btn");
    if (b) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); TTS.speak(b.getAttribute("data-speak")); return true; }
    return false;
  }

  // ---------- 全局状态 ----------
  var state = {
    book: localStorage.getItem("hj_book") || "simple",
    meta: null,
    books: {},          // 已加载的词库数据
    directions: null,
    filter: { type: null, value: null },  // {type:'category'|'direction', value:名称}
    seg: "category",
    view: "home",
  };

  // ---------- 进度存储 (SM-2) ----------
  var STORE_KEY = "hj_progress_v1";
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
  var store = loadStore();

  function bookStore() {
    if (!store[state.book]) store[state.book] = {};
    return store[state.book];
  }
  function cardState(word) { return bookStore()[word] || null; }

  function srsUpdate(word, quality) {
    var bs = bookStore();
    var s = bs[word] || { reps: 0, interval: 0, ef: 2.5, due: 0, last: 0 };
    if (quality < 3) {
      s.reps = 0; s.interval = 1;
    } else {
      s.reps += 1;
      if (s.reps === 1) s.interval = 1;
      else if (s.reps === 2) s.interval = 3;
      else s.interval = Math.round(s.interval * s.ef);
      s.ef = Math.max(1.3, s.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    }
    s.due = Date.now() + s.interval * DAY;
    s.last = Date.now();
    bs[word] = s;
    saveStore(store);
    bumpActions();
    return s;
  }

  // ---------- 数据加载 (动态 <script>, 兼容 file://) ----------
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = src;
      sc.onload = res;
      sc.onerror = function () { rej(new Error("加载失败: " + src)); };
      document.head.appendChild(sc);
    });
  }
  function ensureBook(book) {
    if (state.books[book]) return Promise.resolve(state.books[book]);
    return loadScript("data/" + book + ".js").then(function () {
      state.books[book] = window.__HJ__[book];
      return state.books[book];
    });
  }

  // ---------- 筛选后的词表 ----------
  function currentList() {
    var all = state.books[state.book] || [];
    var f = state.filter;
    if (!f.type) return all;
    if (f.type === "category") {
      return all.filter(function (w) { return w.category === f.value; });
    }
    if (f.type === "direction") {
      var dir = (state.directions || []).find(function (d) { return d.name === f.value; });
      if (!dir) return all;
      var set = {};
      dir.words.forEach(function (w) { set[w] = 1; });
      return all.filter(function (w) { return set[w.word]; });
    }
    return all;
  }

  // ---------- 工具 ----------
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return (s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n) + "…" : s; }
  // 日语新字体 -> 中文简体 的字形归一化(释义多为中文, 术语为日语, 字形常不同)
  var JP2CN = (function () {
    var s = "汚污 気气 廃废 価价 効效 圧压 関关 産产 済济 経经 観观 総总 実实 様样 増增 処处 規规 録录 響响 県县 帰归 鉄铁 戦战 単单 売卖 読读 続续 図图 黒黑 雑杂 視视 児儿 釈释 収收 従从 渋涩 縦纵 諸诸 緒绪 触触 壌壤 譲让 醸酿 静静 斉齐 摂摄 節节 説说 専专 銭钱 潜潜 繊纤 装装 騒骚 蔵藏 贈赠 属属 帯带 滞滞 沢泽 担担 胆胆 嘆叹 団团 弾弹 断断 遅迟 鋳铸 庁厅 聴听 鎮镇 転转 伝传 党党 盗盗 闘斗 徳德 脳脑 麦麦 発发 髪发 抜拔 晩晚 浜滨 賓宾 頻频 譜谱 仏佛 紛纷 噴喷 並并 閉闭 変变 報报 豊丰 縫缝 訳译 薬药 予预 謡谣 頼赖 覧览 慮虑 両两 猟猎 緑绿 隣邻 涙泪 類类 励励 鈴铃 暦历 歴历 練练 錬炼 労劳 営营 衛卫 栄荣 塩盐 応应 仮假 拡扩 覚觉 楽乐 顔颜 偽伪 挙举 郷乡 駆驱 恵惠 継继 軽轻 撃击 険险 圏圈 検检 権权 顕显 験验 厳严 広广 鉱矿 穀谷 砕碎 剤剂 殺杀 賛赞 歯齿 獣兽 縄绳 勢势 漸渐 礎础 択择 達达 奪夺 脱脱 隠隐 円圆 壊坏 戯戏 環环 態态 電电 減减 濃浓 縮缩 棄弃 採采 際际 結结 連连 鋼钢 鉛铅 銅铜 銀银 還还 給给 統统 紹绍 細细 終终 組组 絡络 網网 線线 編编 緩缓 績绩 縁缘 質质 飛飞 馬马 鳥鸟 魚鱼 竜龙 滅灭 師师 異异 橋桥 顧顾 護护 議议 鋭锐 錯错 鎖锁 評评 準准 監监 負负 風风 機机 種种 開开 計计 約约 書书 倫伦 業业 資资 間间 場场 園园 層层 導导 張张 強强 後后 復复 愛爱 慣惯 戸户 島岛 孫孙 審审 寧宁 庫库 問问 門门 聞闻 養养 館馆 頭头 題题 願愿 飲饮 織织 紀纪 級级 納纳 紅红 純纯 緊紧 締缔 帳帐 帥帅 巻卷";
    var m = {};
    s.split(/\s+/).forEach(function (p) { if (p.length >= 2) m[p.charAt(0)] = p.charAt(1); });
    return m;
  })();
  function normJ(s) { return s.replace(/[　-￿]/g, function (c) { return JP2CN[c] || c; }); }

  // 把释义里出现的"术语"本身挖空成下划线, 防止靠文字相同直接选出答案
  var BLANK_HTML = '<span class="blank">＿＿＿</span>';
  function maskTerm(text, term) {
    text = text || "";
    if (!term || term.length < 2) return esc(text);
    var nt = normJ(term), ntext = normJ(text), L = nt.length;
    // 1) 归一化后精确出现 -> 全部挖空
    if (ntext.indexOf(nt) >= 0) {
      var out = "", i = 0, j;
      while ((j = ntext.indexOf(nt, i)) >= 0) { out += esc(text.slice(i, j)) + BLANK_HTML; i = j + L; }
      return out + esc(text.slice(i));
    }
    // 2) 模糊兜底: 找最相似的一处窗口(归一化后≥60%字相同), 只挖这一处
    var best = -1, bi = -1;
    for (var p = 0; p + L <= ntext.length; p++) {
      var mt = 0;
      for (var k = 0; k < L; k++) if (ntext.charAt(p + k) === nt.charAt(k)) mt++;
      if (mt > best) { best = mt; bi = p; }
    }
    if (bi >= 0 && best >= Math.max(2, Math.ceil(L * 0.6))) {
      return esc(text.slice(0, bi)) + BLANK_HTML + esc(text.slice(bi + L));
    }
    // 3) 首字锚定: 释义开头常直接复述术语, 首字相同且过半相同则挖掉开头 L 个字
    var lead = 0;
    for (var q = 0; q < L && q < ntext.length; q++) if (ntext.charAt(q) === nt.charAt(q)) lead++;
    if (ntext.charAt(0) === nt.charAt(0) && lead >= Math.ceil(L * 0.5) && text.length >= L) {
      return BLANK_HTML + esc(text.slice(L));
    }
    return esc(text);
  }

  // ---------- 视图切换 ----------
  function show(view) {
    state.view = view;
    ["home", "flash", "quiz", "browse"].forEach(function (v) {
      $("view-" + v).classList.toggle("hidden", v !== view);
    });
    $("backBtn").classList.toggle("hidden", view === "home");
    var titles = { home: "环境百词斩", flash: "闪卡翻面", quiz: "选择题测验", browse: "浏览词表" };
    $("title").textContent = titles[view] || "环境百词斩";
    window.scrollTo(0, 0);
  }

  // ---------- 主页 ----------
  function dueInfo() {
    var list = currentList(), now = Date.now();
    var learned = 0, due = 0, mastered = 0, fresh = 0;
    list.forEach(function (w) {
      var s = cardState(w.word);
      if (s) {
        learned++;
        if (s.due <= now) due++;
        if (s.reps >= 3) mastered++;
      } else fresh++;
    });
    return { total: list.length, learned: learned, due: due, mastered: mastered, fresh: fresh };
  }

  function renderHome() {
    var d = dueInfo();
    $("statStrip").innerHTML =
      stat(d.total, "总词数") + stat(d.learned, "已学") +
      stat(d.mastered, "已掌握") + stat(d.due, "待复习");
    $("reviewSub").textContent = d.due > 0
      ? (d.due + " 个到期 · " + d.fresh + " 个新词")
      : (d.fresh > 0 ? d.fresh + " 个新词待学" : "全部已复习 🎉");
    renderFilter();
    updateBookBtn();
    renderSettings();
    renderDeviceFoot();
  }
  function renderSettings() {
    var el = $("settingsRow");
    if (!el) return;
    if (!TTS.supported()) { el.innerHTML = '<div class="set-item" style="opacity:.6">此设备不支持语音朗读</div>'; return; }
    el.innerHTML = '<div class="set-item"><span>🔊 卡片出现时自动朗读</span>' +
      '<button id="autoBtn" class="toggle' + (autoOn() ? " on" : "") + '" title="自动朗读开关"><span class="knob"></span></button></div>';
    $("autoBtn").onclick = function () {
      var nv = !autoOn();
      setAuto(nv);
      renderSettings();
      if (nv) TTS.speak("こんにちは");  // 开启时念一句确认能出声
    };
  }
  function renderDeviceFoot() {
    var el = $("deviceFoot");
    if (!el) return;
    var dev = getDevice();
    if (!dev) { el.innerHTML = ""; return; }
    el.innerHTML = '当前设备：<b>' + esc(dev.name) + '</b> · <a href="#" id="logoutLink">退出登录</a>';
    var lk = $("logoutLink");
    if (lk) lk.onclick = function (e) {
      e.preventDefault();
      if (confirm("退出后下次需要重新输入激活码和设备名字，确定退出？")) forceLogout("已退出登录");
    };
  }
  function stat(n, label) {
    return '<div class="stat"><b>' + n + "</b><span>" + label + "</span></div>";
  }
  function updateBookBtn() {
    $("bookBtn").textContent = state.book === "simple" ? "简易" : "进阶";
  }

  function renderFilter() {
    var seg = state.seg;
    $$(".seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.seg === seg);
    });
    var chips = [];
    if (seg === "category") {
      var cats = state.meta.books[state.book].categories;
      cats.forEach(function (c) {
        if (!c.name || c.name === "无可用选项") return;
        chips.push(chip("category", c.name, c.count));
      });
    } else {
      (state.directions || []).forEach(function (dr) {
        chips.push(chip("direction", dr.name, dr.words.length));
      });
    }
    $("chipList").innerHTML = chips.join("");
    var f = state.filter;
    $("filterSummary").textContent = f.type
      ? "已选：" + f.value + "（" + currentList().length + " 词）"
      : "当前学习全部 " + (state.books[state.book] || []).length + " 词";
  }
  function chip(type, name, count) {
    var active = state.filter.type === type && state.filter.value === name;
    return '<button class="chip' + (active ? " active" : "") + '" data-type="' + type +
      '" data-value="' + esc(name) + '">' + esc(name) + "<small>" + count + "</small></button>";
  }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // ---------- 闪卡 / 复习 ----------
  var fc = null;
  function startFlash(reviewMode) {
    var list = currentList();
    if (reviewMode) {
      var now = Date.now();
      var due = list.filter(function (w) { var s = cardState(w.word); return s && s.due <= now; });
      var fresh = list.filter(function (w) { return !cardState(w.word); }).slice(0, 30);
      list = shuffle(due).concat(shuffle(fresh));
    } else {
      list = shuffle(list);
    }
    if (!list.length) { alert(reviewMode ? "暂时没有到期或新词可复习 🎉" : "该范围内没有单词"); return; }
    fc = { list: list, i: 0, flipped: false, known: 0, unknown: 0, review: reviewMode };
    show("flash");
    $("title").textContent = reviewMode ? "间隔复习" : "闪卡翻面";
    renderFlash();
  }
  function renderFlash() {
    var w = fc.list[fc.i];
    fc.flipped = false;
    $("flashCard").classList.remove("flipped");
    $("fcWord").textContent = w.word;
    $("fcReading").textContent = w.reading || "";
    var sp = $("fcSpeak");
    if (sp) {
      sp.style.display = TTS.supported() ? "" : "none";
      sp.setAttribute("data-speak", sayOf(w));
    }
    $("fcBack").innerHTML = backFace(w);
    $("flashCounter").textContent = (fc.i + 1) + " / " + fc.list.length;
    $("flashProgFill").style.width = (fc.i / fc.list.length * 100) + "%";
    if (autoOn()) TTS.speak(sayOf(w));
  }
  // 当前词库的单词索引(惰性构建), 用于判断相关词是否可跳转
  function wordIndex() {
    if (!state._index) state._index = {};
    var bk = state.book;
    if (!state._index[bk]) {
      var m = {};
      (state.books[bk] || []).forEach(function (w) { if (!(w.word in m)) m[w.word] = w; });
      state._index[bk] = m;
    }
    return state._index[bk];
  }
  function findWord(word) { return wordIndex()[word] || null; }
  function tagHtml(t) {
    if (findWord(t))
      return '<span class="mini-tag tag-link" data-link="' + esc(t) + '">' + esc(t) + " ›</span>";
    return '<span class="mini-tag">' + esc(t) + "</span>";
  }
  function handleLinkClick(e) {
    var b = e.target.closest && e.target.closest(".tag-link");
    if (b) { e.stopPropagation(); openDetail(b.getAttribute("data-link")); return true; }
    return false;
  }

  function backFace(w) {
    var h = '<div class="bk-word">' + esc(w.word) + speakBtnHtml(w) + "</div>";
    if (w.reading) h += '<div class="bk-reading">' + esc(w.reading) + "</div>";
    if (w.category) h += '<span class="bk-cat">' + esc(w.category) + "</span>";
    h += '<div class="bk-section bk-def"><span class="bk-label">释义</span>' + esc(w.definition) + "</div>";
    if (w.related && w.related.length)
      h += '<div class="bk-section"><span class="bk-label">相关词</span><div class="tag-row">' +
        w.related.map(tagHtml).join("") + "</div></div>";
    if (w.confusing && w.confusing.length)
      h += '<div class="bk-section"><span class="bk-label">易混词/近义词</span><div class="tag-row">' +
        w.confusing.map(tagHtml).join("") + "</div></div>";
    if (w.notes)
      h += '<div class="bk-section"><span class="bk-label">学习备注</span>' + esc(w.notes) + "</div>";
    h += '<button class="fb-report" data-fb="' + esc(w.word) + '">🚩 报错 / 提建议</button>';
    return h;
  }
  function flashAnswer(known) {
    var w = fc.list[fc.i];
    srsUpdate(w.word, known ? 4 : 2);
    if (known) fc.known++; else fc.unknown++;
    fc.i++;
    if (fc.i >= fc.list.length) {
      finishFlash();
    } else {
      renderFlash();
    }
  }
  function finishFlash() {
    $("flashProgFill").style.width = "100%";
    showResult({
      title: fc.review ? "复习完成" : "本组完成",
      main: fc.known + " / " + fc.list.length,
      sub: "认识",
      stats: [["认识", fc.known], ["不认识", fc.unknown]],
    });
  }

  // ---------- 选择题 ----------
  var qz = null;
  function startQuiz() {
    var list = currentList();
    if (list.length < 4) { alert("该范围单词太少（需≥4）无法出选择题"); return; }
    var n = Math.min(10, list.length);
    var pick = shuffle(list).slice(0, n);
    qz = { list: pick, pool: list, i: 0, correct: 0, answered: false };
    show("quiz");
    renderQuiz();
  }
  function renderQuiz() {
    qz.answered = false;
    var w = qz.list[qz.i];
    var reverse = Math.random() < 0.5;  // true: 给释义选单词
    qz.reverse = reverse;
    qz.cur = w;
    $("quizCounter").textContent = (qz.i + 1) + " / " + qz.list.length + " · 正确 " + qz.correct;
    $("quizProgFill").style.width = (qz.i / qz.list.length * 100) + "%";
    $("quizNext").classList.add("hidden");

    var distract = shuffle(qz.pool.filter(function (x) { return x.word !== w.word; })).slice(0, 3);
    var opts = shuffle([w].concat(distract));

    if (reverse) {
      // 答案是单词, 答题前不显示, 故🔊放到答完后揭晓
      $("quizPrompt").innerHTML = '<div class="quiz-q">根据释义选出对应单词</div>' +
        '<div class="quiz-prompt-main small">' + maskTerm(truncate(w.definition, 90), w.word) +
        '</div><div id="quizSpeakHolder"></div>';
      $("quizOptions").innerHTML = opts.map(function (o) {
        return '<button class="opt" data-w="' + esc(o.word) + '">' + esc(o.word) +
          (o.reading ? ' <span style="color:var(--sub);font-size:13px">' + esc(o.reading) + "</span>" : "") + "</button>";
      }).join("");
    } else {
      $("quizPrompt").innerHTML = '<div class="quiz-q">选出单词的正确释义</div>' +
        '<div class="quiz-prompt-main">' + esc(w.word) + speakBtnHtml(w) + "</div>";
      $("quizOptions").innerHTML = opts.map(function (o) {
        return '<button class="opt" data-w="' + esc(o.word) + '">' + maskTerm(truncate(o.definition, 70), o.word) + "</button>";
      }).join("");
    }
  }
  function quizAnswer(btn) {
    if (qz.answered) return;
    qz.answered = true;
    var chosen = btn.dataset.w;
    var correct = qz.cur.word;
    var ok = chosen === correct;
    if (ok) qz.correct++;
    srsUpdate(qz.cur.word, ok ? 4 : 2);
    $$(".opt").forEach(function (b) {
      b.classList.add("disabled");
      if (b.dataset.w === correct) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });
    $("quizNext").classList.remove("hidden");
    $("quizCounter").textContent = (qz.i + 1) + " / " + qz.list.length + " · 正确 " + qz.correct;
    // 揭晓发音：反向题此时补上🔊；并按设置自动朗读正确单词
    var holder = $("quizSpeakHolder");
    if (holder) holder.innerHTML = speakBtnHtml(qz.cur);
    if (autoOn()) TTS.speak(sayOf(qz.cur));
    // 揭晓后允许对正确单词报错
    if (!$("quizPrompt").querySelector(".fb-report")) {
      var rb = document.createElement("button");
      rb.className = "fb-report";
      rb.setAttribute("data-fb", qz.cur.word);
      rb.textContent = "🚩 这题有误？报错";
      $("quizPrompt").appendChild(rb);
    }
  }
  function quizNext() {
    qz.i++;
    if (qz.i >= qz.list.length) {
      $("quizProgFill").style.width = "100%";
      var pct = Math.round(qz.correct / qz.list.length * 100);
      showResult({
        title: "测验完成",
        main: pct + "%",
        sub: "正确率",
        stats: [["正确", qz.correct], ["错误", qz.list.length - qz.correct]],
      });
    } else {
      renderQuiz();
    }
  }

  // ---------- 浏览 ----------
  function startBrowse() {
    show("browse");
    $("searchInput").value = "";
    renderBrowse("");
  }
  function renderBrowse(q) {
    var list = currentList();
    q = (q || "").trim().toLowerCase();
    if (q) {
      list = list.filter(function (w) {
        return (w.word && w.word.toLowerCase().indexOf(q) >= 0) ||
          (w.reading && w.reading.toLowerCase().indexOf(q) >= 0) ||
          (w.definition && w.definition.toLowerCase().indexOf(q) >= 0);
      });
    }
    $("browseCount").textContent = "共 " + list.length + " 词";
    var now = Date.now();
    var html = list.slice(0, 400).map(function (w) {
      var s = cardState(w.word);
      var badge = "";
      if (s && s.due <= now) badge = '<span class="rstate due">待复习</span>';
      else if (s && s.reps >= 3) badge = '<span class="rstate known">已掌握</span>';
      else if (s) badge = '<span class="rstate known">已学</span>';
      return '<div class="row" data-w="' + esc(w.word) + '"><div><div class="rw">' + esc(w.word) +
        '</div><div class="rr">' + esc(w.reading || "") + " · " + esc(w.category || "") +
        "</div></div>" + badge + "</div>";
    }).join("");
    if (list.length > 400) html += '<div class="empty">仅显示前 400 条，请用搜索缩小范围</div>';
    $("browseList").innerHTML = html || '<div class="empty">没有匹配的单词</div>';
  }
  function openDetail(word) {
    var w = (state.books[state.book] || []).find(function (x) { return x.word === word; });
    if (!w) return;
    $("sheetBody").innerHTML = '<button class="detail-close" id="detailClose">×</button>' + backFace(w);
    $("detailSheet").classList.remove("hidden");
    $("detailClose").onclick = closeDetail;
  }
  function closeDetail() { $("detailSheet").classList.add("hidden"); }

  // ---------- 报错 / 反馈 ----------
  var fbWord = null;
  function openFeedback(word) {
    fbWord = word;
    $("fbWord").textContent = word;
    $("fbMsg").value = "";
    $("fbErr").textContent = "";
    $$("#fbType .seg-btn").forEach(function (b, i) { b.classList.toggle("active", i === 0); });
    $("feedbackSheet").classList.remove("hidden");
    setTimeout(function () { $("fbMsg").focus(); }, 100);
  }
  function closeFeedback() { $("feedbackSheet").classList.add("hidden"); }
  function handleFbClick(e) {
    var b = e.target.closest && e.target.closest(".fb-report");
    if (b) { e.stopPropagation(); openFeedback(b.getAttribute("data-fb")); return true; }
    return false;
  }
  function submitFeedback() {
    var act = document.querySelector("#fbType .seg-btn.active");
    var type = act ? act.getAttribute("data-t") : "其他";
    var msg = ($("fbMsg").value || "").trim();
    if (!msg) { $("fbErr").textContent = "请填写详细说明"; return; }
    var dev = getDevice() || {};
    var btn = $("fbSubmit"); btn.disabled = true; btn.textContent = "提交中…";
    apiCall("feedback", {
      deviceId: dev.deviceId, name: dev.name, book: state.book,
      word: fbWord, type: type, message: msg, ua: navigator.userAgent
    }, 12000).then(function (res) {
      btn.disabled = false; btn.textContent = "提交";
      if (res && res.ok) { closeFeedback(); alert("已提交，谢谢你的反馈！🌿"); }
      else { $("fbErr").textContent = (res && res.error) || "提交失败，请重试"; }
    }).catch(function () {
      btn.disabled = false; btn.textContent = "提交";
      $("fbErr").textContent = "提交失败：无法连接服务器（可能网络受限）。可截图发给老师。";
    });
  }

  // ---------- 结算弹层 ----------
  function showResult(r) {
    syncNow(true); // 一组学完, 上报进度
    var stats = r.stats.map(function (s) {
      return '<div class="stat"><b>' + s[1] + "</b><span>" + s[0] + "</span></div>";
    }).join("");
    $("resultBody").innerHTML =
      "<h2>" + esc(r.title) + "</h2>" +
      '<div class="result-ring">' + esc(r.main) + "</div>" +
      '<div style="color:var(--sub);font-size:13px">' + esc(r.sub) + "</div>" +
      '<div class="result-stats">' + stats + "</div>" +
      '<button class="big-btn good wide" id="resultHome">返回主页</button>';
    $("resultSheet").classList.remove("hidden");
    $("resultHome").onclick = function () {
      $("resultSheet").classList.add("hidden");
      show("home");
      renderHome();
    };
  }

  // ---------- 词库切换 ----------
  function switchBook() {
    var next = state.book === "simple" ? "advanced" : "simple";
    var btn = $("bookBtn");
    btn.textContent = "…";
    ensureBook(next).then(function () {
      state.book = next;
      localStorage.setItem("hj_book", next);
      // 切换词库后, 若当前筛选是类别且新库无此类别则清除
      if (state.filter.type === "category") {
        var has = state.meta.books[next].categories.some(function (c) { return c.name === state.filter.value; });
        if (!has) state.filter = { type: null, value: null };
      }
      renderHome();
    }).catch(function (e) { alert(e.message); updateBookBtn(); });
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    $("backBtn").onclick = function () { show("home"); renderHome(); };
    $("bookBtn").onclick = switchBook;

    // 模式卡片
    $$(".mode-card").forEach(function (c) {
      c.onclick = function () {
        var m = c.dataset.mode;
        if (m === "flash") startFlash(false);
        else if (m === "quiz") startQuiz();
        else if (m === "review") startFlash(true);
        else if (m === "browse") startBrowse();
      };
    });

    // 筛选 segment
    $("filterSeg").onclick = function (e) {
      var b = e.target.closest(".seg-btn");
      if (!b) return;
      state.seg = b.dataset.seg;
      renderFilter();
    };
    $("clearFilter").onclick = function () {
      state.filter = { type: null, value: null };
      renderHome();
    };
    // chip 点击 (委托)
    $("chipList").onclick = function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      var type = b.dataset.type, value = b.dataset.value;
      if (state.filter.type === type && state.filter.value === value) {
        state.filter = { type: null, value: null };
      } else {
        state.filter = { type: type, value: value };
      }
      renderHome();
    };

    // 闪卡
    $("flashCard").onclick = function (e) {
      if (handleSpeakClick(e)) return;   // 点🔊只发音, 不翻面
      if (handleFbClick(e)) return;      // 点报错不翻面
      if (handleLinkClick(e)) return;    // 点相关词跳转, 不翻面
      fc.flipped = !fc.flipped;
      $("flashCard").classList.toggle("flipped", fc.flipped);
    };
    $("fcKnown").onclick = function () { flashAnswer(true); };
    $("fcUnknown").onclick = function () { flashAnswer(false); };

    // 测验
    $("quizOptions").onclick = function (e) {
      var b = e.target.closest(".opt");
      if (b) quizAnswer(b);
    };
    $("quizNext").onclick = quizNext;
    $("quizPrompt").onclick = function (e) { if (!handleSpeakClick(e)) handleFbClick(e); };  // 题目区🔊/报错

    // 浏览
    $("searchInput").oninput = function () { renderBrowse(this.value); };
    $("browseList").onclick = function (e) {
      var r = e.target.closest(".row");
      if (r) openDetail(r.dataset.w);
    };
    document.querySelector("#detailSheet .sheet-bg").onclick = closeDetail;
    $("sheetBody").onclick = function (e) {  // 详情里🔊/报错/相关词跳转
      if (handleSpeakClick(e)) return;
      if (handleLinkClick(e)) return;
      handleFbClick(e);
    };

    // 报错/反馈
    $("fbClose").onclick = closeFeedback;
    document.querySelector("#feedbackSheet .sheet-bg").onclick = closeFeedback;
    $("fbType").onclick = function (e) {
      var b = e.target.closest(".seg-btn"); if (!b) return;
      $$("#fbType .seg-btn").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
    };
    $("fbSubmit").onclick = submitFeedback;

    // 键盘 (电脑端)
    document.addEventListener("keydown", function (e) {
      if (state.view === "flash") {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); $("flashCard").click(); }
        else if (e.key === "ArrowRight" || e.key.toLowerCase() === "k") flashAnswer(true);
        else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") flashAnswer(false);
      } else if (state.view === "quiz") {
        if (qz && qz.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); quizNext(); }
        else if (!qz.answered && /^[1-4]$/.test(e.key)) {
          var opts = $$(".opt"); if (opts[+e.key - 1]) quizAnswer(opts[+e.key - 1]);
        }
      }
    });
  }

  // ---------- 后端接口 (Google Apps Script, 用 GET 避开 CORS) ----------
  function apiUrl() { return (window.HJ_CONFIG && window.HJ_CONFIG.apiUrl) || ""; }
  function apiCall(action, payload, timeoutMs) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error("backend-not-configured"));
    var body = { action: action };
    for (var k in (payload || {})) body[k] = payload[k];
    var full = url + (url.indexOf("?") >= 0 ? "&" : "?") +
      "action=" + encodeURIComponent(action) +
      "&data=" + encodeURIComponent(JSON.stringify(body)) +
      "&t=" + Date.now();
    var opts = { method: "GET", cache: "no-store" };
    var timer = null;
    if (window.AbortController) {
      var ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000);
    }
    return fetch(full, opts).then(
      function (r) { if (timer) clearTimeout(timer); return r.json(); },
      function (e) { if (timer) clearTimeout(timer); throw e; }
    );
  }

  // 墙内离线校验：用加盐 SHA-256 比对本地哈希(codes.js)
  function sha256Hex(str) {
    var enc = new TextEncoder().encode(str);
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest("SHA-256", enc).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }).join("");
      });
    }
    return Promise.reject(new Error("nocrypto"));
  }
  function validateLocal(code) {
    var c = window.HJ_CODES || { salt: "", hashes: [] };
    return sha256Hex(c.salt + ":" + code).then(function (h) { return c.hashes.indexOf(h) >= 0; });
  }

  // ---------- 设备登录态 ----------
  var DEVICE_KEY = "hj_device_v1";
  var ACTIONS_KEY = "hj_actions";
  function getDevice() {
    try { return JSON.parse(localStorage.getItem(DEVICE_KEY)); } catch (e) { return null; }
  }
  function setDevice(d) { localStorage.setItem(DEVICE_KEY, JSON.stringify(d)); }
  function bumpActions() {
    var n = (parseInt(localStorage.getItem(ACTIONS_KEY), 10) || 0) + 1;
    localStorage.setItem(ACTIONS_KEY, String(n));
  }
  function computeStats() {
    var now = Date.now();
    function bk(name) {
      var o = store[name] || {}, learned = 0, mastered = 0, due = 0;
      for (var w in o) { learned++; if (o[w].reps >= 3) mastered++; if (o[w].due <= now) due++; }
      return { learned: learned, mastered: mastered, due: due };
    }
    var s = bk("simple"), a = bk("advanced");
    return {
      s_learned: s.learned, s_mastered: s.mastered,
      a_learned: a.learned, a_mastered: a.mastered,
      due: s.due + a.due,
      actions: parseInt(localStorage.getItem(ACTIONS_KEY), 10) || 0
    };
  }
  var lastSync = 0;
  function syncNow(force) {
    var dev = getDevice();
    if (!dev || dev.local || !apiUrl()) return; // 本地(墙内)设备不联网同步
    if (!force && Date.now() - lastSync < 20000) return; // 限频 20s
    lastSync = Date.now();
    apiCall("sync", { deviceId: dev.deviceId, book: state.book, stats: computeStats(), ua: navigator.userAgent })
      .then(function (res) {
        if (res && res.status === "revoked") forceLogout("管理员已将此设备登出。");
        else if (res && res.status === "unknown") forceLogout("此设备已从后台移除，请重新登录。");
      })
      .catch(function () { /* 离线: 宽限, 忽略 */ });
  }
  function forceLogout(msg) {
    localStorage.removeItem(DEVICE_KEY);
    alert(msg || "已登出");
    location.reload();
  }

  // ---------- 登录门禁 (激活码 + 设备名字) ----------
  function showGate() {
    var gate = $("gate"), codeI = $("gateInput"), nameI = $("gateName"),
      err = $("gateErr"), btn = $("gateBtn");
    gate.classList.remove("hidden");
    setTimeout(function () { codeI.focus(); }, 100);
    function attempt() {
      var code = (codeI.value || "").trim().toUpperCase().replace(/\s/g, "");
      var name = (nameI.value || "").trim();
      if (!code) { err.textContent = "请输入激活码"; return; }
      if (!name) { err.textContent = "请给这台设备起个名字"; return; }
      err.textContent = "";
      btn.disabled = true; btn.textContent = "登录中…";

      function fail(msg) { btn.disabled = false; btn.textContent = "登录"; err.textContent = msg; codeI.select(); }
      function enter(dev) { setDevice(dev); btn.disabled = false; btn.textContent = "登录"; gate.classList.add("hidden"); startApp(); }
      // 墙内兜底：后端连不上时，用本地哈希校验放行（不联网、不可远程管理）
      function fallbackLocal() {
        validateLocal(code).then(function (okLocal) {
          if (okLocal) enter({ deviceId: "local-" + Date.now() + "-" + Math.floor(Math.random() * 1e6), name: name, local: true });
          else fail("激活码无效，请检查后重试");
        }).catch(function () { fail("此浏览器太旧，无法验证，请更新浏览器后重试"); });
      }

      // 先试在线后端（能连上谷歌→全功能管理）；连不上/超时→走本地兜底
      apiCall("register", { code: code, name: name, ua: navigator.userAgent }, 8000).then(function (res) {
        if (res && res.ok) enter({ deviceId: res.deviceId, name: res.name });
        else fail((res && res.error) || "登录失败，请重试"); // 后端可达且明确拒绝(如码无效)
      }).catch(function () {
        fallbackLocal(); // 后端不可达(被墙/超时/未配置)
      });
    }
    btn.onclick = attempt;
    nameI.onkeydown = function (e) { if (e.key === "Enter") attempt(); };
    codeI.onkeydown = function (e) { if (e.key === "Enter") nameI.focus(); };
  }

  // ---------- 启动 ----------
  function boot() {
    TTS.init();
    if (getDevice()) {
      startApp();
      syncNow(true); // 后台校验是否被登出
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) syncNow(false);
      });
    } else {
      showGate();
    }
  }
  function startApp() {
    Promise.all([loadScript("data/meta.js"), loadScript("data/directions.js")])
      .then(function () {
        state.meta = window.__HJ__.meta;
        state.directions = window.__HJ__.directions;
        return ensureBook(state.book);
      })
      .then(function () {
        bindEvents();
        show("home");
        renderHome();
      })
      .catch(function (e) {
        document.body.innerHTML = '<div class="loading">数据加载失败：' + esc(e.message) +
          "<br>请通过本地服务器或部署后访问（见 README）。</div>";
      });

    // service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    }
  }

  boot();
})();
