import { describe, expect, it } from "vitest";
import { canDecode, createFullBoard, makeStartingBoard, playableIndices } from "./game";

describe("QR Jenga board", () => {
  it("starts from a readable QR code", () => {
    const board = createFullBoard();
    expect(board.size).toBe(25);
    expect(canDecode(board)).toBe(true);
  });

  it("creates readable calibrated boards for every difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const board = makeStartingBoard(difficulty, 12345);
      expect(canDecode(board)).toBe(true);
      expect(board.removed.size).toBeGreaterThan(0);
      expect(playableIndices(board).length).toBeGreaterThan(0);
    }
  });

  it("shortens the safety margin as difficulty rises", () => {
    const easy = makeStartingBoard("easy", 20260930);
    const normal = makeStartingBoard("normal", 20260930);
    const hard = makeStartingBoard("hard", 20260930);
    expect(easy.removed.size).toBeLessThan(normal.removed.size);
    expect(normal.removed.size).toBeLessThan(hard.removed.size);
  });
});
