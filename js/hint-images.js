/* 看图提示的图库索引：谜底句 → 图片路径
 *
 * 图放在 assets/hints/ 下，作为应用静态资源随站点发布（无需登录、无网络请求）。
 * 补一张图只需两步：图片放进 assets/hints/，然后在这里加一行。
 *
 * ★ 若接入了运行时生成（见 js/game.js 的 IMAGE_PORT），
 *   生成的地址会自动回写到这里当缓存，下一次点开就是本地秒出。
 */
window.HINT_IMAGES = {
  '大漠孤烟直': 'assets/hints/damo-guyan-zhi.png',
  '小荷才露尖尖角': 'assets/hints/xiaohe-jianjianjiao.png',
  '孤帆远影碧空尽': 'assets/hints/gufan-yuanying.png'
};
