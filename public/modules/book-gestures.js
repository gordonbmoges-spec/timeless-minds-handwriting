export function pointDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
}

export function pinchRatio(startPoints, currentPoints) {
  if (!Array.isArray(startPoints) || !Array.isArray(currentPoints)) return 1;
  if (startPoints.length !== 2 || currentPoints.length !== 2) return 1;
  const start = pointDistance(startPoints[0], startPoints[1]);
  if (start < 1) return 1;
  return pointDistance(currentPoints[0], currentPoints[1]) / start;
}

export function shouldCloseFromPinch(startPoints, currentPoints, options = {}) {
  const minimumStartDistance = Number(options.minimumStartDistance || 120);
  const maximumRatio = Number(options.maximumRatio || 0.68);
  const minimumTravel = Number(options.minimumTravel || 72);
  if (startPoints?.length !== 2 || currentPoints?.length !== 2) return false;
  const start = pointDistance(startPoints[0], startPoints[1]);
  const current = pointDistance(currentPoints[0], currentPoints[1]);
  return start >= minimumStartDistance && current / start <= maximumRatio && start - current >= minimumTravel;
}

export function shouldOpenDrawerFromEdge(start, current, options = {}) {
  if (!start || !current) return false;
  const edgeWidth = Number(options.edgeWidth || 34);
  const minimumTravel = Number(options.minimumTravel || 74);
  const horizontal = Number(current.x) - Number(start.x);
  const vertical = Math.abs(Number(current.y) - Number(start.y));
  return Number(start.x) <= edgeWidth && horizontal >= minimumTravel && horizontal > vertical * 1.35;
}
