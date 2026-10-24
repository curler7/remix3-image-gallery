import { mountDeepZoom } from "../src/deep-zoom.js";
import { mountGallery, mountWindow } from "../src/dom.js";
import { applyLayout } from "../src/layouts.js";
import {
  synchronizedCompare,
  annotations,
  slideshow,
} from "../src/extensions.js";
Object.assign(globalThis, {
  galleryTest: {
    mountDeepZoom,
    mountGallery,
    mountWindow,
    applyLayout,
    synchronizedCompare,
    annotations,
    slideshow,
  },
});
