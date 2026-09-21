import { PIECE_IDS, type PieceId, type Pose } from "./pieces";
import type { DecideInput, Placement } from "./placements";
import { type Board, emptyBoard, fits, lockPiece, stamp } from "./rules";

export interface Game {
  board: Board;
  active: PieceId;
  queue: PieceId[];
  hold: PieceId | null;
  canHold: boolean;
  score: number;
  lines: number;
}

const LINE_POINTS = [0, 100, 300, 500, 800];

export function levelFor(lines: number): number {
  return 1 + Math.floor(lines / 10);
}

export function pointsFor(cleared: number, level: number): number {
  return (LINE_POINTS[cleared] ?? 0) * level;
}

export function refill(queue: PieceId[], rng: () => number, minimum: number): PieceId[] {
  const next = queue.slice();
  while (next.length < minimum) {
    const bag = PIECE_IDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const swap = bag[i];
      bag[i] = bag[j] ?? bag[i] ?? "I";
      bag[j] = swap ?? bag[j] ?? "I";
    }
    next.push(...bag);
  }
  return next;
}

export function createGame(rng: () => number = Math.random): Game {
  const dealt = refill([], rng, 6);
  const active = dealt.shift();
  if (!active) throw new Error("empty queue");
  return {
    board: emptyBoard(),
    active,
    queue: dealt,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
  };
}

export function snapshot(game: Game): DecideInput {
  return {
    board: game.board,
    active: game.active,
    hold: game.hold,
    queue: game.queue.slice(0, 5),
    canHold: game.canHold,
    lines: game.lines,
  };
}

export function poseOf(placement: Placement): Pose {
  return { piece: placement.piece, rot: placement.rot, x: placement.x, y: placement.y };
}

export function commitPlacement(
  game: Game,
  placement: Placement,
  rng: () => number,
): { game: Game; cleared: number[]; stamped: Board } {
  let hold = game.hold;
  let queue = game.queue.slice();
  let piece = game.active;

  if (placement.usesHold) {
    if (!game.canHold) throw new Error("illegal");
    if (hold === null) {
      const swapped = queue.shift();
      if (!swapped || swapped !== placement.piece) throw new Error("illegal");
      hold = game.active;
      piece = swapped;
    } else {
      if (hold !== placement.piece) throw new Error("illegal");
      hold = game.active;
      piece = placement.piece;
    }
  } else if (placement.piece !== game.active) {
    throw new Error("illegal");
  }

  const pose = poseOf({ ...placement, piece });
  if (!fits(game.board, pose)) throw new Error("illegal");
  const stamped = stamp(game.board, pose);
  const locked = lockPiece(game.board, pose);
  const lines = game.lines + locked.cleared.length;
  const score = game.score + pointsFor(locked.cleared.length, levelFor(game.lines));
  queue = refill(queue, rng, 1);
  const active = queue.shift();
  if (!active) throw new Error("empty queue");
  return {
    stamped,
    cleared: locked.cleared,
    game: {
      board: locked.board,
      active,
      queue: refill(queue, rng, 5),
      hold,
      canHold: true,
      score,
      lines,
    },
  };
}
