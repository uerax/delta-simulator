const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'raw_supplies.html'), 'utf8');
const blocks = rawHtml.split(/(?=<div class="nav-list-item\s)/).filter(b => b.includes('data-name='));

const cdnBase = 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/lv3/';
const itemsMap = new Map();

blocks.forEach(block => {
  const headerMatch = block.match(/<div class="([^"]*nav-list-item[^"]*)"[^>]*data-name="([^"]*)"/);
  if (!headerMatch) return;
  const fullClass = headerMatch[1];
  const name = headerMatch[2];

  let color = '';
  if (fullClass.includes(' red ')) color = 'red';
  else if (fullClass.includes(' orange ')) color = 'orange';

  const imgMatch = block.match(/<img src="([^"]+)"/);
  const iconUrl = imgMatch ? imgMatch[1] : '';
  const pic = iconUrl.split('/').pop() || '';

  if (!itemsMap.has(name)) {
    const item = { name, pic };
    if (color) item.color = color;
    itemsMap.set(name, item);
  }
});

const items = [...itemsMap.values()];

const manifestData = {
  updatedAt: new Date().toISOString(),
  cdnBaseUrl: cdnBase,
  total: items.length,
  items: items
};

// 1. JSON 备份
const dataDir = path.join(__dirname, 'data', 'supplies');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
fs.writeFileSync(path.join(dataDir, 'supply_manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');

// 2. JS 文件
const assetsDir = path.join(__dirname, '..', 'miniprogram', 'assets', 'supplies');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const jsContent = `/**
 * 三角洲行动 - 47 件官方战区物资清单 (标准 CommonJS 导出)
 */
module.exports = ${JSON.stringify(manifestData, null, 2)};
`;

fs.writeFileSync(path.join(assetsDir, 'supply_manifest.js'), jsContent, 'utf8');
console.log(`Successfully generated supply_manifest with ${items.length} unique items.`);
