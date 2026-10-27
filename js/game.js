/* 诗词 Wordle —— 游戏逻辑 */
(function () {
  'use strict';

  var ROWS = 6;
  var HANZI = /[\u3400-\u9fff]/;
  var STORE_KEY = 'poetry-wordle-v1';
  var KINDS = ['qiyan', 'wuyan', 'ci'];

  /* ============ 语料索引 ============ */
  var CORPUS = window.POEM_CORPUS || [];
  var WORKS = CORPUS.filter(function (p) { return p && p.l && p.l.length; });
  var ALL = [];
  var seen = {};
  WORKS.forEach(function (p) {
    (p.l || []).forEach(function (raw) {
      var text = String(raw).trim();
      if (!text || seen[text]) return;
      seen[text] = 1;
      ALL.push({
        text: text,
        chars: text.split(''),
        len: text.split('').length,
        t: p.t, a: p.a, d: p.d,
        c: p.c === 1,
        w: p,                       // 所属作品，用于生成字盘
        lines: (p.l || []).slice()
      });
    });
  });

  var byLen = {};
  var ciByLen = {};
  ALL.forEach(function (l) {
    (byLen[l.len] = byLen[l.len] || []).push(l);
    if (l.c) (ciByLen[l.len] = ciByLen[l.len] || []).push(l);
  });

  var CI_LENGTHS = [4, 5, 6, 7].filter(function (len) {
    return (ciByLen[len] || []).length >= 12;
  });
  if (!CI_LENGTHS.length) CI_LENGTHS = [5, 7];

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function poolFor(kind, seed) {
    if (kind === 'ci') {
      var len = CI_LENGTHS[hash(String(seed) + '#len') % CI_LENGTHS.length];
      return { len: len, list: ciByLen[len] || [] };
    }
    var L = (kind === 'wuyan') ? 5 : 7;
    return { len: L, list: byLen[L] || [] };
  }

  /* ---- 候选字盘 ----
   * 取「答案所在作品 + 另外 2 首」各前 4 句的汉字，去重后打乱。
   * 可提交的句子 = 诗库中那些「每个字都在字盘里」的句子，保证字盘一定打得出来。
   */
  var MAX_KEYS = 84;

  function seededShuffle(arr, seed) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = hash(String(seed) + '#' + i) % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickKeys(ansLine, seed, len) {
    var w0 = ansLine.w;
    var fitCount = function (p) {          // 前 4 句里有几句正好是题目字数
      return (p.l || []).slice(0, 4).filter(function (s) { return s.length === len; }).length;
    };
    var strict = WORKS.filter(function (p) { return p !== w0 && fitCount(p) === 4; });
    var mid = WORKS.filter(function (p) { return p !== w0 && fitCount(p) >= 3; });
    var two = WORKS.filter(function (p) { return p !== w0 && fitCount(p) >= 2; });
    var loose = WORKS.filter(function (p) { return p !== w0 && fitCount(p) >= 1; });
    var any = WORKS.filter(function (p) { return p !== w0; });
    var pickPool = function (level) {                     // 同级里优先同体裁（诗配诗、词配词）
      var sameT = level.filter(function (p) { return (p.c === 1) === (w0.c === 1); });
      if (sameT.length >= 2) return sameT;
      return level.length >= 2 ? level : null;
    };
    var base = pickPool(strict) || pickPool(mid) || pickPool(two) || pickPool(loose) || any;

    var build = function (works) {
      var set = {};
      works.forEach(function (w) {
        (w.l || []).slice(0, 4).forEach(function (s) {    // 每首取前 4 句
          s.split('').forEach(function (c) { set[c] = 1; });
        });
      });
      var must = ansLine.text.split('');                  // 答案的字一个都不能少
      var others = seededShuffle(Object.keys(set).filter(function (c) {
        return must.indexOf(c) === -1;
      }), seed);
      return seededShuffle(must.concat(others).slice(0, MAX_KEYS), String(seed) + '#final');
    };

    var pickPair = function (s) {
      var a1 = base[hash(s + '#k1') % base.length];
      var r2 = base.filter(function (p) { return p !== a1; });
      var a2 = r2.length ? r2[hash(s + '#k2') % r2.length] : a1;
      return [a1, a2];
    };

    // 换几组干扰诗，挑一个「能拼句子最多」的字盘，保证点字玩家有得玩
    var best = build([w0].concat(pickPair(String(seed))));
    var bestCount = spellableCount(best, len);
    for (var t = 1; t < 6 && bestCount < 8; t++) {
      var cand = build([w0].concat(pickPair(String(seed) + '#try' + t)));
      var cnt = spellableCount(cand, len);
      if (cnt > bestCount) { bestCount = cnt; best = cand; }
    }
    return best;
  }

  /* 用给定字盘能拼出多少句同长度的原句 */
  function spellableCount(keys, len) {
    var set = {};
    keys.forEach(function (c) { set[c] = 1; });
    var list = byLen[len] || [];
    var cnt = 0;
    list.forEach(function (l) {
      for (var i = 0; i < l.chars.length; i++) if (!set[l.chars[i]]) return;
      cnt++;
    });
    return cnt;
  }

  var legalCache = {};
  /* 可提交集合：诗库中所有同长度的原句。
   * 字盘保证答案一定拼得出来（答案的字全在盘上），会打字的玩家则不受字盘限制。 */
  function legalForGame() {
    var ck = 'all|' + n;
    if (legalCache[ck]) return legalCache[ck];
    var out = {};
    (byLen[n] || []).forEach(function (l) { out[l.text] = 1; });
    legalCache[ck] = out;
    return out;
  }

  /* 仅用于自检：当前字盘实际能拼出多少句 */
  function spellable() {
    var set = {};
    (game.keys || []).forEach(function (c) { set[c] = 1; });
    return Object.keys(legalForGame()).filter(function (s) {
      for (var i = 0; i < s.length; i++) if (!set[s[i]]) return false;
      return true;
    });
  }
  /* ============ 状态 ============ */
  var state = load();

  function defaults() {
    return {
      settings: { kind: 'qiyan', play: 'daily', theme: 'auto' },
      stats: { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] },
      games: {},
      recent: []
    };
  }

  var FRESH = false;
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) { FRESH = true; return defaults(); }
      var s = JSON.parse(raw);
      var d = defaults();
      s.settings = Object.assign(d.settings, s.settings || {});
      s.stats = Object.assign(d.stats, s.stats || {});
      s.games = s.games || {};
      s.recent = s.recent || [];
      if (!s.stats.dist || s.stats.dist.length !== 6) s.stats.dist = d.stats.dist;
      return s;
    } catch (e) { return defaults(); }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ============ DOM ============ */
  var $ = function (id) { return document.getElementById(id); };
  var board = $('board'), kb = $('kbInput'), toastEl = $('toast');
  var metaDate = $('metaDate'), metaInfo = $('metaInfo'), hintTag = $('hintTag');
  var knownBar = $('knownBar'), keysEl = $('keys');

  /* ============ 当前局 ============ */
  var game = null;      // { key, answer:{}, guesses:[], status, hints:{} }
  var n = 7;            // 谜底字数
  var rows = [];        // tile 元素
  var cur = '';         // 当前输入
  var locked = false;   // 动画/结束锁定

  function todayStr() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function gameKey() {
    return state.settings.play === 'daily'
      ? 'daily|' + state.settings.kind + '|' + todayStr()
      : 'free|' + state.settings.kind;
  }

  function pickAnswer() {
    var kind = state.settings.kind;
    if (state.settings.play === 'daily') {
      var seed = todayStr();
      var info = poolFor(kind, seed);
      var list = info.list;
      return list[hash(seed + '|' + kind) % list.length];
    }
    // 自由练习：随机，尽量避开最近出过的
    for (var tries = 0; tries < 24; tries++) {
      var s = String(Math.floor(Math.random() * 1e9)) + '|' + Date.now();
      var pi = poolFor(kind, s);
      var pick = pi.list[hash(s + '|' + kind) % pi.list.length];
      if (state.recent.indexOf(pick.text) === -1) return pick;
    }
    var pi2 = poolFor(kind, String(Date.now()));
    return pi2.list[hash(String(Date.now())) % pi2.list.length];
  }

  function newGame() {
    var ans = pickAnswer();
    var seed = state.settings.play === 'daily'
      ? (todayStr() + '|' + state.settings.kind + '|keys')
      : String(Math.floor(Math.random() * 1e9));
    return {
      answer: ans.text,
      keys: pickKeys(ans, seed, ans.len),
      guesses: [], status: null,
      hints: { author: 0, title: 0, image: 0, chars: [] }
    };
  }

  function startGame(fresh) {
    var key = gameKey();
    var g = state.games[key];
    if (fresh || !g || (state.settings.play === 'free' && g.status)) {
      g = newGame();
      state.games[key] = g;
      if (state.settings.play === 'free') {
        state.recent.push(g.answer);
        if (state.recent.length > 30) state.recent.shift();
      }
      save();
    }
    game = g;
    game.key = key;
    game.hints = game.hints || { author: 0, title: 0, image: 0, chars: [] };
    if (game.hints.image === undefined) game.hints.image = 0;
    n = game.answer.length;
    if (!game.keys || !game.keys.length) {
      game.keys = pickKeys(lineOf(game.answer), key, n);   // 兼容旧存档
      save();
    }
    cur = '';
    locked = !!game.status;
    kb.value = '';
    kb.setAttribute('maxlength', n);
    buildBoard();
    renderAll();
    closeResult();
    if (!locked && !('ontouchstart' in window)) kb.focus();
  }

  /* ============ 渲染 ============ */
  function buildBoard() {
    board.style.setProperty('--cols', n);
    board.innerHTML = '';
    rows = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var i = 0; i < n; i++) {
        var t = document.createElement('div');
        t.className = 'tile';
        t.setAttribute('role', 'gridcell');
        board.appendChild(t);
        row.push(t);
      }
      rows.push(row);
    }
  }

  function judge(guess, answer) {
    var res = [], pool = {}, i;
    for (i = 0; i < answer.length; i++) pool[answer[i]] = (pool[answer[i]] || 0) + 1;
    for (i = 0; i < answer.length; i++) {
      if (guess[i] === answer[i]) { res[i] = 'correct'; pool[guess[i]]--; }
      else res[i] = 'absent';
    }
    for (i = 0; i < answer.length; i++) {
      if (res[i] === 'absent' && pool[guess[i]] > 0) { res[i] = 'present'; pool[guess[i]]--; }
    }
    return res;
  }

  function renderAll() {
    // 已提交的行
    for (var r = 0; r < ROWS; r++) {
      var g = game.guesses[r];
      for (var i = 0; i < n; i++) {
        var t = rows[r][i];
        if (g) {
          t.textContent = g.text[i];
          t.className = 'tile ' + g.res[i];
        } else {
          t.textContent = '';
          t.className = 'tile';
        }
      }
    }
    renderCurrent();
    renderMeta();
    renderKnown();
    renderKeys();
  }

  function renderCurrent() {
    var r = game.guesses.length;
    if (r >= ROWS) return;
    var chars = cur.split('');
    for (var i = 0; i < n; i++) {
      var t = rows[r][i];
      if (i < chars.length) {
        t.textContent = chars[i];
        t.className = 'tile filled' + (i === chars.length - 1 ? ' cursor' : '');
      } else {
        t.textContent = '';
        t.className = 'tile' + (i === chars.length ? ' cursor' : '');
      }
    }
  }

  function renderMeta() {
    var ans = lineOf(game.answer);
    var d = new Date();
    metaDate.textContent = state.settings.play === 'daily'
      ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
      : '自由练习';
    var kindTxt;
    if (ans && ans.c) kindTxt = ans.d + ' · 词 · ' + n + '字句';
    else if (n === 5) kindTxt = (ans ? ans.d : '') + ' · 五言';
    else if (n === 7) kindTxt = (ans ? ans.d : '') + ' · 七言';
    else kindTxt = (ans ? ans.d : '') + ' · ' + n + '字';
    metaInfo.textContent = kindTxt;
    var hs = hintCount();
    hintTag.hidden = hs === 0;
    hintTag.textContent = hs ? '提示 ×' + hs : '';
  }

  var lineIndex = {};
  ALL.forEach(function (l) { if (!lineIndex[l.text]) lineIndex[l.text] = l; });
  function lineOf(text) { return lineIndex[text]; }

  function renderKnown() {
    var ans = lineOf(game.answer);
    var h = game.hints;
    var pills = [];
    if (h.author && ans) pills.push('作者 <b>' + ans.a + '</b>');
    if (h.title && ans) pills.push('诗题 <b>《' + ans.t + '》</b>');
    (h.chars || []).forEach(function (idx) {
      pills.push('第' + (idx + 1) + '字 <b>' + game.answer[idx] + '</b>');
    });
    knownBar.innerHTML = pills.length ? pills.map(function (p) {
      return '<span class="known-pill">' + p + '</span>';
    }).join('') : '';
    knownBar.hidden = !pills.length;
  }

  /* 字盘：按已猜结果给每个候选字着色 */
  function renderKeys() {
    var best = {};
    game.guesses.forEach(function (g) {
      for (var i = 0; i < g.text.length; i++) {
        var ch = g.text[i], st = g.res[i];
        if (!best[ch]) best[ch] = st;
        else if (st === 'correct' || (st === 'present' && best[ch] === 'absent')) best[ch] = st;
      }
    });
    keysEl.innerHTML = (game.keys || []).map(function (ch) {
      return '<button type="button" class="key' + (best[ch] ? ' ' + best[ch] : '') +
        '" data-ch="' + ch + '">' + ch + '</button>';
    }).join('');
  }

  keysEl.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var b = el.closest('.key');
    if (!b) return;
    typeChar(b.getAttribute('data-ch'));   // 不主动 focus，避免手机每次点字都弹输入法
  });

  function hintCount() {
    var h = game.hints || {};
    return (h.author ? 1 : 0) + (h.title ? 1 : 0) + ((h.chars || []).length) + (h.image ? 1 : 0);
  }

  /* ================= 看图提示 =================
   * 现状：查预生成图库 js/hint-images.js（句 → 图片路径），无网络请求、点开秒出。
   *
   * ★ 接入「运行时实时生成」的端口就在下面这个 IMAGE_PORT ★
   * 平台开放图像生成后，只需给它赋值一个 async 函数，其余逻辑（计分、弹窗、缓存）
   * 都不用改：
   *
   *   IMAGE_PORT = async function (line) {
   *     showImageLoading();                          // 生成约 10–20 秒，务必给加载态
   *     const url = await callYourImageApi({         // ← 换成真实图像接口
   *       prompt: buildPaintingPrompt(line),
   *       size: '1536x1024',
   *     });
   *     return url;                                  // 返回可访问的图片地址
   *   };
   *
   * 注意：
   *   1. 生成结果建议回写 window.HINT_IMAGES[line.text] = url，下次点开就是缓存、秒出；
   *   2. 作画提示词必须显式禁止文字（见 buildPaintingPrompt），否则画面常被写上诗句；
   *   3. 失败要有降级提示，别让按钮点了没反应；
   *   4. 图片提示计入 hints.image，计分与分享逻辑无需改动。
   * ========================================== */
  var IMAGE_PORT = null;   // ← 端口：null 表示仅用预生成图库

  /** 是否真的有图可看：接了实时生成端口，或预生成图库里至少有一张图 */
  function imageHintAvailable() {
    if (IMAGE_PORT) return true;
    var m = window.HINT_IMAGES || {};
    for (var k in m) { if (m[k]) return true; }
    return false;
  }

  function buildPaintingPrompt(line) {
    return 'Traditional Chinese ink wash painting of: ' + line.text +
      ' (' + (line.d || '') + ' ' + (line.a || '') + '). ' +
      'Poetic, minimalist, soft ink tones, wide empty space. ' +
      'Absolutely NO text, NO letters, NO calligraphy, NO watermark in the image.';
  }

  function getHintImageUrl(text) {
    return (window.HINT_IMAGES || {})[text] || null;
  }

  function showHintImage(text, url) {
    if (!game.hints.image) {
      game.hints.image = 1;
      save();
      renderMeta();
    }
    if (url) window.HINT_IMAGES[text] = url;          // 回写缓存，下次秒开
    $('hintImage').src = url || '';
    $('modalImage').hidden = false;
  }

  function useHintImage() {
    if (!game || game.status) { toast('本局已结束'); return; }
    var line = lineOf(game.answer);
    var cached = getHintImageUrl(game.answer);
    if (cached) { showHintImage(game.answer, cached); return; }

    if (!IMAGE_PORT) { toast('这句暂无配图，画师还在赶工'); return; }

    toast('正在作画，稍等几秒…', 4000);
    Promise.resolve()
      .then(function () { return IMAGE_PORT(line); })
      .then(function (url) {
        if (url) showHintImage(game.answer, url);
        else toast('作画失败，换个提示试试');
      })
      .catch(function () { toast('作画失败，换个提示试试'); });
  }

  /* ============ toast ============ */
  var toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 1600);
  }

  function shakeRow(r) {
    rows[r].forEach(function (t) { t.classList.add('row-shake'); });
    setTimeout(function () {
      rows[r].forEach(function (t) { t.classList.remove('row-shake'); });
    }, 400);
  }

  /* ============ 输入 ============ */
  function syncInput() {
    if (locked) { kb.value = cur; return; }   // 翻牌动画期间不接受输入
    var keys = game ? (game.keys || []) : [];
    var v = kb.value.split('').filter(function (c) { return HANZI.test(c); }).slice(0, n).join('');
    if (v !== kb.value) kb.value = v;
    cur = v;
    renderCurrent();
  }

  kb.addEventListener('input', syncInput);

  kb.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Backspace') { /* 交给 input 事件 */ }
  });

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) return;
    if (el.closest('.modal')) return;
    if (el.closest('button')) return;
    if (!locked) kb.focus();
  });

  function backspace() {
    if (locked) return;
    kb.value = kb.value.slice(0, -1);
    syncInput();
  }

  function typeChar(ch) {
    if (locked) return;
    if (kb.value.length >= n) { toast('已经 ' + n + ' 个字了'); return; }
    kb.value += ch;
    syncInput();
  }

  function submit() {
    if (locked) return;
    if (cur.length < n) { toast('还差 ' + (n - cur.length) + ' 个字'); shakeRow(game.guesses.length); return; }
    var legal = legalForGame();
    if (!legal[cur]) {
      toast('诗库里没有这一句，换一句试试');
      shakeRow(game.guesses.length);
      return;
    }
    if (game.guesses.some(function (g) { return g.text === cur; })) {
      toast('这句已经猜过了');
      shakeRow(game.guesses.length);
      return;
    }

    locked = true;
    var r = game.guesses.length;
    var res = judge(cur, game.answer);
    game.guesses.push({ text: cur, res: res });
    state.games[game.key] = game;
    save();

    // 翻牌动画：逐字转走 → 转回并着色
    var row = rows[r];
    for (var i = 0; i < n; i++) {
      (function (idx) {
        setTimeout(function () { row[idx].classList.add('flip-in'); }, idx * 150);
        setTimeout(function () {
          row[idx].textContent = cur[idx];
          row[idx].className = 'tile ' + res[idx] + ' flip-out';
        }, idx * 150 + 205);
      })(i);
    }

    var delay = n * 150 + 320;
    setTimeout(function () {
      for (var j = 0; j < n; j++) row[j].classList.remove('flip-out');
      cur = '';
      kb.value = '';
      var win = res.every(function (x) { return x === 'correct'; });
      if (win) {
        game.status = 'win';
        game.hints = game.hints || {};
        finish(true);
        bounceRow(r);
        setTimeout(function () { openResult(true); }, 620);
      } else if (game.guesses.length >= ROWS) {
        game.status = 'lose';
        finish(false);
        setTimeout(function () { openResult(false); }, 320);
      } else {
        locked = false;
        renderCurrent();
      }
      renderKeys();
      save();
    }, delay);
  }

  function bounceRow(r) {
    rows[r].forEach(function (t, i) {
      setTimeout(function () { t.classList.add('bounce'); }, i * 90);
    });
  }

  /* ============ 结算 ============ */
  function finish(win) {
    var s = state.stats;
    if (game.counted) return;
    game.counted = 1;
    s.played++;
    if (win) {
      s.wins++;
      s.dist[game.guesses.length - 1]++;
      s.streak++;
      if (s.streak > s.maxStreak) s.maxStreak = s.streak;
    } else {
      s.streak = 0;
    }
    save();
  }

  /* ============ 提示 ============ */
  function useHint(type) {
    if (!game || game.status) { toast('本局已结束'); return; }
    var h = game.hints;
    if (type === 'author') {
      if (h.author) { toast('作者已经给过啦'); return; }
      h.author = 1;
      var a = lineOf(game.answer);
      toast(a ? a.d + ' · ' + a.a : '—');
    } else if (type === 'title') {
      if (h.title) { toast('诗题已经给过啦'); return; }
      h.title = 1;
      var t = lineOf(game.answer);
      toast(t ? '《' + t.t + '》' : '—');
    } else {
      var known = h.chars || [];
      if (known.length >= n) { toast('没有可揭的字了'); return; }
      var idx = -1;
      var last = game.guesses.length ? game.guesses[game.guesses.length - 1] : null;
      var cand = [];
      for (var i = 0; i < n; i++) {
        if (known.indexOf(i) !== -1) continue;
        if (!last || last.res[i] !== 'correct') cand.push(i);
      }
      if (!cand.length) cand = known.length ? [] : [0];
      if (!cand.length) { toast('没有可揭的字了'); return; }
      idx = cand[Math.floor(Math.random() * cand.length)];
      h.chars = known.concat([idx]);
      toast('第 ' + (idx + 1) + ' 字是「' + game.answer[idx] + '」', 2200);
    }
    save();
    renderMeta();
    renderKnown();
  }

  /* ============ 结果弹窗 ============ */
  var modalResult = $('modalResult');
  function openResult(win) {
    var ans = lineOf(game.answer);
    $('resultTitle').textContent = win ? '猜中了' : '差一点';
    var poem = (ans ? ans.lines : [game.answer]).map(function (l) {
      return l === game.answer ? '<span class="hit">' + l + '</span>' : l;
    }).join('<br>');
    $('resultPoem').innerHTML = poem;
    $('resultSrc').innerHTML = ans
      ? '《' + ans.t + '》 · ' + ans.d + ' · ' + ans.a
      : '';
    var parts = [];
    if (win) parts.push('第 ' + game.guesses.length + ' 次猜中');
    else parts.push('六次未中');
    if (hintCount()) parts.push('用了 ' + hintCount() + ' 个提示');
    $('resultNote').textContent = parts.join(' · ');
    $('btnNext').textContent = state.settings.play === 'daily' ? '再来一局（自由练）' : '再来一局';
    modalResult.hidden = false;
  }
  function closeResult() { modalResult.hidden = true; }

  $('btnNext').addEventListener('click', function () {
    closeResult();
    if (state.settings.play === 'daily') {
      state.settings.play = 'free';
      syncModeChips();
      save();
    }
    startGame(true);
  });

  $('btnShare').addEventListener('click', function () {
    var txt = shareText();
    copyText(txt).then(function (ok) {
      toast(ok ? '成绩已复制，去粘贴吧' : '复制失败，手动选中吧');
      if (!ok) console.log(txt);
    });
  });

  function shareText() {
    var head = '诗词 Wordle · ' + todayStr() + ' · ' + (state.settings.play === 'daily' ? '每日' : '自由');
    var lines = game.guesses.map(function (g) {
      return g.res.map(function (r) {
        return r === 'correct' ? '\u{1F7E9}' : (r === 'present' ? '\u{1F7E8}' : '\u{2B1C}');
      }).join('');
    }).join('\n');
    var tail = (game.status === 'win' ? game.guesses.length : 'X') + '/6'
      + (hintCount() ? ' · 提示×' + hintCount() : '');
    return head + '\n' + lines + '\n' + tail;
  }

  function copyText(str) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(str).then(function () { return true; },
        function () { return fallbackCopy(str); });
    }
    return Promise.resolve(fallbackCopy(str));
  }
  function fallbackCopy(str) {
    try {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ============ 模式切换 ============ */
  function syncModeChips() {
    document.querySelectorAll('#kindBar .mode-chip').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.kind === state.settings.kind);
    });
    document.querySelectorAll('#playBar .mode-chip').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.play === state.settings.play);
    });
  }

  document.querySelectorAll('#kindBar .mode-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      if (state.settings.kind === b.dataset.kind) return;
      state.settings.kind = b.dataset.kind;
      syncModeChips(); save(); startGame(false);
    });
  });
  document.querySelectorAll('#playBar .mode-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      if (state.settings.play === b.dataset.play) return;
      state.settings.play = b.dataset.play;
      syncModeChips(); save(); startGame(false);
    });
  });

  /* ============ 统计弹窗 ============ */
  var modalStats = $('modalStats');
  function openStats() {
    var s = state.stats;
    var rate = s.played ? Math.round(s.wins / s.played * 100) : 0;
    $('statsGrid').innerHTML = [
      ['对局', s.played], ['胜率', rate + '%'], ['连胜', s.streak], ['最长', s.maxStreak]
    ].map(function (p) {
      return '<div class="stat-cell"><div class="stat-num">' + p[1] + '</div><div class="stat-lab">' + p[0] + '</div></div>';
    }).join('');
    var max = Math.max.apply(null, s.dist.concat([1]));
    var curWin = (game && game.status === 'win') ? game.guesses.length : -1;
    $('distBox').innerHTML = s.dist.map(function (v, i) {
      var w = Math.max(v > 0 ? 8 : 2, Math.round(v / max * 100));
      return '<div class="dist-row"><span class="dist-num">' + (i + 1) + '</span>' +
        '<span class="dist-bar"><span class="dist-fill" style="width:' + w + '%' +
        (curWin === i + 1 ? ';background:var(--seal)' : '') + '">' + (v || '') + '</span></span></div>';
    }).join('');
    modalStats.hidden = false;
  }

  $('btnStats').addEventListener('click', openStats);
  $('btnHelp').addEventListener('click', function () { $('modalHelp').hidden = false; });
  $('btnResetStats').addEventListener('click', function () {
    state.stats = defaults().stats;
    save(); openStats(); toast('战绩已清空');
  });

  $('btnHintAuthor').addEventListener('click', function () { useHint('author'); });
  $('btnHintTitle').addEventListener('click', function () { useHint('title'); });
  $('btnHintChar').addEventListener('click', function () { useHint('char'); });
  $('btnHintImage').addEventListener('click', useHintImage);
  // 没有图可看时（图库为空且未接实时生成端口）隐藏按钮与帮助里的对应说明，
  // 避免出现「点了只弹一句暂无配图」的死按钮。
  if (!imageHintAvailable()) {
    $('btnHintImage').hidden = true;
    if ($('helpImageTip')) $('helpImageTip').hidden = true;
  }
  $('btnBack').addEventListener('click', backspace);
  $('btnEnter').addEventListener('click', function () { submit(); if (!locked) kb.focus(); });

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.closest('.modal').hidden = true;
    });
  });
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  });

  /* ============ 主题 ============ */
  function applyTheme() {
    var t = state.settings.theme;
    if (t === 'auto') {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }
  $('btnTheme').addEventListener('click', function () {
    var order = ['auto', 'light', 'dark'];
    var i = order.indexOf(state.settings.theme);
    state.settings.theme = order[(i + 1) % order.length];
    applyTheme(); save();
    toast('主题：' + ({ auto: '跟随系统', light: '宣纸', dark: '夜色' })[state.settings.theme]);
  });
  applyTheme();

  /* ============ 启动 ============ */
  if (!ALL.length) {
    board.innerHTML = '<div style="grid-column:1/-1;color:var(--seal)">诗词库加载失败</div>';
  } else {
    syncModeChips();
    startGame(false);
    if (FRESH) $('modalHelp').hidden = false;   // 首次进入自动说明玩法
    else if (game && game.status) setTimeout(function () { openResult(game.status === 'win'); }, 300);
  }

  // 调试入口
  window.__PW = {
    state: function () { return state; },
    answer: function () { return game && game.answer; },
    type: typeChar,
    keys: function () { return game && game.keys; },
    restart: function () { startGame(true); },
    spellable: spellable,
    legalList: function () { return Object.keys(legalForGame()); },
    legalCount: function () { return Object.keys(legalForGame()).length; },
    poolSizes: function () {
      return {
        byLen5: (byLen[5] || []).length,
        byLen7: (byLen[7] || []).length,
        ci: CI_LENGTHS.map(function (l) { return l + ':' + (ciByLen[l] || []).length; }).join(', ')
      };
    }
  };
})();
