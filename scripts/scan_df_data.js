const vm = require('vm');
const fs = require('fs');
const path = require('path');

const scripts = [
  'daba_floor.js', 'cgxg_floor.js', 'bks_floor.js', 'cxjy_floor.js', 'az3_floor.js',
  'map_article.js', 'map_cgxg.js', 'map_htjd.js', 'map_bks.js', 'map_cxjy.js',
  'map_gc.js', 'map_jq.js', 'map_pc.js', 'map_ljd.js', 'map_qhz.js', 'map_df.js',
  'map_dg.js', 'map_hdz.js', 'map_jzt.js', 'map_dc.js', 'map_yz.js', 'map_wmsyh.js',
  'map_az3.js', 'map_dsc.js', 'map_dsc2.js', 'map_mgjcq.js'
];

async function main() {
  console.log('1. 拉取官网 CSS 解析图标样式...');
  const cssRes = await fetch('https://game.gtimg.cn/images/dfm/cp/a20240729directory/main.css');
  const cssText = await cssRes.text();

  const classToUrl = new Map();
  const cssRegex = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*background-image:\s*url\(([^)]+)\)[^}]*\}/gi;
  let cssMatch;
  while ((cssMatch = cssRegex.exec(cssText)) !== null) {
    const cls = cssMatch[1];
    let url = cssMatch[2].trim().replace(/['"]/g, '');
    if (url.startsWith('//')) url = 'https:' + url;
    classToUrl.set(cls, url);
  }

  console.log(`已提取 ${classToUrl.size} 个 CSS 背景图片定义。`);

  console.log('2. 拉取官网 JS 数据并初始化执行沙箱...');
  const sandbox = {
    window: {},
    document: { location: { href: 'https://df.qq.com/cp/a20240729directory/' } },
    location: { href: 'https://df.qq.com/cp/a20240729directory/' }
  };
  vm.createContext(sandbox);

  for (const s of scripts) {
    const url = 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/js/lib/' + s;
    const res = await fetch(url);
    const code = await res.text();
    vm.runInContext(code, sandbox);
  }

  // 3. 烽火地带地图与层级提取
  const fenghuoMaps = [
    { key: 'daba', name: '零号大坝', layer: 'map_db', info: sandbox.dabaInfo, navInfo: sandbox.navListInfo, article: sandbox.mapArticle },
    { key: 'cgxg', name: '长弓溪谷', layer: 'map_cgxg', info: sandbox.cgxgInfo, navInfo: sandbox.navListInfo_cgxg, article: sandbox.mapArticle_cgxg },
    { key: 'htjd', name: '航天基地', layer: 'map_htjd', info: sandbox.htjdInfo, navInfo: sandbox.navListInfo_htjd, article: sandbox.mapArticle_htjd },
    { key: 'bks',  name: '巴克什',   layer: 'map_bks',  info: sandbox.bksInfo,  navInfo: sandbox.navListInfo_bks,  article: sandbox.mapArticle_bks },
    { key: 'cxjy', name: '潮汐监狱', layer: 'map_cxjy', info: sandbox.cxjyInfo, navInfo: sandbox.navListInfo_cxjy, article: sandbox.mapArticle_cxjy },
    { key: 'az3',  name: 'AZ3',      layer: 'map_az3',  info: sandbox.az3Info,  navInfo: sandbox.navListInfo_az3,  article: sandbox.mapArticle_az3 }
  ];

  // 4. 统计所有物资定义
  const allItems = new Map(); // name -> { name, lang, iconKey, iconUrl, isBase64, categories: Set, maps: Set }

  fenghuoMaps.forEach(m => {
    if (!m.navInfo) return;
    Object.values(m.navInfo).forEach(category => {
      if (category && category.typeList && Array.isArray(category.typeList)) {
        category.typeList.forEach(item => {
          if (!item.name) return;
          if (!allItems.has(item.name)) {
            const iconKey = item.icon || '';
            const iconUrl = classToUrl.get('img_' + iconKey) || classToUrl.get(iconKey) || classToUrl.get('img_' + iconKey + '_s') || '';
            const isBase64 = iconUrl.startsWith('data:');
            allItems.set(item.name, {
              name: item.name,
              lang: item.lang || '',
              idType: item.idType,
              iconKey: iconKey,
              iconUrl: isBase64 ? '[base64_data_image]' : iconUrl,
              rawIconUrl: iconUrl,
              isBase64: isBase64,
              categories: new Set(),
              maps: new Set()
            });
          }
          const record = allItems.get(item.name);
          if (category.title) record.categories.add(category.title);
          record.maps.add(m.name);
        });
      }
    });
  });

  // 5. 地图底图与瓦片验证
  console.log('3. 验证地图切片连通性...');
  const mapList = [];
  for (const m of fenghuoMaps) {
    const tileTestUrl = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${m.layer}/3_0_0.jpg`;
    let tileOk = false;
    try {
      const tRes = await fetch(tileTestUrl, { method: 'HEAD' });
      tileOk = (tRes.status === 200);
    } catch (e) {
      tileOk = false;
    }

    const floors = (m.info && m.info.floor) ? m.info.floor.map(f => ({
      floor_f: f.floor_f,
      floor_name: f.floor_name
    })) : [];

    mapList.push({
      key: m.key,
      name: m.name,
      layer: m.layer,
      tileUrlTemplate: `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${m.layer}/{z}_{x}_{y}.jpg`,
      tileValid: tileOk,
      width: m.info?.width,
      height: m.info?.height,
      minZoom: m.info?.minZoom,
      initZoom: m.info?.initZoom,
      floors: floors,
      pointCount: m.article ? m.article.length : 0
    });
  }

  // 6. 全面战场地图
  const warMaps = [
    { key: 'pc', name: '攀升', layer: 'map_pc' },
    { key: 'ljd', name: '临界点', layer: 'map_ljd' },
    { key: 'gc', name: '贯穿', layer: 'map_gc' },
    { key: 'jq', name: '烬区', layer: 'map_jq' },
    { key: 'qhz', name: '堑壕战', layer: 'map_qhz' },
    { key: 'df', name: '刀锋', layer: 'map_df' },
    { key: 'dg', name: '断轨', layer: 'map_dg' },
    { key: 'hdz', name: '风暴眼', layer: 'map_hdz' },
    { key: 'jzt', name: '金字塔', layer: 'map_jzt' },
    { key: 'dc', name: '断层', layer: 'map_dc' },
    { key: 'yz', name: '余震', layer: 'map_yz' },
    { key: 'wmsyh', name: '乌姆斯运河', layer: 'map_wmsyh' },
    { key: 'dsc', name: '克劳狄斗兽场', layer: 'map_dsc' },
    { key: 'mgjcq', name: '摩格旧城区', layer: 'map_mgjcq' }
  ];

  const warList = [];
  for (const w of warMaps) {
    const tileTestUrl = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${w.layer}/3_0_0.jpg`;
    let tileOk = false;
    try {
      const tRes = await fetch(tileTestUrl, { method: 'HEAD' });
      tileOk = (tRes.status === 200);
    } catch (e) {}
    warList.push({
      ...w,
      tileUrlTemplate: `https://game.gtimg.cn/images/dfm/cp/a20240729directory/img/${w.layer}/{z}_{x}_{y}.jpg`,
      tileValid: tileOk
    });
  }

  // 输出报告
  const itemsArray = Array.from(allItems.values()).map(it => ({
    name: it.name,
    iconKey: it.iconKey,
    iconUrl: it.iconUrl,
    isBase64: it.isBase64,
    categories: Array.from(it.categories),
    maps: Array.from(it.maps)
  }));

  const finalReport = {
    summary: {
      fenghuoMapCount: mapList.length,
      warMapCount: warList.length,
      totalItemTypes: itemsArray.length,
      base64IconCount: itemsArray.filter(i => i.isBase64).length,
      pngIconCount: itemsArray.filter(i => !i.isBase64 && i.iconUrl).length
    },
    fenghuoMaps: mapList,
    warMaps: warList,
    items: itemsArray
  };

  fs.writeFileSync(path.join(__dirname, 'df_scan_summary.json'), JSON.stringify(finalReport, null, 2), 'utf-8');
  console.log('\n=================== 扫描完成 ===================');
  console.log(`烽火地带地图: ${mapList.length} 张`);
  console.log(`全面战场地图: ${warList.length} 张`);
  console.log(`独立物资/交互物总类: ${itemsArray.length} 种`);
  console.log(`其中独立 PNG 图标: ${finalReport.summary.pngIconCount} 个, Base64 内联图标: ${finalReport.summary.base64IconCount} 个`);
  console.log('详细 JSON 摘要已保存至 scripts/df_scan_summary.json');
}

main().catch(err => console.error(err));
