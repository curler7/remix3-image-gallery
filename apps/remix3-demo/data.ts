import type { GalleryImage } from "../../src/core.js";
const scenes = [
  ["Alpine stillness", "Landscape", 1500, 1100, "#c4d2d6"],
  ["Quiet architecture", "Architecture", 1000, 1400, "#cfc4b1"],
  ["The long way home", "Travel", 1500, 1000, "#b9c4a6"],
  ["A softer morning", "Landscape", 1000, 1300, "#dbcfb9"],
  ["Lines & light", "Architecture", 1500, 1100, "#b6bec4"],
  ["Beyond the shore", "Travel", 1200, 1500, "#9fbec2"],
  ["Wild and unhurried", "Landscape", 1500, 1000, "#b2be9a"],
  ["Where we wander", "Travel", 1400, 1100, "#d3c4ab"],
  ["Concrete poetry", "Architecture", 1000, 1300, "#bfc0b8"],
  ["Last light", "Landscape", 1500, 1000, "#b1a7a0"],
  ["Open horizons", "Travel", 1300, 1000, "#b0c2ca"],
  ["A place to pause", "Architecture", 1100, 1400, "#c6bdb0"],
];
export const images: GalleryImage[] = scenes.map(
  ([title, category, width, height, color], i) => ({
    id: String(i + 1),
    title: String(title),
    alt: `${title}: a curated photographic study`,
    category: String(category),
    width: Number(width),
    height: Number(height),
    color: String(color),
    src: `/media/${i + 1}.svg`,
  }),
);
