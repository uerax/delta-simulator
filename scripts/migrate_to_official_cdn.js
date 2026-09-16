/**
 * 迁移本地资产至国内官方已备案 CDN，并将本地爬取的大体积图片转移至备用目录 assets_backup
 * 方案二：将原本本地索引字段统一重命名为 backupPath，指向 /assets_backup/... 留存溯源备用
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MINIPROGRAM_DIR = path.join(ROOT_DIR, 'miniprogram');
const BACKUP_DIR = path.join(ROOT_DIR, 'assets_backup');

// 1. 更新道具清单 item_manifest.json
async function updateItemManifest() {
  console.log('--- 1. 更新 item_manifest.json 官方 CDN 链接与 backupPath ---');
  const manifestPath = path.join(MINIPROGRAM_DIR, 'assets/items/item_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let count = 0;
  for (const cat of Object.values(manifest.categories)) {
    for (const item of cat.list) {
      item.remotePicUrl = `https://playerhub.df.qq.com/playerhub/60004/object/${item.id}.png`;
      item.remoteThumbUrl = `https://playerhub.df.qq.com/playerhub/60004/object/p_${item.id}.png`;
      if (item.localPicPath) {
        item.backupPath = item.localPicPath.replace(/^\/assets\//, '/assets_backup/');
        delete item.localPicPath;
      }
      count++;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`已成功将全量 ${count} 件道具的图片链接更新至国内官方 CDN，并将索引更名为 backupPath`);
}

// 2. 更新图标清单 icon_manifest.json
async function updateIconManifest() {
  console.log('--- 2. 更新 icon_manifest.json 官方 CDN / Base64 链接与 backupPath ---');
  const manifestPath = path.join(MINIPROGRAM_DIR, 'assets/icons/icon_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // 获取官方 main.css 中的图标映射
  const cssRes = await fetch('https://game.gtimg.cn/images/dfm/cp/a20240729directory/main.css');
  const cssText = await cssRes.text();
  const cssRegex = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*background-image:\s*url\(([^)]+)\)[^}]*\}/gi;
  let match;
  const classToUrl = new Map();
  while ((match = cssRegex.exec(cssText)) !== null) {
    const cls = match[1];
    let url = match[2].trim().replace(/['"]/g, '');
    if (url.startsWith('//')) url = 'https:' + url;
    classToUrl.set(cls, url);
  }

  function resolveIconUrl(iconKey) {
    let url = classToUrl.get('img_' + iconKey) || classToUrl.get(iconKey) || classToUrl.get('img_' + iconKey + '_s') || '';
    if (!url && !url.startsWith('data:')) {
      url = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/${iconKey.replace('nav_', '')}.png`;
    }
    return url;
  }

  let httpCount = 0, b64Count = 0;
  for (const cat of Object.values(manifest.categories)) {
    for (const item of cat.list) {
      const url = resolveIconUrl(item.iconKey);
      item.remoteUrl = url;
      if (item.path) {
        item.backupPath = item.path.replace(/^\/assets\//, '/assets_backup/');
        delete item.path;
      }
      if (url.startsWith('data:')) b64Count++;
      else httpCount++;
    }
  }

  if (manifest.items && Array.isArray(manifest.items)) {
    for (const item of manifest.items) {
      item.remoteUrl = resolveIconUrl(item.iconKey);
      if (item.path) {
        item.backupPath = item.path.replace(/^\/assets\//, '/assets_backup/');
        delete item.path;
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`已成功为全量 57 个图标补充 remoteUrl 与 backupPath (HTTP CDN: ${httpCount}个, 官方Base64: ${b64Count}个)`);
}

// 3. 更新地图清单 map_manifest.json
async function updateMapManifest() {
  console.log('--- 3. 更新 map_manifest.json 官方 CDN 瓦片切片链接与 backupPath ---');
  const manifestPath = path.join(MINIPROGRAM_DIR, 'assets/maps/map_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  for (const m of manifest) {
    m.tileUrlTemplate = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${m.layer}/{z}_{x}_{y}.jpg`;
    m.previewTileUrl = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${m.layer}/2_0_0.jpg`;
    m.tileUrls = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        m.tileUrls.push(`https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${m.layer}/2_${x}_${y}.jpg`);
      }
    }
    if (m.path) {
      m.backupPath = m.path.replace(/^\/assets\//, '/assets_backup/');
      delete m.path;
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`已成功为 6 大战术地图补充官方瓦片模版、16 切片 CDN 链接及 backupPath`);
}

// 4. 转移图片文件到 assets_backup
function moveImagesToBackup() {
  console.log('--- 4. 迁移本地图片至 assets_backup ---');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const itemsSrc = path.join(MINIPROGRAM_DIR, 'assets/items');
  const iconsSrc = path.join(MINIPROGRAM_DIR, 'assets/icons');
  const mapsSrc = path.join(MINIPROGRAM_DIR, 'assets/maps');

  const itemsDest = path.join(BACKUP_DIR, 'items');
  const iconsDest = path.join(BACKUP_DIR, 'icons');
  const mapsDest = path.join(BACKUP_DIR, 'maps');

  function moveDirFiles(srcDir, destDir, extFilter) {
    if (!fs.existsSync(srcDir)) return 0;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    let moved = 0;
    for (const f of fs.readdirSync(srcDir)) {
      const srcFile = path.join(srcDir, f);
      const destFile = path.join(destDir, f);
      const stat = fs.statSync(srcFile);
      if (stat.isDirectory()) {
        moved += moveDirFiles(srcFile, destFile, extFilter);
        // 如果子目录空了，清理空目录
        try {
          if (fs.readdirSync(srcFile).length === 0) {
            fs.rmdirSync(srcFile);
          }
        } catch (e) {}
      } else if (extFilter(f)) {
        fs.renameSync(srcFile, destFile);
        moved++;
      }
    }
    return moved;
  }

  const itemsMoved = moveDirFiles(itemsSrc, itemsDest, f => f.endsWith('.png'));
  const iconsMoved = moveDirFiles(iconsSrc, iconsDest, f => f.endsWith('.png'));
  const mapsMoved = moveDirFiles(mapsSrc, mapsDest, f => f.endsWith('.jpg'));

  console.log(`已成功迁移图片文件: 道具 ${itemsMoved} 个, 图标 ${iconsMoved} 个, 地图 ${mapsMoved} 个, 共计 ${itemsMoved + iconsMoved + mapsMoved} 个文件。`);
}

async function runAll(onlyManifests = false) {
  await updateItemManifest();
  await updateIconManifest();
  await updateMapManifest();
  if (!onlyManifests) {
    moveImagesToBackup();
  }
  console.log('\n=== 全量迁移与规范化完成！===');
}

module.exports = {
  updateItemManifest,
  updateIconManifest,
  updateMapManifest,
  moveImagesToBackup,
  runAll
};

if (require.main === module) {
  const onlyManifests = process.argv.includes('--manifests-only');
  runAll(onlyManifests).catch(console.error);
}
