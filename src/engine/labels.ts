import type { PieceId } from "./pieces";
import type { Placement } from "./placements";

const ORIENTATION: Record<PieceId, readonly string[]> = {
  I: ["horizontal", "vertical", "horizontal", "vertical"],
  O: ["square", "square", "square", "square"],
  T: ["stem up", "stem right", "stem down", "stem left"],
  S: ["flat", "upright", "flat", "upright"],
  Z: ["flat", "upright", "flat", "upright"],
  J: ["flat, nub left", "upright, nub right", "flat, nub right", "upright, nub left"],
  L: ["flat, nub right", "upright, nub right", "flat, nub left", "upright, nub left"],
};

export function placementLabel(placement: Placement): string {
  const orientation = ORIENTATION[placement.piece][placement.rot] ?? "";
  const columns =
    placement.columns[0] === placement.columns[1]
      ? `column ${placement.columns[0]}`
      : `columns ${placement.columns[0]}–${placement.columns[1]}`;
  const lines =
    placement.linesCleared === 0
      ? "no line"
      : placement.linesCleared === 1
        ? "1 line"
        : placement.linesCleared === 4
          ? "tetris"
          : `${placement.linesCleared} lines`;
  const prefix = placement.usesHold ? "Hold, then " : "";
  return `${prefix}${placement.piece} ${orientation}, ${columns}, ${lines}`;
}

export function pressureLabel(score: number): string {
  if (score < 0.75) return "Board: open";
  if (score < 1.5) return "Board: built up";
  if (score < 2.25) return "Board: tight";
  return "Board: nearly full";
}

export function clearLabel(count: number): string {
  if (count === 1) return "One line";
  if (count === 4) return "Tetris";
  return `${count} lines`;
}
