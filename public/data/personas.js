export const PERSONAS = Object.freeze([
  {
    id: "confucius",
    name: "孔子",
    latinName: "CONFUCIUS",
    years: "551–479 BCE",
    field: "儒家思想",
    medium: "竹简 · 毛笔",
    keywords: ["仁", "礼", "中庸"]
  },
  {
    id: "socrates",
    name: "苏格拉底",
    latinName: "SOCRATES",
    years: "470–399 BCE",
    field: "古希腊哲学",
    medium: "蜡板 · 刻笔",
    keywords: ["诘问", "德性", "自知"]
  },
  {
    id: "da-vinci",
    name: "达·芬奇",
    latinName: "LEONARDO DA VINCI",
    years: "1452–1519",
    field: "艺术与科学",
    medium: "手稿纸 · 褐墨",
    keywords: ["观察", "结构", "实验"]
  },
  {
    id: "shakespeare",
    name: "莎士比亚",
    latinName: "WILLIAM SHAKESPEARE",
    years: "1564–1616",
    field: "戏剧与诗歌",
    medium: "布纹纸 · 羽毛笔",
    keywords: ["欲望", "角色", "命运"]
  },
  {
    id: "jung",
    name: "荣格",
    latinName: "C. G. JUNG",
    years: "1875–1961",
    field: "分析心理学",
    medium: "私人笔记 · 钢笔",
    keywords: ["原型", "阴影", "个体化"]
  },
  {
    id: "einstein",
    name: "爱因斯坦",
    latinName: "ALBERT EINSTEIN",
    years: "1879–1955",
    field: "理论物理学",
    medium: "方格纸 · 铅笔",
    keywords: ["假设", "参照系", "思想实验"]
  }
]);

export function findPersona(id) {
  return PERSONAS.find((persona) => persona.id === id) || null;
}
