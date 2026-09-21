import { COLS, I_KICKS, JLSTZ_KICKS, type PieceId, type Pose, ROWS, SHAPES } from "./pieces";

export type Cell = PieceId | null;
export type Board = Cell[][];

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

export function cellsOf(pose: Pose): { x: number; y: number }[] {
  const shape = SHAPES[pose.piece][pose.rot];
  if (!shape) return [];
  return shape.map(([row, col]) => ({ x: pose.x + col, y: pose.y + row }));
}

export function fits(board: Board, pose: Pose): boolean {
  for (const cell of cellsOf(pose)) {
    if (cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS) return false;
    if (board[cell.y]?.[cell.x]) return false;
  }
  return cellsOf(pose).length > 0;
}

export function rotated(board: Board, pose: Pose, dir: 1 | -1): Pose | null {
  if (pose.piece === "O") return { ...pose };
  const from = pose.rot;
  const to = (from + dir + 4) % 4;
  const kicks = (pose.piece === "I" ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`];
  if (!kicks) return null;
  for (const [x, yUp] of kicks) {
    const next: Pose = { piece: pose.piece, rot: to, x: pose.x + x, y: pose.y - yUp };
    if (fits(board, next)) return next;
  }
  return null;
}

export function stamp(board: Board, pose: Pose): Board {
  const next = board.map((row) => row.slice());
  for (const cell of cellsOf(pose)) {
    const row = next[cell.y];
    if (!row) continue;
    row[cell.x] = pose.piece;
  }
  return next;
}

export function clearRows(board: Board): { board: Board; rows: number[] } {
  const rows: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y]?.every((cell) => cell !== null)) rows.push(y);
  }
  if (rows.length === 0) return { board, rows };
  const remove = new Set(rows);
  const kept = board.filter((_, y) => !remove.has(y));
  const blanks = rows.map(() => Array<Cell>(COLS).fill(null));
  return { board: [...blanks, ...kept], rows };
}

export function lockPiece(board: Board, pose: Pose): { board: Board; cleared: number[] } {
  const cleared = clearRows(stamp(board, pose));
  return { board: cleared.board, cleared: cleared.rows };
}

export function columnHeights(board: Board): number[] {
  const heights: number[] = [];
  for (let x = 0; x < COLS; x++) {
    let height = 0;
    for (let y = 0; y < ROWS; y++) {
      if (board[y]?.[x]) {
        height = ROWS - y;
        break;
      }
    }
    heights.push(height);
  }
  return heights;
}

export function countHoles(board: Board): number {
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let covered = false;
    for (let y = 0; y < ROWS; y++) {
      if (board[y]?.[x]) covered = true;
      else if (covered) holes += 1;
    }
  }
  return holes;
}

export function bumpiness(heights: number[]): number {
  let total = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    total += Math.abs((heights[i] ?? 0) - (heights[i + 1] ?? 0));
  }
  return total;
}

export function deepestWell(heights: number[]): number {
  let best = 0;
  for (let i = 0; i < heights.length; i++) {
    const left = i > 0 ? (heights[i - 1] ?? 0) : (heights[i] ?? 0);
    const right = i < heights.length - 1 ? (heights[i + 1] ?? 0) : (heights[i] ?? 0);
    const lip = i === 0 ? right : i === heights.length - 1 ? left : Math.min(left, right);
    best = Math.max(best, lip - (heights[i] ?? 0));
  }
  return Math.max(0, best);
}

export function boardRows(board: Board): string[] {
  return board.map((row) => row.map((cell) => cell ?? ".").join(""));
}
