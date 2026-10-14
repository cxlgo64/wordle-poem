/* DOM 级冒烟：用 jsdom 真实加载 index.html，跑完一局 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 把外链脚本内联注入（jsdom 30 不再支持自定义 ResourceLoader），并用 http origin 以便 localStorage 可用
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="([^"]+)"><\/script>/g, function (m, src) {
    return '<script>' + fs.readFileSync(path.join(ROOT, src), 'utf8') + '</script>';
  });
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const w = dom.window, d = w.document;
  await wait(600);

  const say = (ok, msg) => console.log((ok ? '✅ ' : '❌ ') + msg);
  let pass = true;
  const check = (ok, msg) => { if (!ok) pass = false; say(ok, msg); };

  // 1. 无脚本错误 + 语料加载
  check(errors.length === 0, '页面无 JS 错误' + (errors.length ? ' → ' + errors[0] : ''));
  check(!!w.__PW, '游戏脚本已启动');
  const pool = w.__PW.poolSizes();
  console.log('   池子:', JSON.stringify(pool));
  check(pool.byLen5 > 100 && pool.byLen7 > 100, '五言/七言候选充足');

  // 2. 棋盘
  const tiles = d.querySelectorAll('#board .tile');
  const answer = w.__PW.answer();
  console.log('   今日答案:', answer);
  const n = [...answer].length;
  check(tiles.length === 6 * n, `棋盘 ${tiles.length} 格 = 6 行 × ${n} 字`);

  // 3.5 候选字盘
  const keyBtns = [...d.querySelectorAll('#keys .key')];
  const keyChars = keyBtns.map(b => b.dataset.ch);
  const spell = w.__PW.spellable();
  console.log('   字盘字数:', keyChars.length, '| 字盘可拼句子:', spell.length,
    '| 全库可提交:', w.__PW.legalList().length);
  check(keyChars.length >= n, `字盘已渲染 ${keyChars.length} 个字`);
  check([...answer].every(c => keyChars.includes(c)), '答案的每个字都在字盘里');
  check(spell.includes(answer), '答案能用字盘拼出来（移动端点字必胜路径存在）');
  check(spell.length >= 6, `字盘能拼出 ${spell.length} 句，够玩`);
  check(w.__PW.legalList().length > 100, '会打字的玩家可提交全库诗句');

  // 3. 提交一句「不在库中」的话 → 应被拒绝
  const kb = d.getElementById('kbInput');
  kb.value = '一二三四五六七'.slice(0, n);
  kb.dispatchEvent(new w.Event('input'));
  d.getElementById('btnEnter').click();
  await wait(120);
  check(!/correct|present/.test(d.querySelector('#board .tile').className), '非诗句被拒绝，不计入');
  check(!d.getElementById('toast').hidden, '弹出提示：诗库里没有这一句');
  kb.value = ''; kb.dispatchEvent(new w.Event('input'));

  // 4. 提示按钮
  d.getElementById('btnHintAuthor').click();
  d.getElementById('btnHintTitle').click();
  await wait(60);
  const pills = d.querySelectorAll('#knownBar .known-pill');
  check(pills.length === 2, '作者/诗题提示已显示');
  check(!d.getElementById('hintTag').hidden, '提示计数标记出现');

  // 4.5 图片提示：有图 → 弹窗 + 计数；无图 → toast
  w.HINT_IMAGES = w.HINT_IMAGES || {};
  w.HINT_IMAGES[answer] = 'assets/hints/damo-guyan-zhi.png';
  d.getElementById('btnHintImage').click();
  await wait(60);
  check(!d.getElementById('modalImage').hidden, '有配图时弹出图片提示');
  check(d.getElementById('hintImage').src.includes('damo-guyan-zhi'), '图片 src 指向配图资源');
  check(w.__PW.state().games[Object.keys(w.__PW.state().games)[0]].hints.image === 1, '图片提示已计入 hints');
  d.querySelector('#modalImage [data-close]').click();
  await wait(60);
  d.getElementById('btnHintImage').click();
  await wait(60);
  check(w.__PW.state().games[Object.keys(w.__PW.state().games)[0]].hints.image === 1, '重复看图不重复计数');
  delete w.HINT_IMAGES[answer];

  // 5. 用「点字盘」的方式猜一句可提交的诗（走真实点击路径）
  const clickChars = str => {
    for (const ch of str) {
      const btn = [...d.querySelectorAll('#keys .key')].find(b => b.dataset.ch === ch);
      if (!btn) throw new Error('字盘缺少字: ' + ch);
      btn.click();
    }
  };
  const viaKeys = spell.filter(s => s !== answer)[0];
  const sameLen = viaKeys || w.__PW.legalList().filter(s => s !== answer)[0];
  console.log('   测试用句:', sameLen, viaKeys ? '(点字盘)' : '(打字输入)');
  if (viaKeys) clickChars(viaKeys);
  else { kb.value = sameLen; kb.dispatchEvent(new w.Event('input')); }
  check(kb.value === sameLen, '点字盘可填入格子：' + kb.value);
  d.getElementById('btnEnter').click();
  await wait(n * 150 + 500);
  const row0 = [...d.querySelectorAll('#board .tile')].slice(0, n);
  check(row0.every(t => /correct|present|absent/.test(t.className)), '首行已判定并着色');
  check(d.querySelectorAll('#keys .key.correct, #keys .key.present, #keys .key.absent').length > 0,
    '字盘按判定结果着色');

  // 6. 提交正确答案 → 胜利弹窗
  clickChars(answer);
  d.getElementById('btnEnter').click();
  await wait(n * 150 + 1200);
  check(!d.getElementById('modalResult').hidden, '猜中后弹出结果');
  check(/猜中了/.test(d.getElementById('resultTitle').textContent) &&
    w.__PW.state().games[Object.keys(w.__PW.state().games)[0]].status === 'win',
    '结果标题为「猜中了」且状态为 win');
  check(d.getElementById('resultPoem').innerHTML.includes('hit'), '全诗中标出谜底句');
  const st = JSON.parse(w.localStorage.getItem('poetry-wordle-v1'));
  check(st.stats.played === 1 && st.stats.wins === 1, '战绩已写入 localStorage');

  // 7. 分享文本
  const share = w.__PW.state && d.getElementById('btnShare');
  check(!!share, '分享按钮存在');

  // 8. 模式切换
  d.querySelector('#kindBar [data-kind="wuyan"]').click();
  await wait(200);
  const tiles2 = d.querySelectorAll('#board .tile');
  check(tiles2.length === 30, '切到五言后棋盘变 5 列');
  d.querySelector('#playBar [data-play="free"]').click();
  await wait(200);
  check(d.getElementById('metaDate').textContent.includes('自由'), '自由练模式生效');

  // 9. 三种诗体各随机开 10 局：字盘必须能拼出答案，且候选句不能太少
  for (const k of ['qiyan', 'wuyan', 'ci']) {
    d.querySelector(`#kindBar [data-kind="${k}"]`).click();
    await wait(120);
    let minSpell = 999, minKeys = 999, bad = 0;
    for (let t = 0; t < 10; t++) {
      w.__PW.restart();
      await wait(30);
      const a = w.__PW.answer();
      const chars = [...d.querySelectorAll('#keys .key')].map(b => b.dataset.ch);
      const sp = w.__PW.spellable();
      if (![...a].every(c => chars.includes(c)) || !sp.includes(a)) bad++;
      if (sp.length < 6) console.log(`      ⚠️ ${a} 字数${[...a].length} 字盘${chars.length}字 可拼${sp.length}句: ${sp.join('/')}`);
      minSpell = Math.min(minSpell, sp.length);
      minKeys = Math.min(minKeys, chars.length);
    }
    console.log(`   ${k}: 字盘最少 ${minKeys} 字，可拼句最少 ${minSpell} 句`);
    check(bad === 0, `${k} 模式 10 局：答案都能用字盘拼出`);
    check(minSpell >= 5, `${k} 模式字盘候选句充足（最少 ${minSpell} 句）`);
  }

  console.log(pass ? '\n🎉 冒烟测试全部通过' : '\n⚠️  存在失败项');
  process.exit(pass ? 0 : 1);
})();
