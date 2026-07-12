export const PERSONA_ASSETS = Object.freeze({
  confucius: {
    background: "/assets/personas/confucius/background.webp",
    paper: "/assets/personas/confucius/paper.png",
    portrait: "/assets/personas/confucius/portrait.webp",
    backgroundFocus: "50% 52%",
    paperAspectRatio: 1,
    writingArea: { x: 0.085, y: 0.12, width: 0.83, height: 0.76 },
    ink: "#20150d",
    replyInk: "#342016",
    writingDirection: "vertical-rl"
  }
});

export function getPersonaAssets(id) {
  return PERSONA_ASSETS[id] || null;
}
