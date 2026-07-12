export const PERSONA_ASSETS = Object.freeze({
  confucius: {
    background: "/assets/personas/confucius/background.webp",
    paper: "/assets/personas/confucius/paper.png",
    portrait: "/assets/personas/confucius/portrait.webp",
    sceneLocation: "LU · PRIVATE STUDY",
    sceneTitle: "竹简问答",
    backgroundFocus: "50% 52%",
    paperAspectRatio: 1,
    writingArea: { x: 0.085, y: 0.12, width: 0.83, height: 0.76 },
    ink: "#20150d",
    replyInk: "#342016",
    writingDirection: "vertical-rl",
    replyFontSize: 34
  },
  socrates: {
    background: "/assets/personas/socrates/background.webp",
    paper: "/assets/personas/socrates/paper.png",
    portrait: "/assets/personas/socrates/portrait.webp",
    sceneLocation: "ATHENS · STOA",
    sceneTitle: "蜡板诘问",
    backgroundFocus: "45% 52%",
    paperAspectRatio: 1100 / 820,
    writingArea: { x: 0.14, y: 0.18, width: 0.72, height: 0.64 },
    ink: "#dbc89a",
    replyInk: "#eadbb5",
    writingDirection: "horizontal-tb",
    replyFontSize: 31
  },
  "da-vinci": {
    background: "/assets/personas/da-vinci/background.webp",
    paper: "/assets/personas/da-vinci/paper.png",
    portrait: "/assets/personas/da-vinci/portrait.webp",
    sceneLocation: "FLORENCE · BOTTEGA",
    sceneTitle: "手稿观察",
    backgroundFocus: "45% 48%",
    paperAspectRatio: 900 / 1160,
    writingArea: { x: 0.13, y: 0.15, width: 0.72, height: 0.7 },
    ink: "#4b2b15",
    replyInk: "#5b3318",
    writingDirection: "horizontal-tb",
    replyFontSize: 35
  },
  shakespeare: {
    background: "/assets/personas/shakespeare/background.webp",
    paper: "/assets/personas/shakespeare/paper.png",
    portrait: "/assets/personas/shakespeare/portrait.webp",
    sceneLocation: "LONDON · PLAYWRIGHT DESK",
    sceneTitle: "羽笔独白",
    backgroundFocus: "51% 48%",
    paperAspectRatio: 900 / 1160,
    writingArea: { x: 0.12, y: 0.16, width: 0.74, height: 0.68 },
    ink: "#392010",
    replyInk: "#4a2916",
    writingDirection: "horizontal-tb",
    replyFontSize: 36
  },
  jung: {
    background: "/assets/personas/jung/background.webp",
    paper: "/assets/personas/jung/paper.png",
    portrait: "/assets/personas/jung/portrait.webp",
    sceneLocation: "KUSNACHT · ANALYSIS ROOM",
    sceneTitle: "私人笔记",
    backgroundFocus: "48% 48%",
    paperAspectRatio: 900 / 1120,
    writingArea: { x: 0.14, y: 0.13, width: 0.72, height: 0.74 },
    ink: "#183b2e",
    replyInk: "#1d4838",
    writingDirection: "horizontal-tb",
    replyFontSize: 35
  },
  einstein: {
    background: "/assets/personas/einstein/background.webp",
    paper: "/assets/personas/einstein/paper.png",
    portrait: "/assets/personas/einstein/portrait.webp",
    sceneLocation: "PRINCETON · STUDY",
    sceneTitle: "方格草稿",
    backgroundFocus: "52% 48%",
    paperAspectRatio: 960 / 1120,
    writingArea: { x: 0.16, y: 0.13, width: 0.72, height: 0.74 },
    ink: "#41413c",
    replyInk: "#4b4a43",
    writingDirection: "horizontal-tb",
    replyFontSize: 34
  }
});

export function getPersonaAssets(id) {
  return PERSONA_ASSETS[id] || null;
}
