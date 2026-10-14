/* 临时冒烟测试：校验诗词库数据质量与判定算法 */
global.window = global;
require('../js/data-poems.js');
require('../js/data-ci.js');

const C = global.POEM_CORPUS;
const HAN = /^[\u3400-\u9fff]+$/;
let bad = [], dup = {}, total = 0;
const byLen = {}, ciByLen = {};

C.forEach(p => {
  if (!p.t || !p.a || !p.d) bad.push(['缺字段', p.t]);
  (p.l || []).forEach(line => {
    total++;
    if (!HAN.test(line)) bad.push(['非纯汉字', p.t + ' → ' + line]);
    const len = [...line].length;
    if (len < 3 || len > 11) bad.push(['长度异常', p.t + ' → ' + line + '(' + len + ')']);
    if (dup[line]) dup[line]++; else dup[line] = 1;
    byLen[len] = (byLen[len] || 0) + 1;
    if (p.c === 1) ciByLen[len] = (ciByLen[len] || 0) + 1;
  });
});

const dups = Object.keys(dup).filter(k => dup[k] > 1);
console.log('作品数:', C.length, '| 句子总数:', total);
console.log('按字数(全部):', JSON.stringify(byLen));
console.log('按字数(词):', JSON.stringify(ciByLen));
console.log('重复句:', dups.length ? dups.join(' / ') : '无');
console.log('异常:', bad.length ? JSON.stringify(bad.slice(0, 20)) : '无');

// 判定算法校验
function judge(g, a) {
  const res = [], pool = {};
  for (const ch of a) pool[ch] = (pool[ch] || 0) + 1;
  for (let i = 0; i < a.length; i++) { if (g[i] === a[i]) { res[i] = 'C'; pool[g[i]]--; } else res[i] = '.'; }
  for (let i = 0; i < a.length; i++) { if (res[i] === '.' && pool[g[i]] > 0) { res[i] = 'P'; pool[g[i]]--; } }
  return res.join('');
}
// 答案「床前明月光」索引：床0 前1 明2 月3 光4
const cases = [
  ['床前明月光', '床前明月光', 'CCCCC'],
  ['明月光前床', '床前明月光', 'PPPPP'], // 全错位
  ['月月月月月', '床前明月光', '...C.'], // 答案只有一个「月」，其余判无
  ['明月月月光', '床前明月光', 'P..CC'],
  ['白白白白白', '床前明月光', '.....'],
  ['月光明月前', '床前明月光', '.PCCP'],
];
let ok = true;
cases.forEach(([g, a, exp]) => {
  const got = judge([...g], [...a]);
  if (got !== exp) { ok = false; console.log('❌', g, a, '期望', exp, '得到', got); }
});
console.log('判定算法:', ok ? '✅ 全部通过' : '❌ 有误');
