import QRCode from "qrcode";
import jsQR from "jsqr";

export type Difficulty = "easy" | "normal" | "hard";
export const PLAY_GRID_SIZE = 10;

export interface GameBoard {
  size: number;
  cells: boolean[];
  protectedCells: boolean[];
  removed: Set<number>;
  payload: string;
}

// Keep matches short: these are the safe cells restored after calibrating to failure.
const BUFFER: Record<Difficulty, number> = { easy: 5, normal: 3, hard: 1 };

function protectFunctionalPatterns(size: number, x: number, y: number) {
  const finder =
    (x <= 8 && y <= 8) ||
    (x >= size - 8 && y <= 8) ||
    (x <= 8 && y >= size - 8);
  const timingAndFormat = x === 6 || y === 6 || x === 8 || y === 8;
  // Version 1 has no alignment pattern; keep this valid if a larger QR is used later.
  const alignmentCenter = size - 7;
  const alignment = size > 21 && Math.abs(x - alignmentCenter) <= 2 && Math.abs(y - alignmentCenter) <= 2;
  return finder || timingAndFormat || alignment;
}

export function createFullBoard(payload = "BOOM!"): GameBoard {
  const qr = QRCode.create(payload, { version: 1, errorCorrectionLevel: "H" });
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

export function tileCellIndices(board: GameBoard, tileIndex: number) {
  const tileX = tileIndex % PLAY_GRID_SIZE;
  const tileY = Math.floor(tileIndex / PLAY_GRID_SIZE);
  const xStart = Math.floor(tileX * board.size / PLAY_GRID_SIZE);
  const xEnd = Math.floor((tileX + 1) * board.size / PLAY_GRID_SIZE);
  const yStart = Math.floor(tileY * board.size / PLAY_GRID_SIZE);
  const yEnd = Math.floor((tileY + 1) * board.size / PLAY_GRID_SIZE);
  const indices: number[] = [];
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) indices.push(y * board.size + x);
  }
  return indices;
}

export function removableIndicesForTile(board: GameBoard, tileIndex: number) {
  return tileCellIndices(board, tileIndex).filter((index) =>
    board.cells[index] && !board.protectedCells[index] && !board.removed.has(index));
}

export function playableTiles(board: GameBoard) {
  return Array.from({ length: PLAY_GRID_SIZE ** 2 }, (_, index) => index)
    .filter((index) => removableIndicesForTile(board, index).length > 0);
}

export function removeTile(board: GameBoard, tileIndex: number) {
  const removed = removableIndicesForTile(board, tileIndex);
  removed.forEach((index) => board.removed.add(index));
  return removed;
}

export function makeStartingBoard(difficulty: Difficulty, seed = Date.now()) {
  const board = createFullBoard();
  const path = shuffled(playableTiles(board), seed);
  const safelyRemoved: number[][] = [];

  for (const tileIndex of path) {
    const changed = removeTile(board, tileIndex);
    if (!canDecode(board)) {
      changed.forEach((index) => board.removed.delete(index));
      break;
    }
    safelyRemoved.push(changed);
  }

  const restoreCount = Math.min(BUFFER[difficulty], safelyRemoved.length);
  safelyRemoved.slice(-restoreCount).flat().forEach((index) => board.removed.delete(index));
  return board;
}
