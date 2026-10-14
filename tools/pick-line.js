/* 测试辅助：取一句指定字数、且不等于答案的真实诗句 */
global.window = global;
require('../js/data-poems.js');
require('../js/data-ci.js');

const LINES = [];
global.POEM_CORPUS.forEach(p => (p.l || []).forEach(l => LINES.push(l)));

module.exports = function pick(n, exclude) {
  const pool = LINES.filter(l => [...l].length === n && l !== exclude);
  return pool[Math.floor(pool.length / 3)] || null;
};
