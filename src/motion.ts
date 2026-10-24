import { clamp } from "./geometry.js";
export interface MotionOptions {
  duration?: number;
  zoomDuration?: number;
  easing?: string;
  overscroll?: number;
  decay?: number;
  spring?: { stiffness: number; damping: number };
}
export type MotionProfile = "gentle" | "snappy" | "none" | MotionOptions;
export function motionProfile(
  input: MotionProfile = "gentle",
  reduced = false,
) {
  const custom =
    typeof input === "object"
      ? input
      : input === "snappy"
        ? { duration: 150, zoomDuration: 100, overscroll: 40, decay: 120 }
        : input === "none"
          ? { duration: 0, zoomDuration: 0, overscroll: 0, decay: 0 }
          : {};
  const result = {
    duration: 260,
    zoomDuration: 140,
    easing: "cubic-bezier(.2,.7,.2,1)",
    overscroll: 64,
    decay: 180,
    ...custom,
  };
  for (const key of [
    "duration",
    "zoomDuration",
    "overscroll",
    "decay",
  ] as const)
    if (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > 3000)
      throw Error("Invalid motion settings");
  if (result.spring)
    springFrames(1, result.spring.stiffness, result.spring.damping);
  if (!result.easing) throw Error("Invalid motion easing");
  return reduced
    ? { ...result, duration: 0, zoomDuration: 0, overscroll: 0, decay: 0 }
    : result;
}
/** Bounded rubber-band displacement; logical pan stays clamped separately. */
export function rubberBand(delta: number, limit = 64) {
  return limit <= 0
    ? 0
    : Math.sign(delta) * limit * (1 - Math.exp(-Math.abs(delta) / limit));
}
export function zoomLevels(
  levels: readonly number[] = [1, 1.25, 1.5, 2, 3, 4, 6, 8],
) {
  if (
    !levels.length ||
    levels.some((n) => !Number.isFinite(n) || n < 1 || n > 64)
  )
    throw Error("Invalid zoom levels");
  return [...new Set([1, ...levels])].sort((a, b) => a - b);
}
export function nextZoom(
  current: number,
  levels: readonly number[],
  direction: 1 | -1,
) {
  const ordered = zoomLevels(levels);
  return direction === 1
    ? (ordered.find((n) => n > current + 0.001) ?? ordered.at(-1)!)
    : ([...ordered].reverse().find((n) => n < current - 0.001) ?? 1);
}
export function springFrames(distance: number, stiffness = 180, damping = 24) {
  if (
    !Number.isFinite(distance + stiffness + damping) ||
    stiffness <= 0 ||
    damping <= 0
  )
    throw Error("Invalid spring");
  let position = distance,
    velocity = 0;
  const frames: number[] = [];
  for (let n = 0; n < 120; n++) {
    velocity += (-stiffness * position - damping * velocity) / 120;
    position += velocity / 120;
    frames.push(position);
    if (Math.abs(position) < 0.01 && Math.abs(velocity) < 0.01) break;
  }
  frames.push(0);
  return frames.map((n) =>
    clamp(n, -Math.abs(distance) * 2, Math.abs(distance) * 2),
  );
}
