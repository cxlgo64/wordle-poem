/* 最后几种参数组合 */
const { createWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk');

// 凭证走环境变量，避免写进仓库：export WB_PUBLISHABLE_KEY=xxxx
const ENDPOINT = process.env.WB_ENDPOINT || 'https://poetry-wordle.app.workbuddy.host';
const KEY = process.env.WB_PUBLISHABLE_KEY || '';
if (!KEY) { console.log('请先 export WB_PUBLISHABLE_KEY=<publicConfig.publishableKey>'); process.exit(1); }
const cloud = createWorkBuddyCloud({ endpoint: ENDPOINT, publishableKey: KEY });

const VARIANTS = [
  { name: 'D: modalities', opts: { modalities: ['text', 'image'], messages: [{ role: 'user', content: '画：水墨山水' }] } },
  { name: 'E: max_tokens', opts: { max_tokens: 1024, messages: [{ role: 'user', content: '画：水墨山水' }] } },
  { name: 'F: n=1', opts: { n: 1, messages: [{ role: 'user', content: '画：水墨山水' }] } },
  { name: 'G: 数组content', opts: { messages: [{ role: 'user', content: [{ type: 'text', text: '画：水墨山水' }] }] } },
];

(async () => {
  for (const v of VARIANTS) {
    try {
      let full = '';
      for await (const chunk of cloud.llm.chat.completions.create({
        model: 'hunyuan-image-alpha', stream: true, ...v.opts,
      })) {
        full += chunk.choices[0]?.delta?.content || '';
      }
      console.log(`✅ ${v.name} — len=${full.length}`);
      console.log('   ', full.slice(0, 300));
      return;
    } catch (e) {
      console.log(`❌ ${v.name} —`, e && e.error ? e.error.code + ': ' + e.error.message : e.message);
    }
  }
  // 对照：用一个文本模型确认链路本身是通的
  try {
    let full = '';
    for await (const chunk of cloud.llm.chat.completions.create({
      model: 'glm-5.3-flash', stream: true,
      messages: [{ role: 'system', content: 'You are helpful.' }, { role: 'user', content: '回复"通了"两个字' }],
    })) full += chunk.choices[0]?.delta?.content || '';
    console.log('链路对照（文本模型）: ✅', full.trim().slice(0, 40));
  } catch (e) {
    console.log('链路对照失败:', e && e.error ? e.error.code : e.message);
  }
})();
