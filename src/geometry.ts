export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function focalZoom(
  x: number,
  y: number,
  old: number,
  next: number,
  fx: number,
  fy: number,
) {
  return {
    x: fx - ((fx - x) * next) / old,
    y: fy - ((fy - y) * next) / old,
    scale: next,
  };
}
export function bounds(
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  return {
    x: clamp(x, (-width * (scale - 1)) / 2, (width * (scale - 1)) / 2),
    y: clamp(y, (-height * (scale - 1)) / 2, (height * (scale - 1)) / 2),
  };
}
export function decay(velocity: number, elapsed: number) {
  return velocity * Math.exp(-elapsed / 180);
}
export function windowRange(
  count: number,
  scroll: number,
  height: number,
  rowHeight: number,
  columns: number,
  overscan = 2,
) {
  const start =
    Math.max(0, Math.floor(scroll / rowHeight) - overscan) * columns;
  const end = Math.min(
    count,
    (Math.ceil((scroll + height) / rowHeight) + overscan) * columns,
  );
  return {
    start: Math.min(count, start),
    end,
    total: Math.ceil(count / columns) * rowHeight,
  };
}
export function justified(
  ratios: readonly number[],
  width: number,
  target = 220,
  gap = 12,
) {
  const rows: { start: number; end: number; height: number }[] = [];
  let start = 0,
    sum = 0;
  for (let i = 0; i < ratios.length; i++) {
    sum += ratios[i]!;
    if (sum * target + gap * (i - start) >= width || i === ratios.length - 1) {
      rows.push({
        start,
        end: i + 1,
        height: Math.min(target, (width - gap * (i - start)) / sum),
      });
      start = i + 1;
      sum = 0;
    }
  }
  return rows;
}
