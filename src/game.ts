import QRCode from "qrcode";
import jsQR from "jsqr";

export type Difficulty = "easy" | "normal" | "hard";
export type Cell = { x: number; y: number };

export interface GameBoard {
  size: number;
  cells: boolean[];
  protectedCells: boolean[];
  removed: Set<number>;
  payload: string;
}

// Keep matches short: these are the safe cells restored after calibrating to failure.
const BUFFER: Record<Difficulty, number> = { easy: 6, normal: 4, hard: 2 };

function protectFunctionalPatterns(size: number, x: number, y: number) {
  const finder =
    (x <= 8 && y <= 8) ||
    (x >= size - 8 && y <= 8) ||
    (x <= 8 && y >= size - 8);
  const timingAndFormat = x === 6 || y === 6 || x === 8 || y === 8;
  // Version 2 has one non-finder alignment pattern near the bottom-right.
  const alignmentCenter = size - 7;
  const alignment = Math.abs(x - alignmentCenter) <= 2 && Math.abs(y - alignmentCenter) <= 2;
  return finder || timingAndFormat || alignment;
}

export function createFullBoard(payload = "GAME OVER"): GameBoard {
  const qr = QRCode.create(payload, { version: 2, errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const cells = Array.from(qr.modules.data, Boolean);
  const protectedCells = cells.map((_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    return protectFunctionalPatterns(size, x, y);
  });
  return { size, cells, protectedCells, removed: new Set(), payload };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: number) {
  const result = [...items];
  const random = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pixelsFor(board: GameBoard, scale: number) {
  const quiet = 4;
  const side = (board.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  data.fill(255);
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size; x += 1) {
      const index = y * board.size + x;
      if (!board.cells[index] || board.removed.has(index)) continue;
      for (let py = (y + quiet) * scale; py < (y + quiet + 1) * scale; py += 1) {
        for (let px = (x + quiet) * scale; px < (x + quiet + 1) * scale; px += 1) {
          const offset = (py * side + px) * 4;
          data[offset] = 18;
          data[offset + 1] = 18;
          data[offset + 2] = 18;
          data[offset + 3] = 255;
        }
      }
    }
  }
  return { data, side };
}

export function canDecode(board: GameBoard) {
  return [5, 7, 9].some((scale) => {
    const { data, side } = pixelsFor(board, scale);
    return jsQR(data, side, side, { inversionAttempts: "dontInvert" })?.data === board.payload;
  });
}

export function playableIndices(board: GameBoard) {
  return board.cells
    .map((black, index) => ({ black, index }))
    .filter(({ black, index }) => black && !board.protectedCells[index] && !board.removed.has(index))
    .map(({ index }) => index);
}

export function makeStartingBoard(difficulty: Difficulty, seed = Date.now()) {
  const board = createFullBoard();
  const path = shuffled(playableIndices(board), seed);
  const safelyRemoved: number[] = [];

  for (const index of path) {
    board.removed.add(index);
    if (!canDecode(board)) {
      board.removed.delete(index);
      break;
    }
    safelyRemoved.push(index);
  }

  const restoreCount = Math.min(BUFFER[difficulty], safelyRemoved.length);
  safelyRemoved.slice(-restoreCount).forEach((index) => board.removed.delete(index));
  return board;
}

export function cellFromIndex(board: GameBoard, index: number): Cell {
  return { x: index % board.size, y: Math.floor(index / board.size) };
}
