/**
 * 今日鼠鼠运势 - 独立文案与词库字典 (FortuneCopywriting)
 *
 * 策划说明:
 *  - 本文件专门用于维护所有面向玩家的展示文案、黑话命名、签文评价与老黄历宜忌。
 *  - 后续文案调整、修饰与扩充均可在此直接修改，逻辑代码无须变更。
 *
 * 占位符支持:
 *  - {map}: 抽中的地图名称 (如: 零号大坝)
 *  - {spot}: 抽中的地标建筑 (如: 行政辖区)
 *  - {container}: 抽中的暴富容器 (如: 小保险箱 / 人机包)
 *  - {item}: 抽中的本命道具名称 (如: 非洲之心)
 *  - {levelName}: 道具品级黑话 (答辩 / 小绿 / 小蓝 / 小紫 / 小金 / 大红)
 *  - {price}: 道具格式化身价 (如: 13,141,314)
 */

// 1. 1~6 级品质与黑话称谓及签文建议 (彻底去除大吉/大凶等传统称谓，全量采用玩家黑话)
const LEVEL_COPYWRITING = Object.freeze({
  6: Object.freeze({
    level: 6,
    levelName: '大红',
    sign: '大红',
    colorHex: '#E03A3E',
    bgColorHex: '#361a1c',
    subTitles: ['天命所归', '红光满面', '绝密摸金王', '撤离点霸主'],
    yi: [
      '起全装直奔高危区',
      '摸【{container}】直出大红',
      '大金第一时间塞入安全箱',
      '从容撤离笑纳战果'
    ],
    ji: [
      '开阔地长时间发呆',
      '手滑漏舔保险箱',
      '队友劝架自己犹豫'
    ],
    advices: [
      '今日欧气拉满！前往【{map}·{spot}】搜刮，遇到【{container}】务必开一下，天命大红【{item}】很可能直接现身！',
      '战术感知已达巅峰，在【{map}】核心交火区多转转，就算路过【{container}】随手一摸都能红光冲天。',
      '今天宜起顶级全装入场，身法枪法如有神助，摸到【{item}】塞好安全箱，全图都是你的后花园！',
      '天命所归的一天！把【{item}】当做你的本命吉物，撤离哨声响起时你就是整张图最靓的特干！'
    ]
  }),

  5: Object.freeze({
    level: 5,
    levelName: '小金',
    sign: '小金',
    colorHex: '#F59E0B',
    bgColorHex: '#37281b',
    subTitles: ['满载而归', '财运亨通', '金光护体', '盆满钵满'],
    yi: [
      '协同推进稳搜二线',
      '见好就收提前规划路线',
      '多开【{container}】搜寻小金'
    ],
    ji: [
      '背包已满贪图劝架',
      '撤离倒计时掐秒狂奔',
      '单人硬闯重兵防线'
    ],
    advices: [
      '今日财运亨通！在【{map}·{spot}】稳扎稳打搜刮，多注意路边的【{container}】，大概率开出【{item}】！',
      '运势稳步走高，今日适合叫上队友小队协同，摸到大金切莫盲目贪战，包满即润才是真理。',
      '听声辨位格外精准，在【{map}】巡逻点摸【{container}】，往往能在暗格翻出意外惊喜。',
      '背包总是能装得满满当当，【{item}】已在向你招手，稳妥带出即是巨大收益！'
    ]
  }),

  4: Object.freeze({
    level: 4,
    levelName: '小紫',
    sign: '小紫',
    colorHex: '#9333EA',
    bgColorHex: '#1e1c2c',
    subTitles: ['稳中求进', '小富即安', '波澜不惊', '保本即胜'],
    yi: [
      '搜刮二线资源点',
      '带足烟雾弹与注射器',
      '带出【{item}】保本经营'
    ],
    ji: [
      '正面硬冲主楼核心区',
      '起昂贵装备当出头鸟',
      '开阔地无掩体拉枪'
    ],
    advices: [
      '今日战况平稳，建议在【{map}·{spot}】打扫二线点位，遇到【{container}】顺手开一下，拿到【{item}】稳步撤离。',
      '心态放平，今天适合稳步积累战术物资或练习跑图身法，不亏就是赚，活着走出去最重要。',
      '正面火拼风险偏高，遇到硬茬建议迂回拉扯，背包里的【{item}】安全变现才是硬道理。',
      '在【{map}】多搜工具柜与【{container}】，虽无惊天暴富，但小富即安亦是生存智慧。'
    ]
  }),

  3: Object.freeze({
    level: 3,
    levelName: '小蓝',
    sign: '小蓝',
    colorHex: '#2563EB',
    bgColorHex: '#121f28',
    subTitles: ['老六出没', '暗藏杀机', '如履薄冰', '警惕架枪'],
    yi: [
      '随身携带瞬爆雷探路',
      '谨慎静音慢步前进',
      '提前两分钟向撤离点转移'
    ],
    ji: [
      '在暗处草丛旁大跳奔跑',
      '听到交火声盲目劝架',
      '开阔地直线舔包'
    ],
    advices: [
      '暗角与草丛疑似有老六架枪！前往【{map}·{spot}】搜刮务必先切战术道具探点。',
      '今日容易遭遇伏击，撤离倒计时切勿掐秒，看到【{container}】先观察四周确认安全再开启。',
      '听到激烈交火切忌急于劝架，小心螳螂捕蝉黄雀在后，低调行事方能保命。',
      '虽然今天运势偏蓝，带好强心剂与烟雾，只要能带出【{item}】安全撤离就算破局成功。'
    ]
  }),

  2: Object.freeze({
    level: 2,
    levelName: '小绿',
    sign: '小绿',
    colorHex: '#10B981',
    bgColorHex: '#10211a',
    subTitles: ['危机四伏', '步步惊心', '谨慎起装', '战损预警'],
    yi: [
      '起半装廉价配置入场',
      '遇到对手多利用转角拉扯',
      '搜刮【{container}】包满即润'
    ],
    ji: [
      '起豪华全装盲目冲锋',
      '在开阔水域走直线',
      '撤离点附近贪恋搜刮'
    ],
    advices: [
      '今日容易遭遇天降正义，极度不推荐起昂贵全装，建议带廉价半装或以小博大。',
      '路过【{map}·{spot}】开阔地形切记蛇皮走位，高倍镜反光可能正盯着你。',
      '搜刮切莫留恋，哪怕在【{container}】只捡到了【{item}】，包一满立刻寻找最近撤离点。',
      '枪口可能稍显发飘，少打正面中远距离对枪，多靠战术投掷物掩护转点。'
    ]
  }),

  1: Object.freeze({
    level: 1,
    levelName: '答辩',
    sign: '答辩',
    colorHex: '#9CA3AF',
    bgColorHex: '#1e2222',
    subTitles: ['落地成盒', '纯纯鼠鼠', '黑白电视', '逆风翻盘'],
    yi: [
      '当安分鼠鼠贴地滑行',
      '在边缘摸【{container}】捡漏',
      '绿烟一起立刻开润'
    ],
    ji: [
      '当出头鸟第一个进主楼',
      '在狙击枪线下原地打包',
      '把答辩物资塞满安全箱'
    ],
    advices: [
      '黑白电视机高危预警！今日在【{map}·{spot}】当一名安静的伏地鼠鼠，万不可当冲锋队长！',
      '虽然今天本命物资可能只是【{item}】，但留得青山在不怕没柴烧，苟住撤离就是胜利。',
      '极度不宜硬碰硬，今天负责在安全区摸摸【{container}】残渣，避战保命方显鼠鼠本色。',
      '逆风局更显英雄本色！带好小烟雾与小急救包，只要活着走出来，你就是今天最大的赢家！'
    ]
  })
});

// 2. 6 大地图及其标志性核心出金/交战地标 (经过官方 getMapPos 与 Leaflet CRS 投影严格核验的切片与精准坐标)
const MAP_LANDMARKS = Object.freeze({
  daba: Object.freeze({
    key: 'daba',
    name: '零号大坝',
    landmarks: [
      { name: '行政辖区', startTile: { x: 3, y: 1 }, coord: { x: 66, y: 57 } },
      { name: '军营', startTile: { x: 2, y: 1 }, coord: { x: 47, y: 44 } },
      { name: '水泥厂', startTile: { x: 2, y: 2 }, coord: { x: 46, y: 35 } },
      { name: '主变电站', startTile: { x: 4, y: 2 }, coord: { x: 33, y: 56 } },
      { name: '游客中心', startTile: { x: 5, y: 3 }, coord: { x: 34, y: 50 } },
      { name: '管道区域', startTile: { x: 1, y: 1 }, coord: { x: 69, y: 38 } }
    ]
  }),
  cgxg: Object.freeze({
    key: 'cgxg',
    name: '长弓溪谷',
    landmarks: [
      { name: '钻石皇后酒店', startTile: { x: 3, y: 4 }, coord: { x: 34, y: 54 } },
      { name: '储藏站', startTile: { x: 4, y: 2 }, coord: { x: 51, y: 44 } },
      { name: '变电站', startTile: { x: 2, y: 3 }, coord: { x: 59, y: 38 } },
      { name: '哈夫克雷达站', startTile: { x: 3, y: 2 }, coord: { x: 56, y: 29 } },
      { name: '超星车站', startTile: { x: 3, y: 2 }, coord: { x: 45, y: 70 } },
      { name: '阿米亚小镇', startTile: { x: 4, y: 3 }, coord: { x: 45, y: 57 } },
      { name: '蓝港码头', startTile: { x: 4, y: 5 }, coord: { x: 38, y: 31 } }
    ]
  }),
  htjd: Object.freeze({
    key: 'htjd',
    name: '航天基地',
    landmarks: [
      { name: '发射区', startTile: { x: 2, y: 5 }, coord: { x: 67, y: 34 } },
      { name: '离心机室', startTile: { x: 3, y: 3 }, coord: { x: 31, y: 38 } },
      { name: '总裁室', startTile: { x: 3, y: 3 }, coord: { x: 48, y: 35 } },
      { name: '中控区', startTile: { x: 3, y: 1 }, coord: { x: 46, y: 57 } },
      { name: '工业区', startTile: { x: 4, y: 2 }, coord: { x: 73, y: 41 } },
      { name: '蓝室', startTile: { x: 3, y: 2 }, coord: { x: 67, y: 63 } },
      { name: '黑室', startTile: { x: 3, y: 3 }, coord: { x: 60, y: 33 } }
    ]
  }),
  bks: Object.freeze({
    key: 'bks',
    name: '巴克什',
    landmarks: [
      { name: '皇家博物馆', startTile: { x: 3, y: 3 }, coord: { x: 46, y: 38 } },
      { name: '巴克什集市', startTile: { x: 3, y: 2 }, coord: { x: 57, y: 48 } },
      { name: '巴克什大浴场', startTile: { x: 3, y: 1 }, coord: { x: 50, y: 68 } },
      { name: '阿坦亚遗址', startTile: { x: 2, y: 3 }, coord: { x: 52, y: 36 } },
      { name: '阿萨拉营地', startTile: { x: 4, y: 2 }, coord: { x: 54, y: 61 } },
      { name: '樱桃小镇', startTile: { x: 2, y: 1 }, coord: { x: 36, y: 72 } }
    ]
  }),
  cxjy: Object.freeze({
    key: 'cxjy',
    name: '潮汐监狱',
    landmarks: [
      { name: '行政区', startTile: { x: 3, y: 3 }, coord: { x: 52, y: 73 } },
      { name: '牢房', startTile: { x: 4, y: 2 }, coord: { x: 49, y: 67 } },
      { name: '医疗实验区', startTile: { x: 4, y: 4 }, coord: { x: 32, y: 27 } },
      { name: '潮汐控制室', startTile: { x: 3, y: 1 }, coord: { x: 57, y: 69 } },
      { name: '卸货区', startTile: { x: 2, y: 3 }, coord: { x: 38, y: 74 } },
      { name: '电梯井', startTile: { x: 3, y: 3 }, coord: { x: 52, y: 33 } }
    ]
  }),
  az3: Object.freeze({
    key: 'az3',
    name: 'AZ3',
    landmarks: [
      { name: 'RBMK反应堆', startTile: { x: 3, y: 2 }, coord: { x: 50, y: 57 } },
      { name: '老科学院', startTile: { x: 2, y: 3 }, coord: { x: 44, y: 65 } },
      { name: '仿星器研究所', startTile: { x: 5, y: 2 }, coord: { x: 27, y: 64 } },
      { name: '压水堆', startTile: { x: 5, y: 2 }, coord: { x: 35, y: 26 } },
      { name: '应急火电站', startTile: { x: 2, y: 2 }, coord: { x: 29, y: 47 } },
      { name: '运输仓库', startTile: { x: 3, y: 4 }, coord: { x: 31, y: 46 } },
      { name: '石棺', startTile: { x: 3, y: 1 }, coord: { x: 48, y: 65 } }
    ]
  })
});

// 3. 战术容器池 (含常规高价值容器、辐射特种设施容器、避难鼠鼠点与人机包，绑定官方高清图元)
// 敏感词排查说明: 严禁使用"死人包"，统一规范使用"人机包"
const CONTAINER_DEFINITIONS = Object.freeze([
  // 高价值出金核心容器
  { key: 'bxx', name: '保险箱', type: 'core', desc: '核心资源点重装保险箱，大红大金常驻地', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/bxx.png' },
  { key: 'xbxx', name: '小保险箱', type: 'core', desc: '灵活小巧的防盗密码箱，随手一开爆出大金', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/xbxx.png' },
  { key: 'fwq', name: '服务器', type: 'core', desc: '电子信息机房核心机架，高价值显卡与芯片出处', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fwq.png' },
  { key: 'dwqx', name: '大武器箱', type: 'core', desc: '军用重装武器储藏箱，往往暗藏高阶改装件与金枪', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dwqx.png' },
  { key: 'wqx', name: '武器箱', type: 'core', desc: '常规武器补给箱，战术配件一应俱全', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/wqx.png' },
  { key: 'dnjx', name: '电脑机箱', type: 'core', desc: '办公机箱内部暗藏工业电子芯片与高端CPU', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dnjx.png' },
  { key: 'kdx', name: '空投箱', type: 'core', desc: '空降战略补给箱，全场焦点，极度高危亦有极高回报', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/kdx.png' },
  { key: 'cnw', name: '鸟窝(金)', type: 'core', desc: '野外绝密隐藏鸟窝，偶尔有奇遇闪耀金光', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/cnw.png' },
  { key: 'hkcwx', name: '航空储物箱', type: 'core', desc: '航空特制抗压储物箱，藏匿绝密军工档案', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/hkcwx.png' },
  { key: 'gjcwx', name: '高级储物箱', type: 'core', desc: '二线建筑高阶储物箱，搜刮必看', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/gjcwx.png' },

  // 辐射与特种容器 (原 facilities 提取)
  { key: 'fsxcwx', name: '放射性储物箱', type: 'radiation', desc: '重度辐射区专属密封箱，富贵险中求', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fsxcwx.png' },
  { key: 'fsflx', name: '辐射废料箱', type: 'radiation', desc: '核能废料容器，带好防辐射药物探索', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/fsflx.png' },
  { key: 'pbx', name: '屏蔽箱', type: 'radiation', desc: '防辐射抗电磁重型屏蔽箱，封存绝密高价值核心', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/pbx.png' },
  { key: 'gyjscwx', name: '工业金属储物箱', type: 'radiation', desc: '重工业厂区坚固金属箱，高强度工业零件', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/gyjscwx.png' },

  // 战利品与战场遗留包 (规范命名为 人机包)
  { key: 'rjb', name: '人机包', type: 'loot', desc: '巡逻战败遗留的战术背包，常有意外物资遗漏', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dsb.png' },

  // 鼠鼠搜刮与常规点位容器
  { key: 'ljx', name: '垃圾桶', type: 'rat', desc: '撤离点旁的垃圾桶，鼠鼠翻包往往有被漏舔的大金', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/ljx.png' },
  { key: 'yf', name: '一件衣服', type: 'rat', desc: '挂在衣帽架上的外套口袋，常塞有高价值密室钥匙', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/yf.png' },
  { key: 'dgjx', name: '收纳盒', type: 'rat', desc: '办公桌上的塑料收纳盒，精细小配件集散地', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/dgjx.png' },
  { key: 'lxb', name: '旅行包', type: 'rat', desc: '丢弃在角落的帆布旅行包，平民搜刮经典容器', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/lxb.png' },
  { key: 'ylb', name: '军用医疗包', type: 'rat', desc: '战地医疗箱，强心剂与急救药品充足', iconUrl: 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/ylb.png' }
]);

module.exports = {
  LEVEL_COPYWRITING,
  MAP_LANDMARKS,
  CONTAINER_DEFINITIONS
};
