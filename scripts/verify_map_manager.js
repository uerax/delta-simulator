/**
 * 三角洲行动 - MapManager 专项回归与接口自动化测试
 */

const assert = require('assert');
const MapManager = require('../miniprogram/utils/mapManager');

console.log('🧪 开始 MapManager 战术地图背景管理器专项测试...\n');

// 1. 初始化与双键索引测试
console.log('▶ [1/6] 测试初始化与 6 大核心战术地图双键检索...');
const maps = MapManager.getAllMaps();
assert.strictEqual(maps.length, 6, '应包含全部 6 大战术地图');

const dabaByKey = MapManager.getMap('daba');
const dabaByName = MapManager.getMap('零号大坝');
assert.ok(dabaByKey, '通过 key 应能检索到零号大坝');
assert.ok(dabaByName, '通过 name 应能检索到零号大坝');
assert.strictEqual(dabaByKey.name, '零号大坝');
assert.strictEqual(dabaByName.key, 'daba');
assert.strictEqual(dabaByKey.tileUrls.length, 16, '每张地图应包含 16 张切片直链');

console.log('  ✔ 6 大地图双键索引与切片完整性校验通过！');

// 2. 随机地图与切片测试
console.log('\n▶ [2/6] 测试随机地图与切片抽取...');
const randomMap = MapManager.getRandomMap();
assert.ok(randomMap && randomMap.key, '应能成功随机抽取地图');

const tileInfo = MapManager.getRandomTile('cgxg');
assert.ok(tileInfo && tileInfo.tileUrl, '指定长弓溪谷应能成功抽取切片');
assert.strictEqual(tileInfo.map.key, 'cgxg');
assert.ok(tileInfo.tileUrl.includes('map_yc'), '切片地址应包含长弓溪谷 layer 标识');
assert.ok(tileInfo.tileIndex >= 0 && tileInfo.tileIndex < 16, '切片索引应在 0~15 之间');

console.log(`  ✔ 长弓溪谷切片测试成功: tileIndex=${tileInfo.tileIndex}, url=${tileInfo.tileUrl}`);

// 3. 对局会话生成测试 (pickSession)
console.log('\n▶ [3/6] 测试开局战术背景会话 (pickSession)...');
const session = MapManager.pickSession({ width: 375, height: 667 });
assert.ok(session, '应成功生成会话');
assert.ok(session.mapName, '会话应包含地图名称');
assert.ok(session.gridCoord, '会话应包含切片网格坐标');
assert.ok(session.gridCoord.x >= 0 && session.gridCoord.x <= 6);
assert.ok(session.gridCoord.y >= 0 && session.gridCoord.y <= 6);
assert.strictEqual(MapManager.getCurrentSession(), session, 'getCurrentSession 应返回当前活动会话');

console.log(`  ✔ 当前会话抽取到: [${session.mapName}] 网格(${session.gridCoord.x}, ${session.gridCoord.y}) 切片=${session.tileUrl}`);

// 4. Mock Canvas 2D 绘制测试 (方案 B 核心)
console.log('\n▶ [4/6] 测试 Canvas 2D drawBackground 绘制与图象缓存...');
const drawCalls = [];
const mockCtx = {
  createLinearGradient: () => ({ addColorStop: () => {} }),
  fillRect: (x, y, w, h) => drawCalls.push({ type: 'fillRect', x, y, w, h }),
  drawImage: (img, sx, sy, sw, sh) => drawCalls.push({ type: 'drawImage', src: img.src }),
  beginPath: () => drawCalls.push({ type: 'beginPath' }),
  moveTo: (x, y) => drawCalls.push({ type: 'moveTo', x, y }),
  lineTo: (x, y) => drawCalls.push({ type: 'lineTo', x, y }),
  stroke: () => drawCalls.push({ type: 'stroke' }),
  save: () => drawCalls.push({ type: 'save' }),
  restore: () => drawCalls.push({ type: 'restore' })
};

let imageCreatedCount = 0;
const mockCanvas = {
  createImage: () => {
    imageCreatedCount++;
    const img = {
      src: '',
      onload: null,
      onerror: null
    };
    // 模拟异步加载
    setTimeout(() => {
      if (img.onload) img.onload();
    }, 10);
    return img;
  }
};

// 首次调用（图片尚未加载）
MapManager.drawBackground(mockCanvas, mockCtx, 375, 667, { showGrid: true, showCrosshair: true });
assert.ok(drawCalls.some(c => c.type === 'fillRect'), '应绘制底色与遮罩');
assert.strictEqual(imageCreatedCount, 4, '应为主动的 2x2 高清切片矩阵创建 4 个 Image 实例');

// 再次调用（同一会话，不应重复创建 Image）
MapManager.drawBackground(mockCanvas, mockCtx, 375, 667);
assert.strictEqual(imageCreatedCount, 4, '同一会话不应重复创建 Image 实例（缓存生效）');

console.log('  ✔ Canvas 2D 绘制管线与图象内存缓存机制验证通过！');

// 5. CSS 样式生成测试 (供 DOM 页面直接调用)
console.log('\n▶ [5/6] 测试 getRandomBackgroundStyle 生成 CSS 字符串...');
const cssStyle = MapManager.getRandomBackgroundStyle({
  mapKey: 'daba',
  maskColor: 'rgba(10, 10, 15, 0.85)'
});
assert.ok(cssStyle.includes('linear-gradient(rgba(10, 10, 15, 0.85)'), 'CSS 应包含暗调渐变遮罩');
assert.ok(cssStyle.includes('background-image:'), 'CSS 应包含 background-image');
assert.ok(cssStyle.includes('game.gtimg.cn'), 'CSS 应包含官方 CDN 图片直链');

console.log(`  ✔ 生成的 CSS 样式样本: ${cssStyle.slice(0, 80)}...`);

// 6. 缓存清理测试
console.log('\n▶ [6/6] 测试 clearCache 内存释放...');
MapManager.clearCache();
assert.strictEqual(MapManager.getCurrentSession(), null, '清理后 session 应为空');
assert.strictEqual(MapManager._imageCache.size, 0, '清理后图片缓存应已清空');

console.log('  ✔ clearCache 资源释放测试通过！');

console.log('\n🎉 MapManager 战术背景管理器全量单测 100% 验证通过！');
