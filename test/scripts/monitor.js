import Scrollbar from '../../src/';
import { controller } from './controller';

const DPR = window.devicePixelRatio;
const TIME_RANGE_MAX = 20 * 1e3;

const monitor = document.getElementById('monitor');
const thumb = document.getElementById('thumb');
const track = document.getElementById('track');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const size = {
    width: 300,
    height: 200,
};

canvas.width = size.width * DPR;
canvas.height = size.height * DPR;
ctx.scale(DPR, DPR);

const scrollbar = Scrollbar.get(document.getElementById('main-scrollbar'));
const monitorCtrl = controller.addFolder('Monitor');
const monitorOptions = {
    show: window.innerWidth > 600,
    data: 'offset',
    duration: 5,
    reset() {
        records.length = endOffset = reduceAmount = 0;
        hoverLocked = false;
        hoverPointerX = undefined;
        tangentPoint = null;
        tangentPointPre = null;
        sliceRecord();
    },
};
let thumbWidth = 0;
let endOffset = 0;
let records = [];

let shouldUpdate = true;

let tangentPoint = null;
let tangentPointPre = null;

let hoverLocked = false;
let hoverPrecision = 'ontouchstart' in document ? 5 : 1;
let hoverPointerX, pointerDownOnTrack, renderLoopID;

if (monitorOptions.show) {
    monitor.style.display = 'block';
    renderLoopID = requestAnimationFrame(render);
}

monitorCtrl.add(monitorOptions, 'reset');
monitorCtrl.add(monitorOptions, 'data', ['offset', 'speed'])
    .onChange(() => {
        shouldUpdate = true;
    });

monitorCtrl.add(monitorOptions, 'show')
    .onChange((show) => {
        if (show) {
            monitor.style.display = 'block';
            renderLoopID = requestAnimationFrame(render);
        } else {
            monitor.style.display = 'none';
            cancelAnimationFrame(renderLoopID);
        }
    });

monitorCtrl.add(monitorOptions, 'duration', 1, 20)
    .onChange(() => {
        shouldUpdate = true;
        let start = records[0];
        let end = records[records.length - 1];

        if (end) {
            endOffset = Math.min(endOffset, Math.max(0, 1 - monitorOptions.duration * 1e3 / (end.time - start.time)));
        }
    });

function notation(num = 0) {
    if (!num || Math.abs(num) > 10 ** -2) return num.toFixed(2);

    let exp = -3;

    while (!(num / 10 ** exp | 0)) {
        if (exp < -10) {
            return num > 0 ? 'Infinity' : '-Infinity';
        }

        exp--;
    }

    return (num * 10 ** -exp).toFixed(2) + 'e' + exp;
};

function addEvent(elems, evts, handler) {
    evts.split(/\s+/).forEach((name) => {
        [].concat(elems).forEach((el) => {
            el.addEventListener(name, (...args) => {
                handler(...args);
                shouldUpdate = true;
            });
        });
    });
};

function sliceRecord() {
    let endIdx = Math.floor(records.length * (1 - endOffset));
    let last = records[records.length - 1];
    let dropIdx = 0;

    let result = records.filter((pt, idx) => {
        if (last.time - pt.time > TIME_RANGE_MAX) {
            dropIdx++;
            endIdx--;
            return;
        }

        let end = records[endIdx - 1];

        return end.time - pt.time <= monitorOptions.duration * 1e3 && idx <= endIdx;
    });

    records.splice(0, dropIdx);
    thumbWidth = result.length ? result.length / records.length : 1;

    thumb.style.width = thumbWidth * 100 + '%';
    thumb.style.right = endOffset * 100 + '%';

    return result;
};

function getLimit(points) {
    return points.reduce((pre, cur) => {
        let val = cur[monitorOptions.data];
        return {
            max: Math.max(pre.max, val),
            min: Math.min(pre.min, val),
        };
    }, { max: -Infinity, min: Infinity });
};

function assignProps(props) {
    if (!props) return;

    Object.keys(props).forEach((name) => {
        ctx[name] = props[name];
    });
};

function drawLine(p0, p1, options) {
    let x0 = p0[0];
    let y0 = p0[1];
    let x1 = p1[0];
    let y1 = p1[1];

    assignProps(options.props);

    ctx.save();
    ctx.transform(1, 0, 0, -1, 0, size.height);
    ctx.beginPath();
    ctx.setLineDash(options.dashed ? options.dashed : []);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
};

function adjustText(content, p, options) {
    let x = p[0];
    let y = p[1];

    let width = ctx.measureText(content).width;

    if (x + width > size.width) {
        ctx.textAlign = 'right';
    } else if (x - width < 0) {
        ctx.textAlign = 'left';
    } else {
        ctx.textAlign = options.textAlign;
    }

    ctx.fillText(content, x, -y);
};

function fillText(content, p, options) {
    assignProps(options.props);

    ctx.save();
    ctx.transform(1, 0, 0, 1, 0, size.height);
    adjustText(content, p, options);
    ctx.restore();
};

function drawMain() {
    let points = sliceRecord();
    if (!points.length) return;

    let limit = getLimit(points);

    let start = points[0];
    let end = points[points.length - 1];

    let totalX = thumbWidth === 1 ? monitorOptions.duration * 1e3 : end.time - start.time;
    let totalY = (limit.max - limit.min) || 1;

    let grd = ctx.createLinearGradient(0, size.height, 0, 0);
    grd.addColorStop(0, 'rgb(170, 215, 255)');
    grd.addColorStop(1, 'rgba(170, 215, 255, 0.2)');

    ctx.save();
    ctx.transform(1, 0, 0, -1, 0, size.height);

    ctx.lineWidth = 1;
    ctx.fillStyle = grd;
    ctx.strokeStyle = 'rgb(64, 165, 255)';
    ctx.beginPath();
    ctx.moveTo(0, 0);

    let lastPoint = points.reduce((pre, cur, idx) => {
        let time = cur.time;
        let value = cur[monitorOptions.data];
        let x = (time - start.time) / totalX * size.width;
        let y = (value - limit.min) / totalY * (size.height - 20);

        ctx.lineTo(x, y);

        if (hoverPointerX && Math.abs(hoverPointerX - x) < hoverPrecision) {
            tangentPoint = {
                coord: [x, y],
                point: cur,
            };

            tangentPointPre = {
                coord: pre,
                point: points[idx - 1],
            };
        }

        return [x, y];
    }, []);

    ctx.stroke();
    ctx.lineTo(lastPoint[0], 0);
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    drawLine([0, lastPoint[1]], lastPoint, {
        props: {
            strokeStyle: '#f60',
        },
    });

    fillText('↙' + notation(limit.min), [0, 0], {
        props: {
            fillStyle: '#000',
            textAlign: 'left',
            textBaseline: 'bottom',
            font: '12px sans-serif',
        },
    });
    fillText(notation(end[monitorOptions.data]), lastPoint, {
        props: {
            fillStyle: '#f60',
            textAlign: 'right',
            textBaseline: 'bottom',
            font: '16px sans-serif',
        },
    });
};

function drawTangentLine() {
    let coord = tangentPoint.coord;
    let coordPre = tangentPointPre.coord;

    let k = (coord[1] - coordPre[1]) / (coord[0] - coordPre[0]) || 0;
    let b = coord[1] - k * coord[0];

    drawLine([0, b], [size.width, k * size.width + b], {
        props: {
            lineWidth: 1,
            strokeStyle: '#f00',
        },
    });

    let realK = (tangentPoint.point[monitorOptions.data] - tangentPointPre.point[monitorOptions.data]) /
                (tangentPoint.point.time - tangentPointPre.point.time);

    fillText('dy/dx: ' + notation(realK), [size.width / 2, 0], {
        props: {
            fillStyle: '#f00',
            textAlign: 'center',
            textBaseline: 'bottom',
            font: 'bold 12px sans-serif',
        },
    });
};

function drawHover() {
    if (!tangentPoint) return;

    drawTangentLine();

    let coord = tangentPoint.coord;
    let point = tangentPoint.point;

    let coordStyle = {
        dashed: [8, 4],
        props: {
            lineWidth: 1,
            strokeStyle: 'rgb(64, 165, 255)',
        },
    };

    drawLine([0, coord[1]], [size.width, coord[1]], coordStyle);
    drawLine([coord[0], 0], [coord[0], size.height], coordStyle);

    let date = new Date(point.time + point.reduce);

    let pointInfo = [
        '(',
        date.getMinutes(),
        ':',
        date.getSeconds(),
        '.',
        date.getMilliseconds(),
        ', ',
        notation(point[monitorOptions.data]),
        ')',
    ].join('');

    fillText(pointInfo, coord, {
        props: {
            fillStyle: '#000',
            textAlign: 'left',
            textBaseline: 'bottom',
            font: 'bold 12px sans-serif',
        },
    });
};

function render() {
    if (!shouldUpdate) {
        renderLoopID = requestAnimationFrame(render);
        return;
    }

    ctx.save();
    ctx.clearRect(0, 0, size.width, size.height);

    fillText(monitorOptions.data.toUpperCase(), [0, size.height], {
        props: {
            fillStyle: '#f00',
            textAlign: 'left',
            textBaseline: 'top',
            font: 'bold 14px sans-serif',
        },
    });

    drawMain();
    drawHover();

    if (hoverLocked) {
        fillText('LOCKED', [size.width, size.height], {
            props: {
                fillStyle: '#f00',
                textAlign: 'right',
                textBaseline: 'top',
                font: 'bold 14px sans-serif',
            },
        });
    }

    ctx.restore();

    shouldUpdate = false;

    renderLoopID = requestAnimationFrame(render);
};

let lastTime = Date.now();
let lastOffset = 0;
let reduceAmount = 0;

scrollbar.addListener(() => {
    let current = Date.now();
    let offset = scrollbar.offset.y;
    let duration = current - lastTime;

    if (!duration || offset === lastOffset) return;

    if (duration > 50) {
        reduceAmount += (duration - 1);
        duration -= (duration - 1);
    }

    let velocity = (offset - lastOffset) / duration;
    lastTime = current;
    lastOffset = offset;

    records.push({
        offset,
        time: current - reduceAmount,
        reduce: reduceAmount,
        speed: Math.abs(velocity),
    });

    shouldUpdate = true;
});

function getPointer(e) {
    return e.touches ? e.touches[e.touches.length - 1] : e;
};

// hover
addEvent(canvas, 'mousemove touchmove', (e) => {
    if (hoverLocked || pointerDownOnTrack) return;

    let pointer = getPointer(e);

    hoverPointerX = pointer.clientX - canvas.getBoundingClientRect().left;
});

function resetHover() {
    hoverPointerX = 0;
    tangentPoint = null;
    tangentPointPre = null;
};

addEvent([canvas, window], 'mouseleave touchend', () => {
    if (hoverLocked) return;
    resetHover();
});

addEvent(canvas, 'click', () => {
    hoverLocked = !hoverLocked;

    if (!hoverLocked) resetHover();
});

// track
addEvent(thumb, 'mousedown touchstart', (e) => {
    let pointer = getPointer(e);
    pointerDownOnTrack = pointer.clientX;
});

addEvent(window, 'mousemove touchmove', (e) => {
    if (!pointerDownOnTrack) return;

    let pointer = getPointer(e);
    let moved = (pointer.clientX - pointerDownOnTrack) / size.width;

    pointerDownOnTrack = pointer.clientX;
    endOffset = Math.min(1 - thumbWidth, Math.max(0, endOffset - moved));
});

addEvent(window, 'mouseup touchend blur', () => {
    pointerDownOnTrack = undefined;
});

addEvent(thumb, 'click touchstart', (e) => {
    e.stopPropagation();
});

addEvent(track, 'click touchstart', (e) => {
    let pointer = getPointer(e);
    let rect = track.getBoundingClientRect();
    let offset = (pointer.clientX - rect.left) / rect.width;
    endOffset = Math.min(1 - thumbWidth, Math.max(0, 1 - (offset + thumbWidth / 2)));
});
