/**
 * 三角洲行动（Delta Force）官方百科物资道具爬虫
 * 目标页面: https://www.playdeltaforce.com/act/officialwiki/zh-tw/#/item/consume
 *
 * 严格按需爬取范围:
 *  1. 收藏品 (collection)
 *  2. 消耗品 (consume)
 *  3. 门卡 (key)
 * 提取核心字段:
 *  - 道具图片 (高清原图下载至本地及记录 URL)
 *  - 大小 (占格子 width x length, 如 1x1, 1x2, 2x2 等)
 *  - 重量 (kg)
 *  - 名字 (繁体官方名 + 简体对照名)
 *  - 品质、描述及详情
 */

const fs = require('fs');
const path = require('path');

// 简繁常用字映射字典 (针对三角洲物品词库优化)
const TRAD_TO_SIMP = {
  '黃': '黄', '金': '金', '瞪': '瞪', '羚': '羚', '強': '强', '化': '化', '碳': '碳', '纖': '纤',
  '維': '维', '板': '板', '火': '火', '箭': '箭', '燃': '燃', '料': '料', '攝': '摄', '影': '影',
  '機': '机', '顯': '显', '示': '示', '卡': '卡', '軍': '军', '用': '用', '無': '无', '人': '人',
  '電': '电', '台': '台', '手': '手', '提': '提', '腦': '脑', '刀': '刀', '片': '片', '伺': '伺',
  '服': '服', '器': '器', '速': '速', '磁': '磁', '碟': '碟', '陣': '阵', '列': '列', '衞': '卫',
  '星': '星', '通': '通', '訊': '讯', '天': '天', '線': '线', '飛': '飞', '行': '行', '記': '记',
  '錄': '录', '儀': '仪', '炮': '炮', '彈': '弹', '控': '控', '制': '制', '終': '终', '端': '端',
  '克': '克', '勞': '劳', '迪': '迪', '烏': '乌', '斯': '斯', '半': '半', '身': '身', '像': '像',
  '變': '变', '站': '站', '技': '技', '術': '术', '室': '室', '東': '东', '翼': '翼', '經': '经',
  '理': '理', '總': '总', '裁': '裁', '會': '会', '客': '客', '廳': '厅', '黑': '黑', '藍': '蓝',
  '核': '核', '心': '心', '酒': '酒', '店': '店', '國': '国', '王': '王', '房': '房', '雷': '雷',
  '達': '达', '平': '平', '地': '地', '下': '下', '庫': '库', '儲': '储', '藏': '藏', '間': '间',
  '博': '博', '物': '物', '館': '馆', '展': '展', '套': '套', '舊': '旧', '浴': '浴', '場': '场',
  '貴': '贵', '賓': '宾', '旅': '旅', '餐': '餐', '呼': '呼', '吸': '吸', '奧': '奥', '莉': '莉',
  '薇': '薇', '婭': '娅', '香': '香', '檳': '槟', '高': '高', '級': '级', '頭': '头', '盔': '盔',
  '修': '修', '組': '组', '合': '合', '護': '护', '甲': '甲', '針': '针', '劑': '剂', '藥': '药',
  '品': '品', '醫': '医', '療': '疗', '包': '包', '阿': '阿', '薩': '萨', '拉': '拉', '娛': '娱',
  '樂': '乐', '月': '月', '刊': '刊', '調': '调', '味': '味', '袋': '袋', '裝': '装', '咖': '咖',
  '啡': '啡', '豆': '豆', '當': '当', '再': '再', '製': '制', '超': '超', '能': '能', '膠': '胶',
  '石': '石', '工': '工', '錘': '锤', '鋸': '锯', '充': '充', '池': '池', '私': '私', '密': '密',
  '筆': '笔', '簿': '簿', '專': '专', '門': '门', '處': '处', '階': '阶', '梯': '梯', '頂': '顶',
  '樓': '楼', '主': '主', '辦': '办', '公': '公', '管': '管', '道': '道', '員': '员', '宿': '宿',
  '舍': '舍', '監': '监', '控': '控', '備': '备', '份': '份', '密': '密', '室': '室', '維': '维',
  '保': '保', '資': '资', '產': '产', '評': '评', '估': '估', '實': '实', '驗': '验', '研': '研',
  '發': '发', '資': '资', '訊': '讯', '檔': '档', '案': '案', '重': '重', '症': '症', '病': '病',
  '醫': '医', '生': '生', '辦': '办', '診': '诊', '療': '疗', '暗': '暗', '區': '区', '通': '通',
  '配': '配', '件': '件', '工': '工', '防': '防', '水': '水', '箱': '箱', '密': '密', '碼': '码',
  '箱': '箱', '保': '保', '險': '险', '櫃': '柜', '武': '武', '器': '器', '箱': '箱', '軍': '军',
  '備': '备', '庫': '库', '倉': '仓', '庫': '库', '物': '物', '資': '资', '站': '站', '哨': '哨',
  '所': '所', '防': '防', '空': '空', '洞': '洞', '避': '避', '難': '难', '所': '所', '地': '地',
  '下': '下', '室': '室', '走': '走', '廊': '廊', '過': '过', '道': '道', '大': '大', '廳': '厅',
  '會議': '会议', '辦公': '办公', '資料': '资料', '檔案': '档案', '庫房': '库房', '車間': '车间',
  '工廠': '工厂', '發電': '发电', '變電': '变电', '配電': '配电', '監控': '监控', '安保': '安保',
  '醫療': '医疗', '手術': '手术', '重症': '重症', '化驗': '化验', '實驗': '实验', '研發': '研发',
  '倉庫': '仓库', '儲藏': '储藏', '保險': '保险', '金庫': '金库', '軍火': '军火', '裝備': '装备',
  '車輛': '车辆', '停機': '停机', '雷達': '雷达', '通信': '通信', '指揮': '指挥', '核心': '核心',
  '機房': '机房', '主控': '主控', '中央': '中央', '系統': '系统', '控制': '控制', '動力': '动力',
  '能源': '能源', '燃料': '燃料', '水處理': '水处理', '通風': '通风', '管道': '管道', '走廊': '走廊',
  '樓梯': '楼梯', '電梯': '电梯', '頂樓': '顶楼', '天台': '天台', '露台': '露台', '陽台': '阳台',
  '門禁': '门禁', '鑰匙': '钥匙', '卡片': '卡片', '磁卡': '磁卡', '晶片': '芯片', '密鑰': '密钥',
  '代碼': '代码', '密碼': '密码', '權限': '权限', '認證': '认证', '安全': '安全', '防護': '防护',
  '隔離': '隔离', '封鎖': '封锁', '禁區': '禁区', '警戒': '警戒', '巡邏': '巡逻', '守衛': '守卫',
  '哨卡': '哨卡', '檢查': '检查', '卡點': '卡点', '路口': '路口', '橋樑': '桥梁', '隧道': '隧道',
  '涵洞': '涵洞', '碼頭': '码头', '港口': '港口', '船塢': '船坞', '岸邊': '岸边', '海灘': '海滩',
  '河道': '河道', '水庫': '水库', '大壩': '大坝', '水廠': '水厂', '泵房': '泵房', '水閘': '水闸',
  '農場': '农场', '村莊': '村庄', '小鎮': '小镇', '集市': '集市', '商場': '商场', '超市': '超市',
  '商店': '商店', '餐館': '餐馆', '飯店': '饭店', '酒店': '酒店', '賓館': '宾馆', '旅社': '旅社',
  '宿舍': '宿舍', '公寓': '公寓', '別墅': '别墅', '民居': '民居', '住宅': '住宅', '營地': '营地',
  '營房': '营房', '帳篷': '帐篷', '哨塔': '哨塔', '瞭望': '瞭望', '碉堡': '碉堡', '掩體': '掩体',
  '防空': '防空', '地下': '地下', '坑道': '坑道', '礦洞': '矿洞', '礦井': '矿井', '礦坑': '矿坑',
  '採礦': '采矿', '冶煉': '冶炼', '鋼鐵': '钢铁', '水泥': '水泥', '磚廠': '砖厂', '石料': '石料',
  '木材': '木材', '伐木': '伐木', '加工': '加工', '製造': '制造', '組裝': '组装', '維修': '维修',
  '保養': '保养', '測試': '测试', '質檢': '质检', '包裝': '包装', '物流': '物流', '貨運': '货运',
  '堆場': '堆场', '貨場': '货场', '集裝': '集装', '集裝箱': '集装箱', '吊車': '吊车', '塔吊': '塔吊',
  '叉車': '叉车', '卡車': '卡车', '火車': '火车', '鐵路': '铁路', '軌道': '轨道', '月台': '月台',
  '站台': '站台', '車站': '车站', '航站': '航站', '機場': '机场', '跑道': '跑道', '機庫': '机库',
  '停機坪': '停机坪', '塔台': '塔台', '雷達站': '雷达站', '氣象': '气象', '觀測': '观测', '監測': '监测',
  '發射': '发射', '陣地': '阵地', '基地': '基地', '中心': '中心', '站點': '站点', '據點': '据点',
  '前哨': '前哨', '指揮所': '指挥所', '參謀': '参谋', '司令': '司令', '軍部': '军部', '兵營': '兵营',
  '靶場': '靶场', '訓練': '训练', '演習': '演习', '作戰': '作战', '戰術': '战术', '情報': '情报',
  '密電': '密电', '通訊': '通讯', '電台': '电台', '中繼': '中继', '信號': '信号', '天線': '天线',
  '雷達': '雷达', '聲吶': '声呐', '光學': '光学', '紅外': '红外', '熱像': '热像', '夜視': '夜视',
  '瞄準': '瞄准', '測距': '测距', '導航': '导航', '定位': '定位', '羅盤': '罗盘', '地圖': '地图',
  '望遠': '望远', '照相': '照相', '攝像': '摄像', '錄像': '录像', '音頻': '音频', '視頻': '视频',
  '磁帶': '磁带', '膠卷': '胶卷', '光盤': '光盘', '硬盤': '硬盘', '軟盤': '软盘', '記憶': '记忆',
  '內存': '内存', '閃存': '闪存', '芯片': '芯片', '電路': '电路', '元件': '元件', '模組': '模组',
  '主板': '主板', '顯卡': '显卡', '聲卡': '声卡', '網卡': '网卡', '電源': '电源', '電池': '电池',
  '電容': '电容', '電阻': '电阻', '線圈': '线圈', '變壓': '变压', '繼電': '继电', '開關': '开关',
  '插座': '插座', '插頭': '插头', '電纜': '电缆', '導線': '导线', '光纖': '光纤', '傳感': '传感',
  '感應': '感应', '探測': '探测', '報警': '报警', '警報': '警报', '滅火': '灭火', '消防': '消防',
  '噴淋': '喷淋', '逃生': '逃生', '急救': '急救', '包紮': '包扎', '止血': '止血', '消炎': '消炎',
  '抗生': '抗生', '鎮痛': '镇痛', '麻醉': '麻醉', '解毒': '解毒', '防輻': '防辐', '抗輻': '抗辐',
  '血漿': '血浆', '生理': '生理', '鹽水': '盐水', '葡萄': '葡萄', '注射': '注射', '針筒': '针筒',
  '針頭': '针头', '藥品': '药品', '藥劑': '药剂', '藥片': '药片', '膠囊': '胶囊', '藥膏': '药膏',
  '繃帶': '绷带', '紗布': '纱布', '膠布': '胶布', '夾板': '夹板', '擔架': '担架', '手術刀': '手术刀',
  '止血鉗': '止血钳', '鑷子': '镊子', '剪刀': '剪刀', '縫合': '缝合', '體溫': '体温', '血壓': '血压',
  '心電': '心电', '除顫': '除颤', '氧氣': '氧气', '面罩': '面罩', '防毒': '防毒', '濾罐': '滤罐',
  '過濾': '过滤', '呼吸': '呼吸', '潛水': '潜水', '救生': '救生', '安全帶': '安全带', '安全繩': '安全绳',
  '掛鉤': '挂钩', '滑輪': '滑轮', '絞盤': '绞盘', '千斤': '千斤', '扳手': '扳手', '螺絲': '螺丝',
  '螺絲刀': '螺丝刀', '鉗子': '钳子', '鐵錘': '铁锤', '木錘': '木锤', '橡膠': '橡胶', '鋼鋸': '钢锯',
  '電鋸': '电锯', '砂輪': '砂轮', '角磨': '角磨', '電鑽': '电钻', '衝擊': '冲击', '焊機': '焊机',
  '電焊': '电焊', '氣焊': '气焊', '焊條': '焊条', '焊絲': '焊丝', '助焊': '助焊', '烙鐵': '烙铁',
  '萬用': '万用', '示波': '示波', '信號源': '信号源', '頻譜': '频谱', '網絡': '网络', '測試儀': '测试仪'
};

function toSimplifiedChinese(str) {
  if (!str) return '';
  let res = '';
  for (let i = 0; i < str.length; i++) {
    // 优先匹配双字词
    if (i < str.length - 1) {
      const two = str.substr(i, 2);
      if (TRAD_TO_SIMP[two]) {
        res += TRAD_TO_SIMP[two];
        i++;
        continue;
      }
    }
    const char = str[i];
    res += TRAD_TO_SIMP[char] || char;
  }
  return res;
}

// 稀有度与等级完整映射体系 (6级=红, 5级=橙, 4级=紫, 3级=蓝, 2级=绿, 1级=白)
const RARITY_MAP = {
  6: {
    level: 6,
    levelName: '6级',
    color: '红',
    colorLabel: '红色',
    rarity: '红',
    rarityLabel: '6级 (红)',
    rarityFull: '6级红色',
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    iconClass: 'item-level-icon img_levelicon_06'
  },
  5: {
    level: 5,
    levelName: '5级',
    color: '橙',
    colorLabel: '橙色',
    rarity: '橙',
    rarityLabel: '5级 (橙)',
    rarityFull: '5级橙色',
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    iconClass: 'item-level-icon img_levelicon_05'
  },
  4: {
    level: 4,
    levelName: '4级',
    color: '紫',
    colorLabel: '紫色',
    rarity: '紫',
    rarityLabel: '4级 (紫)',
    rarityFull: '4级紫色',
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    iconClass: 'item-level-icon img_levelicon_04'
  },
  3: {
    level: 3,
    levelName: '3级',
    color: '蓝',
    colorLabel: '蓝色',
    rarity: '蓝',
    rarityLabel: '3级 (蓝)',
    rarityFull: '3级蓝色',
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    iconClass: 'item-level-icon img_levelicon_03'
  },
  2: {
    level: 2,
    levelName: '2级',
    color: '绿',
    colorLabel: '绿色',
    rarity: '绿',
    rarityLabel: '2级 (绿)',
    rarityFull: '2级绿色',
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    iconClass: 'item-level-icon img_levelicon_02'
  },
  1: {
    level: 1,
    levelName: '1级',
    color: '白',
    colorLabel: '白色',
    rarity: '白',
    rarityLabel: '1级 (白)',
    rarityFull: '1级白色',
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    iconClass: 'item-level-icon img_levelicon_01'
  }
};

// 目标分类与映射
const TARGET_CATEGORIES = {
  'collection': { key: 'collection', name: '收藏品', folder: 'collection' },
  'consume': { key: 'consume', name: '消耗品', folder: 'consume' },
  'key': { key: 'key', name: '门卡', folder: 'keys' }
};

// 官方接口配置
const API_URL = 'https://sg-apps.vasdgame.com/ide/';
const LANG_PACK_URL = 'https://deltaforcewiki.vasdgame.com/playerhub/40001/language/language_zh-tw_2025012019.json';

// 输出目录配置
const BASE_ASSETS_DIR = path.resolve(__dirname, '../miniprogram/assets/items');
const MANIFEST_PATH = path.join(BASE_ASSETS_DIR, 'item_manifest.json');

async function fetchOfficialProps() {
  console.log('1. 请求三角洲官方百科道具接口 (primary: props)...');
  const params = new URLSearchParams({
    iChartId: '100005405',
    sIdeToken: 'nkxYQl',
    instanceid: '4005360',
    method: 'projectd_oversea/object.list',
    param: JSON.stringify({ primary: 'props', second: '', third: '', objectID: '' }),
    sLanguage: 'zh-tw'
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'referer': 'https://www.playdeltaforce.com/',
      'origin': 'https://www.playdeltaforce.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: params.toString()
  });

  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const json = await res.json();
  if (json.ret !== 0 && json.iRet !== 0) throw new Error(`API ret error: ${JSON.stringify(json)}`);

  const rawList = json.jData?.data?.data?.list || [];
  console.log(`- 官方返回道具总条目数: ${rawList.length}`);
  return rawList;
}

async function fetchLanguagePack() {
  console.log('2. 获取官方最新动态多语言字典 (zh-tw)...');
  const res = await fetch(LANG_PACK_URL, {
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Fetch language pack failed: ${res.status}`);
  const dict = await res.json();
  console.log(`- 语言字典包含词条数: ${Object.keys(dict).length}`);
  return dict;
}

function normalizePicUrl(url) {
  if (!url) return '';
  // 规范化双斜杠（排除协议头的 http:// 或 https://）
  return url.replace(/([^:])\/{2,}/g, '$1/');
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

// 限制并发下载辅助函数
async function downloadPool(tasks, concurrency = 10) {
  let index = 0;
  let successCount = 0;
  let failCount = 0;
  const total = tasks.length;

  async function worker() {
    while (index < tasks.length) {
      const currentTask = tasks[index++];
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await currentTask();
          success = true;
          successCount++;
          break;
        } catch (e) {
          if (attempt === 3) {
            failCount++;
            console.error(`- 下载重试失败 (${attempt}/3):`, e.message);
          } else {
            await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
      }
      if (index % 30 === 0 || index === total) {
        process.stdout.write(`\r- 图片下载进度: ${index}/${total} (成功: ${successCount}, 失败: ${failCount})`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  console.log('');
  return { successCount, failCount };
}

async function main() {
  console.log('=== 三角洲行动物资道具爬虫启动 ===');
  const startTime = Date.now();

  // 确保基础目录存在
  if (!fs.existsSync(BASE_ASSETS_DIR)) {
    fs.mkdirSync(BASE_ASSETS_DIR, { recursive: true });
  }
  for (const cat of Object.values(TARGET_CATEGORIES)) {
    const dir = path.join(BASE_ASSETS_DIR, cat.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // 1. 获取道具数据与语言包
  const [rawItems, langDict] = await Promise.all([
    fetchOfficialProps(),
    fetchLanguagePack()
  ]);

  // 2. 严格按需过滤: 仅保留 收藏品、消耗品、门卡
  const filteredItems = rawItems.filter(item => TARGET_CATEGORIES[item.secondClass]);
  console.log(`3. 按需筛选完成，目标道具总数: ${filteredItems.length} (已严格排除其它分类)`);

  const categoryStats = {
    collection: 0,
    consume: 0,
    key: 0
  };

  const parsedItems = [];
  const downloadTasks = [];
  const downloadedUrls = new Map(); // url -> localPath (去重下载)

  for (const item of filteredItems) {
    const catConfig = TARGET_CATEGORIES[item.secondClass];
    categoryStats[item.secondClass]++;

    const oid = String(item.objectID);
    const langInfo = langDict[oid] || {};

    // 名称解析
    const nameTw = langInfo.name || item.objectName || `道具_${oid}`;
    const nameCn = toSimplifiedChinese(nameTw);

    // 描述解析
    const descTw = langInfo.desc || item.desc || '';
    const descCn = toSimplifiedChinese(descTw);

    // 占格与重量解析
    const width = Number(item.width) || 1;
    const length = Number(item.length) || 1;
    const gridSize = `${width}x${length}`;
    const totalGrid = width * length;
    const weightKg = item.weight ? parseFloat(item.weight) : 0;

    // 图片路径规划
    const remotePic = normalizePicUrl(item.pic);
    const remoteThumb = normalizePicUrl(item.prePic);

    // 文件名以 objectID 命名，保持规范且唯一
    const ext = path.extname(remotePic) || '.png';
    const fileName = `${item.objectID}${ext}`;
    const fileRelPath = `/assets/items/${catConfig.folder}/${fileName}`;
    const fileAbsPath = path.join(BASE_ASSETS_DIR, catConfig.folder, fileName);

    // 详情属性解析
    const detail = { ...item.propsDetail };
    if (detail.useMap) detail.useMap = toSimplifiedChinese(langInfo.map || detail.useMap);
    if (detail.usePlace) detail.usePlace = toSimplifiedChinese(langInfo.place || detail.usePlace);
    if (detail.repairArea) detail.repairArea = toSimplifiedChinese(langInfo.area || detail.repairArea);
    if (detail.replyEffect) detail.replyEffect = toSimplifiedChinese(langInfo.reply || detail.replyEffect);
    if (detail.repairEfficiency) detail.repairEfficiency = toSimplifiedChinese(langInfo.eff || detail.repairEfficiency);
    if (detail.propsSource) detail.propsSource = toSimplifiedChinese(langInfo.source || detail.propsSource);
    if (detail.type) detail.type = toSimplifiedChinese(langInfo.type || detail.type);

    // 稀有度与品级等级解析 (6级=红, 5级=橙, 4级=紫, 3级=蓝, 2级=绿, 1级=白)
    const grade = Number(item.grade) || 1;
    const rarityInfo = RARITY_MAP[grade] || RARITY_MAP[1];

    // 带等级与稀有度标识名称 (如 "[6级·红] 黄金瞪羚", "[6级] 黄金瞪羚", "[红] 黄金瞪羚")
    const nameWithLevel = `[${rarityInfo.levelName}·${rarityInfo.color}] ${nameTw}`;
    const nameWithLevelCn = `[${rarityInfo.levelName}·${rarityInfo.color}] ${nameCn}`;
    const nameWithRarity = `[${rarityInfo.color}] ${nameTw}`;
    const nameWithRarityCn = `[${rarityInfo.color}] ${nameCn}`;

    parsedItems.push({
      id: item.objectID,
      rawId: item.id,
      name: nameTw,
      name_cn: nameCn,
      nameWithLevel: nameWithLevel,
      nameWithLevel_cn: nameWithLevelCn,
      nameWithRarity: nameWithRarity,
      nameWithRarity_cn: nameWithRarityCn,
      category: item.secondClass,
      categoryName: catConfig.name,
      subClass: item.thirdClass || '',
      // 等级标识与稀有度体系
      level: rarityInfo.level,
      levelName: rarityInfo.levelName,
      color: rarityInfo.color,
      colorLabel: rarityInfo.colorLabel,
      rarity: rarityInfo.rarity,
      rarityLabel: rarityInfo.rarityLabel,
      rarityFull: rarityInfo.rarityFull,
      grade: grade,
      colorHex: rarityInfo.colorHex,
      bgColorHex: rarityInfo.bgColorHex,
      levelIconClass: rarityInfo.iconClass,
      width: width,
      length: length,
      gridSize: gridSize,
      totalGrid: totalGrid,
      weight: weightKg,
      desc: descTw,
      desc_cn: descCn,
      remotePicUrl: remotePic,
      remoteThumbUrl: remoteThumb,
      localPicPath: fileRelPath,
      fileName: fileName,
      propsDetail: detail
    });

    // 准备下载任务
    if (remotePic) {
      if (!fs.existsSync(fileAbsPath) || fs.statSync(fileAbsPath).size === 0) {
        downloadTasks.push(async () => {
          const res = await fetch(remotePic, {
            headers: { 'user-agent': 'Mozilla/5.0' }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${remotePic}`);
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(fileAbsPath, buf);
        });
      }
    }
  }

  console.log(`\n4. 开始下载道具高清图片 (待下载任务数: ${downloadTasks.length})...`);
  if (downloadTasks.length > 0) {
    const { successCount, failCount } = await downloadPool(downloadTasks, 15);
    console.log(`- 下载完毕！成功: ${successCount}, 失败: ${failCount}`);
  } else {
    console.log('- 所有图片已在本地缓存，无需重复下载。');
  }

  // 5. 按照类别与稀有度整理索引
  const categoriesMap = {};
  for (const [key, conf] of Object.entries(TARGET_CATEGORIES)) {
    const list = parsedItems.filter(i => i.category === key);
    categoriesMap[key] = {
      key: conf.key,
      name: conf.name,
      folder: conf.folder,
      count: list.length,
      list: list
    };
  }

  // 等级与稀有度分布统计
  const rarityStats = {
    '红': 0,
    '橙': 0,
    '紫': 0,
    '蓝': 0,
    '绿': 0,
    '白': 0
  };
  const levelStats = {
    '6级 (红)': 0,
    '5级 (橙)': 0,
    '4级 (紫)': 0,
    '3级 (蓝)': 0,
    '2级 (绿)': 0,
    '1级 (白)': 0
  };

  parsedItems.forEach(i => {
    if (rarityStats[i.color] !== undefined) {
      rarityStats[i.color]++;
    }
    if (levelStats[i.rarityLabel] !== undefined) {
      levelStats[i.rarityLabel]++;
    }
  });

  // 6. 生成并导出稀有度雪碧图与小程序样式
  const levelsDir = path.resolve(__dirname, '../miniprogram/assets/icons/levels');
  if (!fs.existsSync(levelsDir)) fs.mkdirSync(levelsDir, { recursive: true });

  const spriteSource = path.resolve(__dirname, 'level_icons_sprite.png');
  const spriteDest = path.join(levelsDir, 'level_sprite.png');
  if (fs.existsSync(spriteSource)) {
    fs.copyFileSync(spriteSource, spriteDest);
  }

  // 生成微信小程序适用的稀有度图标 WXSS 样式
  const levelWxssContent = `/* 官方等级与稀有度图标样式 (红/橙/紫/蓝/绿/白) */
.item-level-icon {
  display: inline-block;
  vertical-align: middle;
  background-repeat: no-repeat;
}

/* 6级 - 红色 (Red) */
.img_levelicon_06 {
  width: 48rpx;
  height: 47rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -10rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 5级 - 橙色 (Orange/Gold) */
.img_levelicon_05 {
  width: 44rpx;
  height: 44rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -10rpx -77rpx;
  background-size: 173rpx 131rpx;
}

/* 4级 - 紫色 (Purple) */
.img_levelicon_04 {
  width: 44rpx;
  height: 44rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -78rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 3级 - 蓝色 (Blue) */
.img_levelicon_03 {
  width: 44rpx;
  height: 33rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -74rpx -77rpx;
  background-size: 173rpx 131rpx;
}

/* 2级 - 绿色 (Green) */
.img_levelicon_02 {
  width: 21rpx;
  height: 42rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -142rpx -10rpx;
  background-size: 173rpx 131rpx;
}

/* 1级 - 白色 (White) */
.img_levelicon_01 {
  width: 21rpx;
  height: 21rpx;
  background-image: url('/assets/icons/levels/level_sprite.png');
  background-position: -142rpx -72rpx;
  background-size: 173rpx 131rpx;
}
`;
  fs.writeFileSync(path.join(levelsDir, 'level_icons.wxss'), levelWxssContent, 'utf8');

  const manifestData = {
    generatedAt: new Date().toISOString(),
    sourceWiki: 'https://www.playdeltaforce.com/act/officialwiki/zh-tw/#/item/consume',
    totalItems: parsedItems.length,
    categoryCounts: categoryStats,
    levelCounts: levelStats,
    rarityCounts: rarityStats,
    rarityDefinitions: RARITY_MAP,
    categories: categoriesMap,
    items: parsedItems
  };

  // 写入 manifest.json
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`\n5. 元数据清单已生成: ${MANIFEST_PATH}`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n=== 爬取完成！耗时: ${duration}s ===`);
  console.log(`- 收藏品 (collection): ${categoryStats.collection} 件`);
  console.log(`- 消耗品 (consume): ${categoryStats.consume} 件`);
  console.log(`- 门卡 (key): ${categoryStats.key} 件`);
  console.log(`- 等级与稀有度分布:`);
  for (const [lvl, cnt] of Object.entries(levelStats)) {
    console.log(`  * ${lvl}: ${cnt} 件`);
  }
  console.log(`- 合计: ${parsedItems.length} 件`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
