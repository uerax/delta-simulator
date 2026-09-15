/**
 * 三角洲行动（Delta Force）道具市场价格同步脚本
 *
 * 数据来源:
 *  - 行情站点: https://wwery.com/market
 *  - 实时行情接口: https://api.wwery.com/api/交易行数据
 *  - 解密支持: scripts/lib/zhou_pack_decoder.js (application/x-zhou-pack v2)
 *
 * 写入字段说明:
 *  - price: 现行市场价格（数值，非交易品为 0）
 *  - priceFormatted: 格式化价格文本（如 "455,560"，非交易品为 "非交易品"）
 *  - pricePerGrid: 单格价值（数值，总价 / 占用格子数）
 *  - pricePerGridFormatted: 格式化单格价值文本（如 "113,890"，非交易品为 "非交易品"）
 *  - isTradable: 是否可在交易行交易（布尔值 true/false）
 */

const fs = require('fs');
const path = require('path');
const { decodeZhouPack } = require('./lib/zhou_pack_decoder.js');

const MANIFEST_PATH = path.resolve(__dirname, '../miniprogram/assets/items/item_manifest.json');
const MARKET_API_URL = 'https://api.wwery.com/api/%E4%BA%A4%E6%98%93%E8%A1%8C%E6%95%B0%E6%8D%AE';

async function fetchMarketData() {
  console.log('[1/3] 正在请求交易行行情接口...');
  const res = await fetch(MARKET_API_URL, {
    headers: {
      'Accept': 'application/json, application/x-zhou-pack',
      'Origin': 'https://wwery.com',
      'Referer': 'https://wwery.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`行情接口请求失败: HTTP ${res.status} ${res.statusText}`);
  }

  console.log('[2/3] 接口响应成功, 正在解包解密...');
  const arrayBuffer = await res.arrayBuffer();
  const apiResult = await decodeZhouPack(arrayBuffer, 'https://api.wwery.com/api/交易行数据');

  if (!apiResult || !apiResult.data || !Array.isArray(apiResult.data.rows)) {
    throw new Error('解包后数据结构不符合预期');
  }

  console.log(`[2/3] 解密成功，获得交易行物品记录 ${apiResult.data.rows.length} 条。`);
  return apiResult.data.rows;
}

async function main() {
  const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  const marketRows = await fetchMarketData();

  // 构建行情映射索引 (按 object_id 和 物品名)
  const marketById = new Map();
  const marketByName = new Map();
  for (const row of marketRows) {
    if (row.object_id) {
      marketById.set(String(row.object_id), row);
    }
    if (row.name) {
      marketByName.set(row.name, row);
    }
  }

  console.log('[3/3] 正在写入核心价格数据并清理无关冗余字段...');
  let matchedCount = 0;
  let nonTradableCount = 0;

  for (const catObj of Object.values(manifest.categories)) {
    for (const item of catObj.list) {
      // 清理不需要的波动和时间字段
      delete item.priceChangeToday;
      delete item.priceChangeTodayPercent;
      delete item.priceChangeWeek;
      delete item.priceChangeWeekPercent;
      delete item.priceChangeMonth;
      delete item.priceChangeMonthPercent;
      delete item.marketUpdatedAt;
      delete item.marketStatus;
      delete item.priceUnit;

      const idStr = String(item.id);
      const marketRow = marketById.get(idStr) || marketByName.get(item.name);
      const gridCount = item.totalGrid || (item.width * item.length) || 1;

      if (marketRow) {
        matchedCount++;
        const price = Number(marketRow.c_price) || 0;
        const pricePerGrid = Math.round(price / gridCount);

        item.price = price;
        item.priceFormatted = price.toLocaleString('zh-CN');
        item.pricePerGrid = pricePerGrid;
        item.pricePerGridFormatted = pricePerGrid.toLocaleString('zh-CN');
        item.isTradable = true;
      } else {
        nonTradableCount++;
        item.price = 0;
        item.priceFormatted = '非交易品';
        item.pricePerGrid = 0;
        item.pricePerGridFormatted = '非交易品';
        item.isTradable = false;
      }
    }
  }

  // 移除根目录不需要的复杂摘要与重复 items 数组，保持文件干净轻量
  delete manifest.marketSummary;
  delete manifest.items;

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n=== 价格写入完成 ===');
  console.log(`总道具数: ${manifest.totalItems}`);
  console.log(`成功写入价格（可交易品）: ${matchedCount} 件`);
  console.log(`标记为非交易品: ${nonTradableCount} 件`);
  console.log(`已成功移除: priceChangeToday, priceChangeWeek, priceChangeMonth, marketUpdatedAt 及其 Percent 字段。`);
}

main().catch(err => {
  console.error('更新价格失败:', err);
  process.exit(1);
});
