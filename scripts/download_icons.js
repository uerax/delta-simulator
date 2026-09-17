const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.resolve(__dirname, '../miniprogram/assets/icons');

const CATEGORY_MAP = {
  // 出生点
  nav_csd: 'spawns',

  // 撤离点
  nav_cgcld: 'extractions',
  nav_ffcld: 'extractions',
  nav_tjcld: 'extractions',
  nav_sjcld: 'extractions',
  nav_glcld: 'extractions',
  nav_dtcld: 'extractions',
  nav_lccld: 'extractions',
  nav_hjcld: 'extractions',
  nav_yscld: 'extractions',

  // 任务与接取站
  nav_xdjqz: 'tasks',
  nav_xdjqzgjz: 'tasks',

  // 首领 Boss
  nav_boss: 'bosses',

  // 特种 / 辐射设施
  nav_tkmkmb: 'facilities',
  nav_fsxcwx: 'facilities',
  nav_fsflx: 'facilities',
  nav_hrlbb: 'facilities',
  nav_gyjscwx: 'facilities',
  nav_pbx: 'facilities',
  nav_flt: 'facilities',
  nav_frldt: 'facilities',
  nav_rlcg: 'facilities',
  nav_yjc: 'facilities',
  nav_fxkzz: 'facilities',
  nav_fydjz: 'facilities',
  nav_ypbwx: 'facilities',
  nav_wsjhq: 'facilities'
  // 其余未显式列出的默认归入 'containers'
};

const CATEGORY_META = {
  containers: { name: '物资与搜集容器', folder: 'containers' },
  spawns: { name: '出生点', folder: 'spawns' },
  extractions: { name: '撤离点', folder: 'extractions' },
  tasks: { name: '任务与接取站', folder: 'tasks' },
  bosses: { name: '首领Boss', folder: 'bosses' },
  facilities: { name: '特种与辐射设施', folder: 'facilities' }
};

const scripts = [
  'daba_floor.js', 'cgxg_floor.js', 'bks_floor.js', 'cxjy_floor.js', 'az3_floor.js',
  'map_article.js', 'map_cgxg.js', 'map_htjd.js', 'map_bks.js', 'map_cxjy.js', 'map_az3.js'
];

async function main() {
  console.log('--- 1. 初始化分类子目录 ---');
  Object.values(CATEGORY_META).forEach(meta => {
    const subDir = path.join(baseDir, meta.folder);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
  });

  console.log('--- 2. 解析 CSS 背景图与 Base64 ---');
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

  console.log('--- 3. 沙箱加载烽火地带地图配置 ---');
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

  const fenghuoMaps = [
    { name: '零号大坝', navInfo: sandbox.navListInfo },
    { name: '长弓溪谷', navInfo: sandbox.navListInfo_cgxg },
    { name: '航天基地', navInfo: sandbox.navListInfo_htjd },
    { name: '巴克什',   navInfo: sandbox.navListInfo_bks },
    { name: '潮汐监狱', navInfo: sandbox.navListInfo_cxjy },
    { name: 'AZ3',      navInfo: sandbox.navListInfo_az3 }
  ];

  const itemsMap = new Map();

  fenghuoMaps.forEach(m => {
    if (!m.navInfo) return;
    Object.values(m.navInfo).forEach(category => {
      if (category && category.typeList && Array.isArray(category.typeList)) {
        category.typeList.forEach(item => {
          if (!item.name || !item.icon) return;
          const iconKey = item.icon;
          if (!itemsMap.has(iconKey)) {
            let imgSource = classToUrl.get('img_' + iconKey) ||
                            classToUrl.get(iconKey) ||
                            classToUrl.get('img_' + iconKey + '_s') ||
                            '';

            if (!imgSource && !imgSource.startsWith('data:')) {
              imgSource = `https://game.gtimg.cn/images/dfm/cp/a20240729directory/${iconKey.replace('nav_', '')}.png`;
            }

            const catKey = CATEGORY_MAP[iconKey] || 'containers';

            itemsMap.set(iconKey, {
              iconKey: iconKey,
              name: item.name,
              categoryKey: catKey,
              categoryName: CATEGORY_META[catKey].name,
              sourceUrl: imgSource,
              maps: new Set([m.name])
            });
          } else {
            itemsMap.get(iconKey).maps.add(m.name);
          }
        });
      }
    });
  });

  console.log(`--- 4. 按类别落盘 ${itemsMap.size} 个图标 ---`);
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalIcons: itemsMap.size,
    categories: {},
    items: []
  };

  Object.keys(CATEGORY_META).forEach(k => {
    manifest.categories[k] = {
      name: CATEGORY_META[k].name,
      folder: CATEGORY_META[k].folder,
      count: 0,
      list: []
    };
  });

  for (const item of itemsMap.values()) {
    const subFolder = CATEGORY_META[item.categoryKey].folder;
    const fileName = `${item.iconKey}.png`;
    const destPath = path.join(baseDir, subFolder, fileName);
    const localRelPath = `/assets/icons/${subFolder}/${fileName}`;

    let buffer;
    if (item.sourceUrl.startsWith('data:image/png;base64,')) {
      const base64Str = item.sourceUrl.replace(/^data:image\/png;base64,/, '');
      buffer = Buffer.from(base64Str, 'base64');
    } else if (item.sourceUrl.startsWith('http')) {
      const res = await fetch(item.sourceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    }

    fs.writeFileSync(destPath, buffer);
    console.log(`[${item.categoryName}] ${item.name} -> ${subFolder}/${fileName} (${buffer.length} B)`);

    const record = {
      name: item.name,
      iconKey: item.iconKey,
      categoryKey: item.categoryKey,
      categoryName: item.categoryName,
      fileName: fileName,
      path: localRelPath,
      maps: Array.from(item.maps)
    };

    manifest.items.push(record);
    manifest.categories[item.categoryKey].list.push(record);
    manifest.categories[item.categoryKey].count++;
  }

  // 5. 清理原先在 baseDir 根目录下的散落 png 文件
  console.log('--- 5. 清理根目录下的旧平铺文件 ---');
  const rootFiles = fs.readdirSync(baseDir);
  let cleanedCount = 0;
  rootFiles.forEach(f => {
    const full = path.join(baseDir, f);
    if (fs.statSync(full).isFile() && f.endsWith('.png')) {
      fs.unlinkSync(full);
      cleanedCount++;
    }
  });
  console.log(`已清理根目录下散落的 ${cleanedCount} 个平铺旧 PNG 文件`);

  // 6. 保存清单文件
  const manifestPath = path.resolve(__dirname, 'data/icons/icon_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`已更新分类索引文件: ${manifestPath}`);

  console.log('\n=================== 重构完成 ===================');
  Object.entries(manifest.categories).forEach(([k, v]) => {
    console.log(`- ${v.name} (${k}): ${v.count} 个图标 -> /assets/icons/${v.folder}/`);
  });
}

main().catch(err => console.error('处理出错:', err));
