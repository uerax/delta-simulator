/**
 * 道具元数据清单瘦身与纯简体中文规范化脚本
 *
 * 优化项:
 * 1. 移除繁体中文名称与描述，保留并规范为主字段: name, desc
 * 2. 彻底剔除冗余展示字段: nameWithLevel, nameWithRarity, levelName, colorLabel, rarityLabel, rarityFull
 * 3. 彻底剔除繁体/别名字段: name_cn, nameWithLevel_cn, nameWithRarity_cn, desc_cn
 * 4. 对齐三角洲行动国服官方交易行标准简体中文名（345件交易品100%对齐，14件非交易品精准补齐）
 * 5. 基于 OpenCC 权威词典对全部描述与 propsDetail 属性进行深度消歧繁简转换
 * 6. 移除顶层完全重复冗余的 items 数组（与 categories 重复，且缺少价格数据）
 */

const fs = require('fs');
const path = require('path');
const { decodeZhouPack } = require('./lib/zhou_pack_decoder.js');

// 1. 加载本地 OpenCC 权威繁简转换器
const openccPath = path.resolve(__dirname, './lib/opencc.js');
const openccCode = fs.readFileSync(openccPath, 'utf-8');
const ctx = {};
new Function('exports', 'module', openccCode)(ctx, { exports: ctx });
const converter = ctx.Converter({ from: 'tw', to: 'cn' });

// 2. 14件非交易品标准国服简体中文名映射
const NON_TRADABLE_NAMES = {
  15020010033: '火箭燃料',
  15030050013: 'G.T.I.卫星通讯天线',
  15080050069: '高级咖啡豆',
  15080050025: '高级子弹生产零件',
  15080050063: '哈夫克机密档案',
  15090010040: '机械工蜂模型',
  15020010035: '高级燃料',
  15020050004: '陶瓷护甲',
  15020050006: '钛合金',
  15080050024: '中级子弹生产零件',
  15080050070: '三角洲部队：黑鹰坠落(盒装版)',
  15020010025: '高分子布料',
  15020010028: '燃油',
  15020040001: '工具箱'
};

const MANIFEST_PATH = path.resolve(__dirname, '../miniprogram/assets/items/item_manifest.json');
const MARKET_API_URL = 'https://api.wwery.com/api/%E4%BA%A4%E6%98%93%E8%A1%8C%E6%95%B0%E6%8D%AE';

async function fetchMarketNames() {
  try {
    console.log('[1/4] 正在获取交易行官方标准中文名称映射...');
    const res = await fetch(MARKET_API_URL, {
      headers: {
        'Accept': 'application/json, application/x-zhou-pack',
        'Origin': 'https://wwery.com',
        'Referer': 'https://wwery.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const data = await decodeZhouPack(arrayBuffer, MARKET_API_URL);

    const map = new Map();
    if (data && data.data && Array.isArray(data.data.rows)) {
      for (const row of data.data.rows) {
        if (row.object_id && row.name) {
          map.set(String(row.object_id), row.name);
        }
      }
    }
    console.log(`[1/4] 获取成功，建立官方名称映射: ${map.size} 条。`);
    return map;
  } catch (err) {
    console.warn(`[1/4] 获取交易行名称失败 (${err.message})，将使用 OpenCC 规则转换兜底。`);
    return new Map();
  }
}

async function main() {
  const originalSize = fs.statSync(MANIFEST_PATH).size;
  console.log(`[2/4] 读取当前清单文件: ${(originalSize / 1024).toFixed(1)} KB`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const marketMap = await fetchMarketNames();

  console.log('[3/4] 执行纯简体中文规范化与字段精简...');
  let totalProcessed = 0;
  let officialNameMatched = 0;

  for (const cat of Object.values(manifest.categories)) {
    for (const item of cat.list) {
      const idStr = String(item.id);

      // 1. 确定最终简体中文名称
      let simpName = marketMap.get(idStr);
      if (simpName) {
        officialNameMatched++;
      } else if (NON_TRADABLE_NAMES[item.id]) {
        simpName = NON_TRADABLE_NAMES[item.id];
      } else {
        simpName = converter(item.name || item.name_cn || '');
      }

      // 2. 覆盖主字段为规范简体中文
      item.name = simpName;

      // 3. 描述转换为纯正规范简体中文 (优先以繁体原版输入经高质量 OpenCC 转换，避免原 name_cn/desc_cn 残留异体字)
      const rawDesc = item.desc || item.desc_cn || '';
      item.desc = converter(rawDesc);

      // 4. propsDetail 内部字符串转换
      if (item.propsDetail && typeof item.propsDetail === 'object') {
        for (const [pk, pv] of Object.entries(item.propsDetail)) {
          if (typeof pv === 'string') {
            item.propsDetail[pk] = converter(pv);
          }
        }
      }

      // 5. 彻底删除繁体与冗余无用字段
      delete item.name_cn;
      delete item.nameWithLevel_cn;
      delete item.nameWithRarity_cn;
      delete item.desc_cn;
      delete item.nameWithLevel;
      delete item.nameWithRarity;
      delete item.levelName;
      delete item.colorLabel;
      delete item.rarityLabel;
      delete item.rarityFull;
      // 用户指定清理的冗余字段
      delete item.color;
      delete item.rarity;
      delete item.rawId;
      delete item.subClass;
      delete item.grade;

      totalProcessed++;
    }
  }

  // 6. 清理 rarityDefinitions 中的无用展示标签与冗余属性
  if (manifest.rarityDefinitions) {
    for (const def of Object.values(manifest.rarityDefinitions)) {
      delete def.levelName;
      delete def.colorLabel;
      delete def.rarityLabel;
      delete def.rarityFull;
      delete def.color;
      delete def.rarity;
      delete def.iconClass;
    }
  }

  // 7. 移除顶层完全重复且缺少价格维护的 items 数组与重复统计
  delete manifest.items;
  delete manifest.rarityCounts;
  delete manifest.levelCounts;

  console.log('[4/4] 写入精简后的 item_manifest.json...');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  const newSize = fs.statSync(MANIFEST_PATH).size;
  const savedSize = (originalSize - newSize) / 1024;
  const reductionPercent = ((savedSize / (originalSize / 1024)) * 100).toFixed(1);

  console.log('\n=== item_manifest.json 瘦身完成 ===');
  console.log(`- 处理道具总数: ${totalProcessed} 件`);
  console.log(`- 命中官方交易行规范名: ${officialNameMatched} 件`);
  console.log(`- 原始文件大小: ${(originalSize / 1024).toFixed(1)} KB`);
  console.log(`- 优化后大小: ${(newSize / 1024).toFixed(1)} KB`);
  console.log(`- 释放体积: ${savedSize.toFixed(1)} KB (瘦身比例: ${reductionPercent}%)`);
}

main().catch(err => {
  console.error('执行失败:', err);
  process.exit(1);
});
