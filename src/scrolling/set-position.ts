import clamp from 'lodash-es/clamp';
import * as I from '../interfaces/';

import {
  setStyle,
} from '../utils/';

export function setPosition(
  scrollbar: I.Scrollbar,
  x: number,
  y: number,
  z: number = 0,
): I.ScrollStatus | null {
  const {
    options,
    offset,
    limit,
    track,
    contentEl,
  } = scrollbar;

  if (options.renderByPixels) {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
  }

  x = clamp(x, 0, limit.x);
  y = clamp(y, 0, limit.y);

  // position changed -> show track for 300ms
  if (x !== offset.x) track.xAxis.show();
  if (y !== offset.y) track.yAxis.show();

  if (!options.alwaysShowTracks) {
    track.autoHideOnIdle();
  }

  if (x === offset.x && y === offset.y) {
    return null;
  }

  offset.x = x;
  offset.y = y;
  offset.z = z;

  setStyle(contentEl, {
    '-transform': `translate3d(${-x}px, ${-y}px, ${-z}px)`,
  });

  track.update();

  return {
    offset: { ...offset },
    limit: { ...limit },
  };
}
