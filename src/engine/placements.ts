import { type PieceId, type Pose, ROWS, spawnPose } from "./pieces";
import {
  type Board,
  bumpiness,
  cellsOf,
  clearRows,
  columnHeights,
  countHoles,
  deepestWell,
  fits,
  rotated,
  stamp,
} from "./rules";

export interface Placement {
  id: string;
  usesHold: boolean;
  piece: PieceId;
  rot: number;
  x: number;
  y: number;
  path: Pose[];
  linesCleared: number;
  holesAfter: number;
  maxHeightAfter: number;
  bumpinessAfter: number;
  wellAfter: number;
  skyline: number[];
  columns: [number, number];
  lowestRowFromBottom: number;
}

export interface DecideInput {
  board: Board;
  active: PieceId;
  hold: PieceId | null;
  queue: PieceId[];
  canHold: boolean;
  lines: number;
}

interface Node {
  pose: Pose;
  prev: number;
  depth: number;
}

function poseKey(pose: Pose): string {
  return `${pose.rot}:${pose.x}:${pose.y}`;
}

function cellKey(pose: Pose): string {
  return cellsOf(pose)
    .map((cell) => `${cell.x},${cell.y}`)
    .sort()
    .join("|");
}

function pathFrom(nodes: Node[], index: number): Pose[] {
  const path: Pose[] = [];
  let cursor = index;
  while (cursor >= 0) {
    const node = nodes[cursor];
    if (!node) break;
    path.push(node.pose);
    cursor = node.prev;
  }
  path.reverse();
  return path;
}

function measure(board: Board, pose: Pose, usesHold: boolean, path: Pose[]): Placement {
  const cleared = clearRows(stamp(board, pose));
  const heights = columnHeights(cleared.board);
  const xs = cellsOf(pose).map((cell) => cell.x);
  const ys = cellsOf(pose).map((cell) => cell.y);
  return {
    id: `${usesHold ? "hold" : "play"}_${pose.piece}_r${pose.rot}_x${pose.x}_y${pose.y}`,
    usesHold,
    piece: pose.piece,
    rot: pose.rot,
    x: pose.x,
    y: pose.y,
    path,
    linesCleared: cleared.rows.length,
    holesAfter: countHoles(cleared.board),
    maxHeightAfter: Math.max(...heights),
    bumpinessAfter: bumpiness(heights),
    wellAfter: deepestWell(heights),
    skyline: heights,
    columns: [Math.min(...xs) + 1, Math.max(...xs) + 1],
    lowestRowFromBottom: ROWS - Math.max(...ys),
  };
}

export function enumeratePlacements(board: Board, piece: PieceId, usesHold: boolean): Placement[] {
  const start = spawnPose(piece);
  if (!fits(board, start)) return [];

  const nodes: Node[] = [{ pose: start, prev: -1, depth: 0 }];
  const seen = new Set<string>([poseKey(start)]);
  const queue = [0];
  let head = 0;

  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    if (index === undefined) break;
    const node = nodes[index];
    if (!node) break;
    const pose = node.pose;
    const candidates: Pose[] = [];
    const down: Pose = { ...pose, y: pose.y + 1 };
    const left: Pose = { ...pose, x: pose.x - 1 };
    const right: Pose = { ...pose, x: pose.x + 1 };
    if (fits(board, down)) candidates.push(down);
    if (fits(board, left)) candidates.push(left);
    if (fits(board, right)) candidates.push(right);
    if (piece !== "O") {
      const clockwise = rotated(board, pose, 1);
      const counter = rotated(board, pose, -1);
      if (clockwise) candidates.push(clockwise);
      if (counter) candidates.push(counter);
    }
    for (const next of candidates) {
      const key = poseKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ pose: next, prev: index, depth: node.depth + 1 });
      queue.push(nodes.length - 1);
    }
  }

  const best = new Map<string, number>();
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (!node) continue;
    if (fits(board, { ...node.pose, y: node.pose.y + 1 })) continue;
    const signature = cellKey(node.pose);
    const current = best.get(signature);
    if (current === undefined || node.depth < (nodes[current]?.depth ?? Number.POSITIVE_INFINITY)) {
      best.set(signature, index);
    }
  }

  const placements: Placement[] = [];
  for (const index of best.values()) {
    const node = nodes[index];
    if (!node) continue;
    placements.push(measure(board, node.pose, usesHold, pathFrom(nodes, index)));
  }
  placements.sort((a, b) => a.id.localeCompare(b.id));
  return placements;
}

export function legalPlacements(input: DecideInput): Placement[] {
  const direct = enumeratePlacements(input.board, input.active, false);
  if (!input.canHold) return direct;
  const swapped = input.hold ?? input.queue[0];
  if (!swapped) return direct;
  return [...direct, ...enumeratePlacements(input.board, swapped, true)];
}
