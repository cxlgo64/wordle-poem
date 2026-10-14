/* 验证云服务模型列表：找图像生成模型 */
const { createWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk');

// 凭证走环境变量，避免写进仓库：
//   export WB_PUBLISHABLE_KEY=xxxx  export WB_ENDPOINT=https://xxx.app.workbuddy.host
const ENDPOINT = process.env.WB_ENDPOINT || 'https://poetry-wordle.app.workbuddy.host';
const KEY = process.env.WB_PUBLISHABLE_KEY || '';
if (!KEY) { console.log('请先 export WB_PUBLISHABLE_KEY=<publicConfig.publishableKey>'); process.exit(1); }

(async () => {
  const cloud = createWorkBuddyCloud({ endpoint: ENDPOINT, publishableKey: KEY });
  try {
    const models = await cloud.llm.models.list();
    console.log('模型总数:', models.length);
    models.forEach(m => {
      console.log(`- ${m.id} | name=${m.name} | img_in=${m.supportsImages} | tool=${m.supportsToolCall} | disabled=${m.disabled}${m.description ? ' | ' + String(m.description).slice(0, 60) : ''}`);
    });
    const maybeImg = models.filter(m => /image|flux|dall|sd|diffusion|draw|paint|ban|cogview|seedream|kolors|qwen-image/i.test(m.id + ' ' + (m.name || '') + ' ' + (m.description || '')));
    console.log('\n疑似图像生成模型:', maybeImg.map(m => m.id).join(', ') || '无');
  } catch (e) {
    console.log('models.list 失败:', e && e.error ? e.error.code + ' ' + e.error.message : e.message);
    if (e && e.requestId) console.log('requestId:', e.requestId);
  }
})();
