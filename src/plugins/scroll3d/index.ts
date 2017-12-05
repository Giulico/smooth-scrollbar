import { ScrollbarPlugin } from 'smooth-scrollbar';

class Scroll3d extends ScrollbarPlugin {
  static pluginName = 'scroll3d';

  static defaultOptions = {};

  transformDelta(delta) {
    // console.log('Scroll3d plugin parameters', delta, fromEvent);

    return {
      x: delta.x,
      y: delta.y,
      z: -100,
    };
  }

}

// Scrollbar.use(InvertDeltaPlugin);

// const scrollbar = Scrollbar.init(elem, {
//   plugins: {
//     invertDelta: {
//       events: [/wheel/],
//     },
//   },
// });

export default Scroll3d;
