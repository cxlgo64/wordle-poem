# 诗词 Wordle

六次机会，猜出今天是**哪一句诗**。把 Wordle 的玩法搬到汉字上：每格一个字，绿色表示字对且位置对，黄色表示这句里有这个字但位置不对，灰色表示没有这个字。

纯静态页面，无框架、无构建，双击 `index.html` 就能玩。

## 玩法

- **六次机会**猜出谜底那一句诗
- 提交的句子必须是**诗库里收录的真实诗句**，瞎拼的字不算——所以拼字没用，得真的想一想
- **候选字盘**：棋盘下方的字由「答案所在那一首 + 另外两首」各取前四句、去重打乱而来（约 50–75 字）。点字即可填入，**手机上不用调输入法**；会打字的话点棋盘空白处可唤起键盘，此时不受字盘限制
- **每日一题**按日期出题，同一天所有人题目一致；**自由练**随时随机加练
- 三种体裁：**七言 / 五言 / 词句**

### 提示（都会记在成绩里）

| 提示 | 说明 |
|---|---|
| 作者 | 显示作者与朝代 |
| 诗题 | 显示出自哪一首 |
| 看图 | 打开依谜底意境生成的画面 |
| 揭一字 | 揭示某一位置上的字 |

### 配色含义

| 颜色 | 含义 |
|---|---|
| 🟩 绿 | 字对，位置也对 |
| 🟨 黄 | 这句里有这个字，但不在这个位置 |
| ⬜ 灰 | 这句里没有这个字 |

猜完后可以复制 emoji 成绩网格去分享，本地会记录对局数、胜率、连胜和猜测次数分布。

## 运行

直接用浏览器打开 `index.html` 即可，无需安装任何依赖。

若用 GitHub Pages：Settings → Pages → 选择分支、根目录（`/`），因为它是纯静态站点，不需要构建步骤。

## 项目结构

```
index.html            页面结构
css/style.css         宣纸风格样式，支持浅色/深色
js/data-poems.js      诗库（唐诗、宋诗）
js/data-ci.js         词库（唐五代词、宋词）
js/hint-images.js     看图提示的图库索引（句 → 图片）
js/game.js            游戏逻辑：出题、判定、字盘、提示、统计、分享
assets/hints/         预生成的提示图
tools/                测试与诊断脚本
```

诗词库共 **249 篇作品、1719 句**，五言 673 句、七言 679 句，词句按字数分桶（4/5/6/7 字各 89–176 句）。想加诗，往 `js/data-poems.js` 或 `js/data-ci.js` 的数组里再添一项即可：

```js
{ t: '诗题', a: '作者', d: '朝代', c: 0, l: ['句一', '句二', '句三', '句四'] }   // c: 0=诗，1=词
```

## 看图提示与「实时生成」的接入端口

**现状**：图是离线预生成的，放在 `assets/hints/`，索引在 `js/hint-images.js`。点「看图」时直接查表显示，零延迟、零费用；没有配图的句子会提示「画师还在赶工」。

> 之所以没做运行时生成：云服务的大模型通道目前只开放文本对话。模型目录里虽有 `hunyuan-image-alpha`，但经 `chat.completions` 调用会返回 `request_invalid_parameter`（用文本模型对照验证过链路是通的），SDK 也没有图像端点。等平台开放后再切换即可。

**★ 接入端口：`js/game.js` 里的 `IMAGE_PORT` ★**

它是一个默认为 `null` 的变量，表示「只用预生成图库」。给它赋值一个 async 函数，就切换成运行时生成，其余逻辑（计分、弹窗、缓存、分享）完全不用改：

```js
// js/game.js
IMAGE_PORT = async function (line) {
  showImageLoading();                       // 生成通常要 10–20 秒，务必给加载态
  const url = await callYourImageApi({      // ← 换成真实的图像生成接口
    prompt: buildPaintingPrompt(line),      // 由诗句生成作画提示词（已内置）
    size: '1536x1024',
  });
  return url;                               // 返回可访问的图片地址
};
```

配套的两个函数也已经在 `js/game.js` 里：

- `buildPaintingPrompt(line)` —— 把诗句拼成作画提示词，并显式要求画面**不要出现任何文字**（否则模型经常把诗句写在图上）
- `showHintImage(text, url)` —— 显示图片，并把生成结果**回写进 `window.HINT_IMAGES` 当缓存**，同一句下次点开就是秒出

接入时注意：

1. 生成失败要有降级提示，别让按钮点了没反应；
2. 生成结果记得回写缓存，避免同一句反复消耗额度；
3. 图片提示计入 `hints.image`，计分与成绩分享无需改动。

## 出包与发布（AIWANNA / ai-made.games）

平台的「静态网页」通道要求：文件合计 **≤ 3 MiB、≤ 300 个文件**、必须含 `index.html`，且不接受凭证、source map 或源码目录。用脚本出一份干净产物：

```bash
node tools/build-dist.js                # 不带提示图，约 0.1 MiB（首发推荐）
node tools/build-dist.js --with-images  # 带上 assets/hints 里的提示图
```

产物落在 `dist/`，只含 `index.html` + `css/` + `js/`（带图时再加 `assets/hints/`）。**不带图时图库映射为空，游戏会自动隐藏「看图」按钮**，不会留下点了没反应的死按钮；之后想加回来，用 `--with-images` 重新出包再发一次版本即可。

发布走官方 MCP，**没有网页上传入口**：

```bash
claude mcp add onegp --scope user -- npx --yes github:1gp-studio/publisher-mcp#v0.15.0
```

要求 Node.js ≥ 24、npm、Git 且能访问 GitHub。授权在浏览器完成（凭证存 `~/.config/1gp-studio/`，有效期 90 天），随后由本地 AI 调用 `prepare_game` → `publish_game` → `set_game_details` / `set_game_media` 完成发布。

首发还需要准备：分类（本项目为 `puzzle`）、≤5 个标签、一张 16:9 **无字**主封面、制作信息（AI 工具 / 竖屏 / 一局时长）和至少 3 张真实游戏截图。

## 测试

```bash
npm install jsdom                       # 仅测试需要
node tools/smoke.js                     # 诗词库数据 + 判定算法（含重复字用例）
node tools/dom-smoke.js                 # jsdom 加载真实页面跑完整对局
PW_ROOT=$PWD/dist node tools/dom-smoke.js   # 对 dist 产物跑同一套冒烟
```

`tools/dom-smoke.js` 覆盖：非诗句被拒绝、点字盘输入、翻牌着色、提示计数、胜利弹窗、战绩落盘、模式切换，并对三种诗体各随机 10 局校验「答案一定能用字盘拼出」。

云服务相关的诊断脚本 `tools/check-models.js`、`tools/test-image-model.js` 需要环境变量：

```bash
export WB_PUBLISHABLE_KEY=<publicConfig.publishableKey>
export WB_ENDPOINT=<publicConfig.endpoint>
```

## 说明

诗词文本来自公开的中国古典诗词，为方便教学与娱乐使用；其中个别句子存在版本差异（如「白云生处 / 白云深处」），这里取通行版本。
