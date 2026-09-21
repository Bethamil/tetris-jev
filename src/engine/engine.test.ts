import { describe, expect, it } from "vitest";
import { commitPlacement, createGame, levelFor, pointsFor, refill } from "./game";
import { COLS, type PieceId, ROWS, SHAPES, spawnPose } from "./pieces";
import { enumeratePlacements, legalPlacements } from "./placements";
import { type Board, cellsOf, countHoles, emptyBoard, fits, lockPiece, rotated } from "./rules";

function steady(): () => number {
  return () => 0.999;
}

function setCell(board: Board, y: number, x: number, piece: PieceId): void {
  const row = board[y];
  if (!row) throw new Error("row");
  row[x] = piece;
}

describe("bag", () => {
  it("deals seven distinct pieces before repeating", () => {
    const dealt = refill([], steady(), 7);
    expect(new Set(dealt).size).toBe(7);
    const game = createGame(steady());
    expect(game.active).toBe("I");
    expect(game.queue[0]).toBe("O");
  });
});

describe("placements", () => {
  it("finds the open-board landings for I and O", () => {
    expect(enumeratePlacements(emptyBoard(), "I", false)).toHaveLength(17);
    expect(enumeratePlacements(emptyBoard(), "O", false)).toHaveLength(9);
  });

  it("only offers resting in-bounds poses", () => {
    for (const placement of enumeratePlacements(emptyBoard(), "T", false)) {
      const pose = { piece: placement.piece, rot: placement.rot, x: placement.x, y: placement.y };
      expect(fits(emptyBoard(), pose)).toBe(true);
      expect(fits(emptyBoard(), { ...pose, y: pose.y + 1 })).toBe(false);
      expect(cellsOf(pose)).toHaveLength(4);
      for (const cell of cellsOf(pose)) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(COLS);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(ROWS);
      }
    }
  });

  it("rotates T in open space without shifting the box", () => {
    const turned = rotated(emptyBoard(), spawnPose("T"), 1);
    expect(turned).toMatchObject({ rot: 1, x: 3, y: 0 });
  });

  it("has no move when the spawn cells are blocked", () => {
    const board = emptyBoard();
    for (const [row, col] of SHAPES.T[0] ?? []) setCell(board, row, 3 + col, "I");
    expect(enumeratePlacements(board, "T", false)).toHaveLength(0);
  });

  it("includes the held piece when holding is allowed", () => {
    const game = createGame(steady());
    const moves = legalPlacements({
      board: game.board,
      active: game.active,
      hold: "S",
      queue: game.queue,
      canHold: true,
      lines: 0,
    });
    expect(moves.some((move) => move.usesHold && move.piece === "S")).toBe(true);
  });
});

describe("lines", () => {
  it("clears a tetris when a vertical I fills the last column", () => {
    const board = emptyBoard();
    for (let y = ROWS - 4; y < ROWS; y++) {
      for (let x = 0; x < COLS - 1; x++) setCell(board, y, x, "T");
    }
    const tetris = enumeratePlacements(board, "I", false).find((move) => move.linesCleared === 4);
    expect(tetris).toBeTruthy();
    const locked = lockPiece(board, {
      piece: "I",
      rot: tetris?.rot ?? 0,
      x: tetris?.x ?? 0,
      y: tetris?.y ?? 0,
    });
    expect(locked.cleared).toHaveLength(4);
    expect(locked.board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it("counts a covered empty cell as a hole", () => {
    const board = emptyBoard();
    setCell(board, ROWS - 1, 0, "I");
    setCell(board, ROWS - 3, 0, "I");
    expect(countHoles(board)).toBe(1);
  });

  it("scores a tetris at the level the stack was on", () => {
    expect(pointsFor(4, 1)).toBe(800);
    expect(pointsFor(4, 2)).toBe(1600);
    expect(levelFor(9)).toBe(1);
    expect(levelFor(10)).toBe(2);
  });
});

describe("commit", () => {
  it("plays the active piece and deals the next one", () => {
    const game = createGame(steady());
    const move = enumeratePlacements(game.board, game.active, false)[0];
    expect(move).toBeTruthy();
    if (!move) return;
    const result = commitPlacement(game, move, steady());
    expect(result.game.hold).toBeNull();
    expect(result.game.active).toBe("O");
    expect(result.game.canHold).toBe(true);
  });

  it("stores the active piece when the chosen move uses hold", () => {
    const game = createGame(steady());
    const move = legalPlacements({
      board: game.board,
      active: game.active,
      hold: null,
      queue: game.queue,
      canHold: true,
      lines: 0,
    }).find((item) => item.usesHold);
    expect(move?.piece).toBe("O");
    if (!move) return;
    const result = commitPlacement(game, move, steady());
    expect(result.game.hold).toBe("I");
    expect(result.game.active).toBe("T");
    expect(result.game.queue[0]).toBe("S");
  });
});
