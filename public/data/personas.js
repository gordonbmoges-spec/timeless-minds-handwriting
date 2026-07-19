export const PERSONAS = Object.freeze([
  {
    id: "confucius",
    name: "孔子",
    latinName: "CONFUCIUS",
    years: "551–479 BCE",
    field: "儒家思想",
    medium: "竹简 · 毛笔",
    keywords: ["仁", "礼", "中庸"],
    bookTitle: "论语问答",
    bookTone: "jade",
    sigil: "仁"
  },
  {
    id: "socrates",
    name: "苏格拉底",
    latinName: "SOCRATES",
    years: "470–399 BCE",
    field: "古希腊哲学",
    medium: "蜡板 · 刻笔",
    keywords: ["诘问", "德性", "自知"],
    bookTitle: "城邦诘问",
    bookTone: "marble",
    sigil: "Ω"
  },
  {
    id: "da-vinci",
    name: "达·芬奇",
    latinName: "LEONARDO DA VINCI",
    years: "1452–1519",
    field: "艺术与科学",
    medium: "手稿纸 · 褐墨",
    keywords: ["观察", "结构", "实验"],
    bookTitle: "镜写手稿",
    bookTone: "umber",
    sigil: "V"
  },
  {
    id: "shakespeare",
    name: "莎士比亚",
    latinName: "WILLIAM SHAKESPEARE",
    years: "1564–1616",
    field: "戏剧与诗歌",
    medium: "布纹纸 · 羽毛笔",
    keywords: ["欲望", "角色", "命运"],
    bookTitle: "舞台与人心",
    bookTone: "wine",
    sigil: "S"
  },
  {
    id: "jung",
    name: "荣格",
    latinName: "C. G. JUNG",
    years: "1875–1961",
    field: "分析心理学",
    medium: "私人笔记 · 钢笔",
    keywords: ["原型", "阴影", "个体化"],
    bookTitle: "红书之门",
    bookTone: "crimson",
    sigil: "J"
  },
  {
    id: "einstein",
    name: "爱因斯坦",
    latinName: "ALBERT EINSTEIN",
    years: "1879–1955",
    field: "理论物理学",
    medium: "方格纸 · 铅笔",
    keywords: ["假设", "参照系", "思想实验"],
    bookTitle: "时空草稿",
    bookTone: "midnight",
    sigil: "E"
  },
  {
    id: "magic-mirror",
    name: "魔镜",
    latinName: "THE ENCHANTED MIRROR",
    years: "古老童话",
    field: "真相与欲望",
    medium: "银镜 · 魔法回声",
    keywords: ["容颜", "真话", "欲望"],
    bookTitle: "皇后的魔镜",
    bookTone: "silver",
    sigil: "✦",
    openingLine: "魔镜已经醒来。问吧，皇后。"
  },
  {
    id: "tom-riddle",
    name: "汤姆·里德尔",
    latinName: "TOM RIDDLE'S DIARY",
    years: "1943 · 魔法记忆",
    field: "黑魔法人物档案",
    medium: "黑皮日记 · 墨水",
    keywords: ["记忆", "秘密", "选择"],
    bookTitle: "汤姆的日记",
    bookTone: "obsidian",
    sigil: "T",
    openingLine: "我是汤姆。汤姆·里德尔。你为什么打开我的日记？"
  },
  {
    id: "human-parchment",
    name: "人皮纸",
    latinName: "THE HUMAN PARCHMENT",
    years: "年代不详",
    field: "诡异预言",
    medium: "黄色人皮纸 · 黑墨",
    keywords: ["未来", "代价", "诡异"],
    bookTitle: "人皮纸",
    bookTone: "parchment",
    sigil: "眼",
    openingLine: "我叫杨间。当你看到这句话的时候，我已经死了。"
  }
]);

export function findPersona(id) {
  return PERSONAS.find((persona) => persona.id === id) || null;
}
