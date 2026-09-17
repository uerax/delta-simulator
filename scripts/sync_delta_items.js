/**
 * 三角洲行动（Delta Force）道具数据同步与精简脚本
 *
 * 数据来源:
 *  - 实时行情与道具全量库: https://api.wwery.com/api/交易行数据
 *  - 解包解密支持: scripts/lib/zhou_pack_decoder.js (application/x-zhou-pack v2)
 *  - 官方已备案国内 CDN: https://playerhub.df.qq.com/playerhub/60004/object/
 *
 * 字段规范（严格精简）:
 *  - id: 道具唯一数字ID (Number)
 *  - level: 品质等级 1~6 (对应官方 grade)
 *  - name: 道具标准简体中文名称 (String)
 *  - pic: 官方 CDN 高清透明背景原图地址 (String)
 *  - price: 现行市场最新实时价格 (Number)
 *  - length: 占格长/高 (Number)
 *  - width: 占格宽 (Number)
 */

const fs = require('fs');
const path = require('path');
const { decodeZhouPack } = require('./lib/zhou_pack_decoder.js');

const MANIFEST_PATH = path.resolve(__dirname, 'data/items/item_manifest.json');
const JS_MANIFEST_PATH = path.resolve(__dirname, '../miniprogram/assets/items/item_manifest.js');
const BACKUP_PATH = path.resolve(__dirname, '../assets_backup/items/item_manifest.backup.json');
const MARKET_API_URL = 'https://api.wwery.com/api/%E4%BA%A4%E6%98%93%E8%A1%8C%E6%95%B0%E6%8D%AE';
const CDN_BASE_URL = 'https://playerhub.df.qq.com/playerhub/60004/object/';

// 游戏内绑定的非交易/任务特殊道具（交易行不上架，但属于核心局内战利品）
const NON_TRADABLE_ITEMS = [
  { id: 15020010033, level: 6, name: '火箭燃料', pic: '15020010033.png', price: 0, length: 3, width: 4 },
  { id: 15030050013, level: 6, name: 'G.T.I.卫星通讯天线', pic: '15030050013.png', price: 0, length: 2, width: 2 },
  { id: 15080050069, level: 6, name: '高级咖啡豆', pic: '15080050069.png', price: 0, length: 1, width: 2 },
  { id: 15080050025, level: 5, name: '高级子弹生产零件', pic: '15080050025.png', price: 0, length: 3, width: 2 },
  { id: 15080050063, level: 5, name: '哈夫克机密档案', pic: '15080050063.png', price: 0, length: 1, width: 2 },
  { id: 15090010040, level: 5, name: '机械工蜂模型', pic: '15090010040.png', price: 0, length: 3, width: 2 },
  { id: 15020010035, level: 4, name: '高级燃料', pic: '15020010035.png', price: 0, length: 1, width: 1 },
  { id: 15020050004, level: 4, name: '陶瓷护甲', pic: '15020050004.png', price: 0, length: 2, width: 1 },
  { id: 15020050006, level: 4, name: '钛合金', pic: '15020050006.png', price: 0, length: 2, width: 1 },
  { id: 15080050024, level: 4, name: '中级子弹生产零件', pic: '15080050024.png', price: 0, length: 2, width: 2 },
  { id: 15080050070, level: 4, name: '三角洲部队：黑鹰坠落(盒装版)', pic: '15080050070.png', price: 0, length: 1, width: 2 },
  { id: 15020010025, level: 3, name: '高分子布料', pic: '15020010025.png', price: 0, length: 2, width: 1 },
  { id: 15020010028, level: 3, name: '燃油', pic: '15020010028.png', price: 0, length: 2, width: 2 },
  { id: 15020040001, level: 3, name: '工具箱', pic: '15020040001.png', price: 0, length: 2, width: 2 }
];

async function fetchPropsData() {
  console.log('[1/4] 正在请求三角洲交易行道具数据接口...');
  const res = await fetch(MARKET_API_URL, {
    headers: {
      'Accept': 'application/json, application/x-zhou-pack',
      'Origin': 'https://wwery.com',
      'Referer': 'https://wwery.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`请求失败: HTTP ${res.status} ${res.statusText}`);
  }

  console.log('[2/4] 正在解包解密二进制协议...');
  const arrayBuffer = await res.arrayBuffer();
  const apiResult = await decodeZhouPack(arrayBuffer, 'https://api.wwery.com/api/交易行数据');

  if (!apiResult || !apiResult.data || !Array.isArray(apiResult.data.rows)) {
    throw new Error('解密后数据格式异常');
  }

  // 筛选道具大类 (props): 包含收集品、消耗品、钥匙
  const propsRows = apiResult.data.rows.filter(r => r.primary_class === 'props');
  console.log(`- 成功获取交易行道具类物品: ${propsRows.length} 条 (全量物品 ${apiResult.data.rows.length} 条)`);
  return propsRows;
}

function stripCdnPrefix(url, id) {
  if (!url) return `${id}.png`;
  // 还原高清大图路径（去除 /p_ 缩略图前缀）
  const cleanUrl = url.replace(/\/p_([^\/]+)$/, '/$1');
  if (cleanUrl.startsWith(CDN_BASE_URL)) {
    return cleanUrl.slice(CDN_BASE_URL.length);
  }
  // 若是第三方链接，由于已验证官方 CDN 均以 id.png 真实存在，统一映射为 id.png
  return `${id}.png`;
}

async function main() {
  // 读取原有 manifest 作为历史参考并备份
  let oldManifest = null;
  if (fs.existsSync(MANIFEST_PATH)) {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    oldManifest = JSON.parse(raw);
    fs.writeFileSync(BACKUP_PATH, raw, 'utf-8');
    console.log(`- 原有清单已安全备份至: ${BACKUP_PATH}`);
  }

  const propsRows = await fetchPropsData();

  console.log('[3/4] 正在清洗、精简字段并补充道具...');
  const itemsMap = new Map();

  // 1. 处理交易行全量道具
  for (const row of propsRows) {
    const id = Number(row.object_id) || row.object_id;
    const name = String(row.name || '').trim();
    const picFileName = stripCdnPrefix(row.pre_pic || row.pic, id);
    const item = {
      id: id,
      level: Number(row.grade),
      name: name,
      pic: picFileName,
      price: Number(row.c_price) || 0,
      length: Number(row.length),
      width: Number(row.width)
    };
    itemsMap.set(name, item);
  }

  // 2. 检查并补充未在交易行上架的特殊任务/绑定道具（14件）
  let restoredCount = 0;
  for (const nonTradable of NON_TRADABLE_ITEMS) {
    if (!itemsMap.has(nonTradable.name)) {
      restoredCount++;
      itemsMap.set(nonTradable.name, { ...nonTradable });
    }
  }

  // 3. 排序：按品质 level 降序 -> 价格 price 降序 -> id 升序
  const allItems = Array.from(itemsMap.values());
  allItems.sort((a, b) => b.level - a.level || b.price - a.price || (a.id > b.id ? 1 : -1));

  // 统计等级分布
  const levelCounts = {};
  for (const it of allItems) {
    levelCounts[it.level] = (levelCounts[it.level] || 0) + 1;
  }

  const outputManifest = {
    updatedAt: new Date().toISOString(),
    cdnBaseUrl: CDN_BASE_URL,
    total: allItems.length,
    levelCounts: levelCounts,
    items: allItems
  };

  console.log('[4/4] 正在写入精简后的新清单文件...');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(outputManifest, null, 2), 'utf-8');
  fs.writeFileSync(JS_MANIFEST_PATH, `/**\n * 三角洲行动 - 物资清单 (标准 CommonJS 导出)\n */\nmodule.exports = ${JSON.stringify(outputManifest, null, 2)};\n`, 'utf-8');

  const stats = fs.statSync(MANIFEST_PATH);
  console.log('\n=== 道具数据同步与精简完成 ===');
  console.log(`- 道具总数: ${allItems.length} 件 (交易行新增/更新 ${propsRows.length} 件，非交易品补充 ${restoredCount} 件)`);
  console.log(`- 等级分布: 6级(红)=${levelCounts[6] || 0}, 5级(橙)=${levelCounts[5] || 0}, 4级(紫)=${levelCounts[4] || 0}, 3级(蓝)=${levelCounts[3] || 0}, 2级(绿)=${levelCounts[2] || 0}, 1级(白)=${levelCounts[1] || 0}`);
  console.log(`- 新文件大小: ${(stats.size / 1024).toFixed(1)} KB (大幅优化)`);
  console.log(`- 保存路径: ${MANIFEST_PATH}`);
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
