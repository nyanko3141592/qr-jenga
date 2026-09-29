import { describe, expect, it } from "vitest";
import { canDecode, createFullBoard, makeStartingBoard, playableIndices } from "./game";

describe("QR Jenga board", () => {
  it("starts from a readable QR code", () => {
    expect(canDecode(createFullBoard())).toBe(true);
  });

  it("creates readable calibrated boards for every difficulty", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const board = makeStartingBoard(difficulty, 12345);
      expect(canDecode(board)).toBe(true);
      expect(board.removed.size).toBeGreaterThan(0);
      expect(playableIndices(board).length).toBeGreaterThan(0);
    }
  });
});
