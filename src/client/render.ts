import { COLORS, COLS, HIDDEN_ROWS, type PieceId, type Pose, ROWS } from "../engine/pieces";
import { type Board, cellsOf } from "../engine/rules";

export interface Frame {
  board: Board;
  active: Pose | null;
  ghost: Pose | null;
  row: number | null;
  clearRows: number[];
  flash: number;
  highlight: number[];
  thinking: boolean;
  now: number;
}

function mix(hex: string, toward: string, amount: number): string {
  const channels = (color: string) => {
    const value = Number.parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
  };
  const [r1, g1, b1] = channels(hex);
  const [r2, g2, b2] = channels(toward);
  const blend = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return `rgb(${blend(r1, r2)} ${blend(g1, g2)} ${blend(b1, b2)})`;
}

function cellColor(piece: PieceId, flashing: boolean, flash: number): string {
  if (!flashing) return COLORS[piece];
  return mix(COLORS[piece], "#fff6e4", Math.min(1, flash));
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void {
  const pad = Math.max(1, size * 0.08);
  const radius = Math.max(3, size * 0.18);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, radius);
  const gradient = ctx.createLinearGradient(0, y, 0, y + size);
  gradient.addColorStop(0, mix(color, "#ffffff", 0.28));
  gradient.addColorStop(0.48, color);
  gradient.addColorStop(1, mix(color, "#140e0c", 0.28));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  cell: number,
  originRow: number,
  alpha: number,
  color: string,
): void {
  const delta = originRow - pose.y;
  for (const block of cellsOf(pose)) {
    drawCell(ctx, block.x * cell, (block.y + delta) * cell, cell, color, alpha);
  }
}

export function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: Frame,
): void {
  const cell = width / COLS;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c0b0d";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(240, 193, 77, 0.07)";
  for (const column of frame.highlight) {
    ctx.fillRect(column * cell, 0, cell, height);
  }

  const clearing = new Set(frame.clearRows);
  for (let y = 0; y < ROWS; y++) {
    const row = frame.board[y];
    if (!row) continue;
    for (let x = 0; x < COLS; x++) {
      const piece = row[x];
      if (!piece) continue;
      drawCell(ctx, x * cell, y * cell, cell, cellColor(piece, clearing.has(y), frame.flash), 1);
    }
  }

  ctx.strokeStyle = "rgba(244, 239, 232, 0.045)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, height);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(width, y * cell + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(244, 239, 232, 0.28)";
  ctx.beginPath();
  ctx.moveTo(8, HIDDEN_ROWS * cell + 0.5);
  ctx.lineTo(width - 8, HIDDEN_ROWS * cell + 0.5);
  ctx.stroke();

  if (frame.ghost && frame.active) {
    const ghostColor = COLORS[frame.ghost.piece];
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const block of cellsOf(frame.ghost)) {
      const pad = Math.max(1, cell * 0.12);
      ctx.strokeStyle = ghostColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(block.x * cell + pad, block.y * cell + pad, cell - pad * 2, cell - pad * 2, 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (frame.active) {
    const pulse = frame.thinking ? 0.72 + Math.sin(frame.now / 280) * 0.28 : 1;
    const row = frame.row ?? frame.active.y;
    drawPiece(ctx, frame.active, cell, row, pulse, COLORS[frame.active.piece]);
  }
}
