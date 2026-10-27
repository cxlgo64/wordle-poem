#!/usr/bin/env node
/* 生成实机截图（首发物料用）
 *
 * AIWANNA 自带的 record_game_video 只支持 <canvas> 游戏（REC.shot 走 canvas.toBlob），
 * 本项目是 DOM 游戏，所以这里用本地 Chrome 无头模式：
 *   1. 复制 dist 到 1gp-kit/tmp
 *   2. 注入自动演示脚本，用真实点击把游戏推到不同状态
 *   3. 起一个临时 http 服务（避免 file:// 下 localStorage 抛异常）
 *   4. 逐状态截图到 1gp-kit/shots/
 *
 * 截的都是真实玩法：点候选字盘 → 提交 → 拿到绿/黄/灰着色。
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(ROOT, '1gp-kit', 'tmp');
const OUT = path.join(ROOT, '1gp-kit', 'shots');
const PORT = 8765;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function clearOut(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) { clearOut(f); try { fs.rmdirSync(f); } catch (_) {} }
    else { try { fs.unlinkSync(f); } catch (_) {} }
  }
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 每个状态一段注入脚本，helpers 是共用的点字盘函数
const HELPERS = `
// 无头 + 虚拟时间下 CSS 动画不一定走完，关掉动效，让格子直接显示最终配色
(function(){var st=document.createElement('style');
 st.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';
 document.head.appendChild(st);})();
// 用隐藏输入框打字（打字玩家本来就能提交全库真实诗句，不限于字盘）
function typeLine(s){var kb=document.getElementById('kbInput');
  kb.value=s;kb.dispatchEvent(new Event('input'));}
function pick(){var P=window.__PW,legal=P.legalList(),ans=P.answer()||'';
  // 挑与答案交集最多的真实诗句：保证截图里有绿/黄反馈，又不剧透答案
  var set={};for(var i=0;i<ans.length;i++)set[ans[i]]=(set[ans[i]]||0)+1;
  function score(s){var n=0,used={};
    for(var i=0;i<s.length;i++){var c=s[i];used[c]=(used[c]||0)+1;
      if((set[c]||0)>0&&used[c]<=set[c])n++;}return n;}
  // 候选必须是同长度的真实诗句，且排除答案本身（不剧透今日题）
  var cand=legal.filter(function(s){return s!==ans&&s.length===ans.length;});
  cand.sort(function(x,y){return score(y)-score(x);});
  return [cand[0]||'', cand[1]||cand[0]||''];}
`;

const STATES = [
  { name: '01-start', js: '/* 初始盘面 + 候选字盘 */' },
  { name: '02-first-guess', js: `
    setTimeout(function(){ var p=pick(); typeLine(p[0]);
      document.getElementById('btnEnter').click(); }, 300);` },
  { name: '03-two-guesses', js: `
    setTimeout(function(){ var p=pick(); typeLine(p[0]);
      document.getElementById('btnEnter').click();
      setTimeout(function(){ typeLine(p[1]);
        // 等翻牌锁定释放（n*150+320ms，七言约 1370ms）后再点，否则输入会被吞掉
        document.getElementById('btnEnter').click(); }, 1800); }, 300);` },
  { name: '04-help', js: `
    setTimeout(function(){ document.getElementById('btnHelp').click(); }, 600);` }
];

clearOut(TMP);
fs.mkdirSync(TMP, { recursive: true });
copyDir(path.join(ROOT, 'dist'), TMP);
fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(path.join(TMP, 'index.html'), 'utf8');
for (const s of STATES) {
  const inject = '<script>' + HELPERS + s.js + '</script>';
  fs.writeFileSync(path.join(TMP, s.name + '.html'), html.replace('</body>', inject + '\n</body>'));
}

const server = cp.spawn('python3', ['-m', 'http.server', String(PORT), '--directory', TMP],
  { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(800);
  for (const s of STATES) {
    const url = `http://127.0.0.1:${PORT}/${s.name}.html`;
    const out = path.join(OUT, s.name + '.png');
    try {
      cp.execSync(`"${CHROME}" --headless=new --disable-gpu --hide-scrollbars ` +
        `--window-size=720,1280 --virtual-time-budget=12000 ` +
        `--screenshot="${out}" "${url}"`, { stdio: 'ignore', timeout: 120000 });
      console.log('✅ ' + s.name + '.png  ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
    } catch (e) {
      console.log('❌ ' + s.name + ' 失败: ' + e.message);
    }
  }
  server.kill('SIGTERM');
  clearOut(TMP);
  console.log('截图输出: ' + OUT);
})();
