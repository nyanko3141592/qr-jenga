import { describe, expect, it } from "vitest";
import { canDecode, createFullBoard, makeStartingBoard, playableIndices, playableTiles, removeTile, wouldTileBreak } from "./game";

describe("QR Jenga board", () => {
  it("starts from a readable QR code", () => {
    const board = createFullBoard();
    expect(board.size).toBe(21);
    expect(canDecode(board)).toBe(true);
  });

  it("creates readable calibrated boards for every difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const board = makeStartingBoard(difficulty, 12345);
      expect(canDecode(board)).toBe(true);
      expect(board.removed.size).toBeGreaterThan(0);
      expect(playableIndices(board).length).toBeGreaterThan(0);
      expect(playableTiles(board).length).toBeLessThanOrEqual(100);
    }
  });

  it("removes a group of QR modules with one 10x10 play tile", () => {
    const board = createFullBoard();
    const tile = playableTiles(board).find((index) => {
      const copy = createFullBoard();
      return removeTile(copy, index).length > 1;
    });
    expect(tile).toBeDefined();
    expect(removeTile(board, tile!).length).toBeGreaterThan(1);
  });

  it("can preview whether a play tile is fatal without mutating the board", () => {
    const board = makeStartingBoard("hard", 12345);
    const before = board.removed.size;
    playableTiles(board).forEach((tile) => expect(typeof wouldTileBreak(board, tile)).toBe("boolean"));
    expect(board.removed.size).toBe(before);
  });

  it("shortens the safety margin as difficulty rises", () => {
    const easy = makeStartingBoard("easy", 20260930);
    const normal = makeStartingBoard("normal", 20260930);
    const hard = makeStartingBoard("hard", 20260930);
    expect(easy.removed.size).toBeLessThan(normal.removed.size);
    expect(normal.removed.size).toBeLessThan(hard.removed.size);
  });
});
