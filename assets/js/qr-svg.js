// Self-authored MIT zero-dependency ISO/IEC 18004 QR Code Byte-Mode SVG encoder.
// Supports Versions 1–10 at Error Correction Level M (up to 213 UTF-8 bytes),
// with automatic fallback to Level L at Version 10 (up to 271 UTF-8 bytes).

const SVG_NS = 'http://www.w3.org/2000/svg';

// GF(256) with ISO/IEC 18004 primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

const RS_POLY_CACHE = new Map();

function rsGeneratorPoly(degree) {
  let poly = RS_POLY_CACHE.get(degree);
  if (poly) return poly;
  poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  RS_POLY_CACHE.set(degree, poly);
  return poly;
}

function rsRemainder(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

// Alignment pattern center coordinates for Versions 1–10 (ISO/IEC 18004 Annex E).
const ALIGNMENT_COORDS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// ISO/IEC 18004 Table 9 block specs: [version, ecLevelBits, ecPerBlock, [[blockCount, dataPerBlock], ...]]
// Format info EC level bits: M = 0b00 (0), L = 0b01 (1).
const VERSION_SPECS = [
  { version: 1, level: 'M', ecFormatBits: 0b00, ecPerBlock: 10, groups: [[1, 16]] },
  { version: 2, level: 'M', ecFormatBits: 0b00, ecPerBlock: 16, groups: [[1, 28]] },
  { version: 3, level: 'M', ecFormatBits: 0b00, ecPerBlock: 26, groups: [[1, 44]] },
  { version: 4, level: 'M', ecFormatBits: 0b00, ecPerBlock: 18, groups: [[2, 32]] },
  { version: 5, level: 'M', ecFormatBits: 0b00, ecPerBlock: 24, groups: [[2, 43]] },
  { version: 6, level: 'M', ecFormatBits: 0b00, ecPerBlock: 16, groups: [[4, 27]] },
  { version: 7, level: 'M', ecFormatBits: 0b00, ecPerBlock: 18, groups: [[4, 31]] },
  { version: 8, level: 'M', ecFormatBits: 0b00, ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  { version: 9, level: 'M', ecFormatBits: 0b00, ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  { version: 10, level: 'M', ecFormatBits: 0b00, ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
  { version: 10, level: 'L', ecFormatBits: 0b01, ecPerBlock: 18, groups: [[2, 68], [2, 69]] },
];

function totalDataCodewords(spec) {
  let sum = 0;
  for (const [count, dataLen] of spec.groups) {
    sum += count * dataLen;
  }
  return sum;
}

function byteModeCountBits(version) {
  return version >= 10 ? 16 : 8;
}

function selectSpec(byteLength) {
  for (const spec of VERSION_SPECS) {
    const capBits = totalDataCodewords(spec) * 8;
    const neededBits = 4 + byteModeCountBits(spec.version) + byteLength * 8;
    if (neededBits <= capBits) return spec;
  }
  throw new RangeError(`QR input exceeds maximum supported length (${byteLength} UTF-8 bytes; max 271).`);
}

function buildDataCodewords(bytes, spec) {
  const totalData = totalDataCodewords(spec);
  const totalBits = totalData * 8;
  const bits = [];

  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  // Byte mode indicator (0100) + character count + raw UTF-8 bytes
  pushBits(0b0100, 4);
  pushBits(bytes.length, byteModeCountBits(spec.version));
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const termLen = Math.min(4, totalBits - bits.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalData);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    codewords[byteIdx++] = b;
  }

  // Alternating pad bytes 0xEC, 0x11
  let toggle = true;
  while (byteIdx < totalData) {
    codewords[byteIdx++] = toggle ? 0xec : 0x11;
    toggle = !toggle;
  }

  return codewords;
}

function buildFinalCodewords(dataCodewords, spec) {
  const blocks = [];
  let offset = 0;
  let maxDataLen = 0;

  for (const [count, dataLen] of spec.groups) {
    if (dataLen > maxDataLen) maxDataLen = dataLen;
    for (let i = 0; i < count; i++) {
      const data = dataCodewords.subarray(offset, offset + dataLen);
      offset += dataLen;
      const ec = rsRemainder(data, spec.ecPerBlock);
      blocks.push({ data, ec });
    }
  }

  const result = [];
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) result.push(block.data[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of blocks) {
      result.push(block.ec[i]);
    }
  }
  return new Uint8Array(result);
}

// 15-bit BCH(15, 5) format info with generator 0x537 and mask 0x5412.
function computeFormatBits(ecFormatBits, mask) {
  const data = (ecFormatBits << 3) | mask;
  let rem = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((rem >>> (i + 10)) & 1) {
      rem ^= 0x537 << i;
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

// 18-bit BCH(18, 6) version info with generator 0x1F25 (for Versions 7+).
function computeVersionBits(version) {
  let rem = version << 12;
  for (let i = 5; i >= 0; i--) {
    if ((rem >>> (i + 12)) & 1) {
      rem ^= 0x1f25 << i;
    }
  }
  return (version << 12) | rem;
}

function placeFunctionPatterns(version) {
  const size = 4 * version + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  const setFn = (r, c, val) => {
    modules[r][c] = val;
    isFunction[r][c] = true;
  };

  // Finder patterns + 1-module white separators
  const drawFinder = (top, left) => {
    for (let dr = -1; dr <= 7; dr++) {
      const r = top + dr;
      if (r < 0 || r >= size) continue;
      for (let dc = -1; dc <= 7; dc++) {
        const c = left + dc;
        if (c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFn(r, c, inOuter && (onBorder || inCenter));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFn(6, i, dark);
    setFn(i, 6, dark);
  }

  // Alignment patterns
  const coords = ALIGNMENT_COORDS[version];
  const lastIdx = coords.length - 1;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === lastIdx) || (i === lastIdx && j === 0)) {
        continue;
      }
      const cr = coords[i];
      const cc = coords[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(cr + dr, cc + dc, dist === 2 || dist === 0);
        }
      }
    }
  }

  // Dark module at (4*V + 9, 8)
  setFn(4 * version + 9, 8, true);

  // Reserve format info strips (values written after mask selection)
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8][i] = true;
  }
  for (let i = size - 7; i < size; i++) {
    isFunction[i][8] = true;
  }

  // Version info blocks (Versions 7+)
  if (version >= 7) {
    const vBits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  return { size, modules, isFunction };
}

function writeFormatInfo(modules, ecFormatBits, mask) {
  const size = modules.length;
  const bits = computeFormatBits(ecFormatBits, mask);
  const bitAt = idx => ((bits >>> idx) & 1) === 1;

  // Copy 1 around top-left finder
  const copy1Coords = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = copy1Coords[i];
    modules[r][c] = bitAt(i);
  }

  // Copy 2 beside bottom-left and below top-right finders
  for (let i = 0; i < 8; i++) {
    modules[8][size - 1 - i] = bitAt(i);
  }
  for (let i = 8; i < 15; i++) {
    modules[size - 15 + i][8] = bitAt(i);
  }
}

function placeDataCodewords(modules, isFunction, codewords) {
  const size = modules.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const col = right - dx;
        if (isFunction[row][col]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >>> 3];
          dark = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
        modules[row][col] = dark;
      }
    }
    upward = !upward;
  }
}

const MASK_PREDICATES = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(baseModules, isFunction, mask) {
  const size = baseModules.length;
  const pred = MASK_PREDICATES[mask];
  const out = Array.from({ length: size }, (_, r) => {
    const src = baseModules[r];
    const fnRow = isFunction[r];
    const row = Array(size);
    for (let c = 0; c < size; c++) {
      row[c] = fnRow[c] ? src[c] : pred(r, c) ? !src[c] : src[c];
    }
    return row;
  });
  return out;
}

function evaluatePenalty(modules) {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive modules of same colour in row or column
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same colour
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 3: Finder-like 1:1:3:1:1 patterns with 4 light modules on either side
  const isFinderLike = (getBit, start) => {
    const p1 =
      getBit(start) && !getBit(start + 1) && getBit(start + 2) &&
      getBit(start + 3) && getBit(start + 4) && !getBit(start + 5) &&
      getBit(start + 6) && !getBit(start + 7) && !getBit(start + 8) &&
      !getBit(start + 9) && !getBit(start + 10);
    const p2 =
      !getBit(start) && !getBit(start + 1) && !getBit(start + 2) &&
      !getBit(start + 3) && getBit(start + 4) && !getBit(start + 5) &&
      getBit(start + 6) && getBit(start + 7) && getBit(start + 8) &&
      !getBit(start + 9) && getBit(start + 10);
    return p1 || p2;
  };
  for (let r = 0; r < size; r++) {
    const row = modules[r];
    for (let c = 0; c <= size - 11; c++) {
      if (isFinderLike(idx => row[idx], c)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 11; r++) {
      if (isFinderLike(idx => modules[idx][c], r)) penalty += 40;
    }
  }

  // Rule 4: Dark/light balance
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) darkCount++;
    }
  }
  const total = size * size;
  const deviation = Math.floor(Math.abs(darkCount * 20 - total * 10) / total);
  penalty += deviation * 10;

  return penalty;
}

/**
 * Encode UTF-8 text into a 2D boolean QR Code matrix (true = dark module).
 * @param {string} text
 * @returns {boolean[][]}
 */
export function encodeQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  const spec = selectSpec(bytes.length);
  const dataCodewords = buildDataCodewords(bytes, spec);
  const finalCodewords = buildFinalCodewords(dataCodewords, spec);

  const { modules: base, isFunction } = placeFunctionPatterns(spec.version);
  placeDataCodewords(base, isFunction, finalCodewords);

  let bestMatrix = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, isFunction, mask);
    writeFormatInfo(candidate, spec.ecFormatBits, mask);
    const penalty = evaluatePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  }

  return bestMatrix;
}

function buildModulePath(matrix, quietZone) {
  const size = matrix.length;
  const segments = [];
  for (let r = 0; r < size; r++) {
    const row = matrix[r];
    let c = 0;
    while (c < size) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < size && row[c]) c++;
      const run = c - start;
      segments.push(`M${start + quietZone} ${r + quietZone}h${run}v1h-${run}z`);
    }
  }
  return segments.join('');
}

/**
 * Render an accessible, scannable <svg> QR Code with a crisp 4-module white quiet zone
 * and pure black modules (never inverted in Dark or High Contrast modes).
 *
 * @param {string} text
 * @param {{ label?: string, quietZone?: number }} [options]
 * @returns {SVGSVGElement}
 */
export function renderQrSvg(text, options = {}) {
  const { label = `QR code for ${text}`, quietZone = 4 } = options;
  const matrix = encodeQrMatrix(text);
  const total = matrix.length + quietZone * 2;
  const pathData = buildModulePath(matrix, quietZone);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('width', '240');
  svg.setAttribute('height', '240');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('kiosk-qr-svg');

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(total));
  bg.setAttribute('height', String(total));
  bg.setAttribute('fill', '#ffffff');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', '#000000');

  svg.append(bg, path);
  return svg;
}
