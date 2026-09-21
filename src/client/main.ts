import { commitPlacement, createGame, type Game, levelFor, snapshot } from "../engine/game";
import { clearLabel, placementLabel, pressureLabel } from "../engine/labels";
import { COLORS, type PieceId, type Pose, SHAPES, spawnPose } from "../engine/pieces";
import type { Placement } from "../engine/placements";
import { cellsOf, fits } from "../engine/rules";
import type { Decision } from "../server/decide";
import { draw, type Frame } from "./render";

const canvas = must<HTMLCanvasElement>("well");
const ctx = canvas.getContext("2d") ?? failCanvas();

function failCanvas(): CanvasRenderingContext2D {
  throw new Error("canvas");
}

const statusEl = must<HTMLElement>("status");
const scoreEl = must<HTMLElement>("score");
const linesEl = must<HTMLElement>("lines");
const levelEl = must<HTMLElement>("level");
const holdEl = must<HTMLElement>("hold");
const nextEl = must<HTMLElement>("next");
const moveEl = must<HTMLElement>("move");
const confBar = must<HTMLElement>("conf-bar");
const confLabel = must<HTMLElement>("conf-label");
const pressureEl = must<HTMLElement>("pressure");
const modelEl = must<HTMLElement>("model");
const altsEl = must<HTMLElement>("alts");
const judgmentEl = must<HTMLElement>("judgment");
const errorEl = must<HTMLElement>("error");
const startBtn = must<HTMLButtonElement>("start");
const pauseBtn = must<HTMLButtonElement>("pause");
const restartBtn = must<HTMLButtonElement>("restart");

const ERRORS: Record<string, string> = {
  missing_api_key:
    "No API key. Set TYPESAFE_API_KEY in .env. The next attempt reads the file again.",
  rejected_key: "The API key was rejected. Check TYPESAFE_API_KEY in .env.",
  jev_failed: "Jev is unreachable right now. Try the move again.",
  unknown_choice: "Jev chose a move the game does not know. Try again.",
  bad_request: "The game sent a board the server could not read.",
  illegal: "That move no longer fits on the board.",
};

type Phase = "ready" | "thinking" | "animating" | "clearing" | "over" | "error";

const rng = Math.random;
let game = createGame(rng);
let generation = 0;
let paused = false;
let running = false;
let pulse = 0;

const view: Frame & {
  phase: Phase;
  hold: PieceId | null;
  queue: PieceId[];
  score: number;
  lines: number;
  level: number;
} = {
  board: game.board,
  active: spawnPose(game.active),
  ghost: null,
  row: null,
  clearRows: [],
  flash: 0,
  highlight: [],
  thinking: false,
  now: 0,
  phase: "ready",
  hold: null,
  queue: game.queue.slice(0, 5),
  score: 0,
  lines: 0,
  level: 1,
};

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing #${id}`);
  return element as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function reduceMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sync(next: Game): void {
  view.board = next.board;
  view.active = spawnPose(next.active);
  view.ghost = null;
  view.row = null;
  view.clearRows = [];
  view.flash = 0;
  view.highlight = [];
  view.hold = next.hold;
  view.queue = next.queue.slice(0, 5);
  view.score = next.score;
  view.lines = next.lines;
  view.level = levelFor(next.lines);
}

function statusText(): string {
  if (paused && running) return "Paused.";
  if (view.phase === "ready") return "Jev is waiting.";
  if (view.phase === "thinking") return "Jev is reading the board.";
  if (view.phase === "animating") return "Jev is placing the piece.";
  if (view.phase === "clearing") return "Clearing lines.";
  if (view.phase === "over") return "The board is full.";
  return "Jev cannot continue.";
}

function updateChrome(): void {
  statusEl.textContent = statusText();
  scoreEl.textContent = String(view.score);
  linesEl.textContent = String(view.lines);
  levelEl.textContent = String(view.level);
  holdEl.replaceChildren(mini(view.hold));
  nextEl.replaceChildren(...view.queue.slice(0, 5).map((piece) => mini(piece)));
  document.body.dataset.phase = view.phase;
  startBtn.disabled = running && view.phase !== "error";
  startBtn.textContent = view.phase === "error" ? "Try again" : "Let Jev play";
  pauseBtn.disabled = !running || view.phase === "over" || view.phase === "error";
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  paint();
}

function mini(piece: PieceId | null): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "mini-grid";
  const filled = new Set((piece ? SHAPES[piece][0] : []).map(([row, col]) => `${row},${col}`));
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cell = document.createElement("i");
      if (piece && filled.has(`${row},${col}`)) cell.style.background = COLORS[piece];
      grid.append(cell);
    }
  }
  return grid;
}

function showDecision(decision: Decision): void {
  const unsure = decision.confidence < 0.35;
  judgmentEl.classList.toggle("is-unsure", unsure);
  moveEl.textContent = placementLabel(decision.placement);
  confBar.style.width = `${Math.round(decision.confidence * 100)}%`;
  confLabel.textContent = unsure
    ? `Jev is unsure · ${Math.round(decision.confidence * 100)}%`
    : `Confidence ${Math.round(decision.confidence * 100)}%`;
  pressureEl.textContent = pressureLabel(decision.pressure.score);
  modelEl.textContent = decision.model;
  document.documentElement.style.setProperty(
    "--heat",
    String(Math.min(1, decision.pressure.score / 3)),
  );
  altsEl.replaceChildren(
    ...decision.alternatives.map((alternative) => {
      const item = document.createElement("li");
      if (alternative.chosen) item.classList.add("is-chosen");
      const label = document.createElement("span");
      label.textContent = alternative.label;
      const probability = document.createElement("em");
      probability.textContent = `${Math.round(alternative.probability * 100)}%`;
      item.append(label, probability);
      return item;
    }),
  );
}

function clearDecision(): void {
  judgmentEl.classList.remove("is-unsure");
  moveEl.textContent = "The first piece is ready.";
  confBar.style.width = "0";
  confLabel.textContent = "Confidence";
  pressureEl.textContent = "Board: open";
  modelEl.textContent = "";
  altsEl.replaceChildren();
  errorEl.textContent = "";
  document.documentElement.style.setProperty("--heat", "0");
}

function paint(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.now = performance.now();
  view.thinking = view.phase === "thinking" && !paused;
  draw(ctx, width, height, view);
}

function startPulse(): void {
  cancelAnimationFrame(pulse);
  const tick = (now: number) => {
    view.now = now;
    if (view.phase === "thinking") {
      paint();
      pulse = requestAnimationFrame(tick);
    }
  };
  pulse = requestAnimationFrame(tick);
}

async function fetchDecision(current: Game, signal: AbortSignal): Promise<Decision> {
  const response = await fetch("/api/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot(current)),
    signal,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("jev_failed");
  }
  if (!response.ok) {
    const code =
      typeof body === "object" && body && "error" in body && typeof body.error === "string"
        ? body.error
        : "jev_failed";
    throw new Error(code);
  }
  return body as Decision;
}

function columnsOf(placement: Placement): number[] {
  const pose = { piece: placement.piece, rot: placement.rot, x: placement.x, y: placement.y };
  return [...new Set(cellsOf(pose).map((cell) => cell.x))].sort((a, b) => a - b);
}

interface Step {
  kind: "step";
  pose: Pose;
}
interface Drop {
  kind: "drop";
  from: Pose;
  to: Pose;
}

function groupPath(path: Pose[]): Array<Step | Drop> {
  const groups: Array<Step | Drop> = [];
  let index = 0;
  while (index < path.length) {
    const pose = path[index];
    const next = path[index + 1];
    if (!pose) break;
    if (next && next.x === pose.x && next.rot === pose.rot && next.y > pose.y) {
      let end = next;
      let cursor = index + 1;
      while (cursor + 1 < path.length) {
        const current = path[cursor];
        const following = path[cursor + 1];
        if (
          current &&
          following &&
          following.x === current.x &&
          following.rot === current.rot &&
          following.y === current.y + 1
        ) {
          end = following;
          cursor += 1;
        } else break;
      }
      groups.push({ kind: "drop", from: pose, to: end });
      index = cursor + 1;
    } else {
      groups.push({ kind: "step", pose });
      index += 1;
    }
  }
  return groups;
}

async function waitWhilePaused(gen: number): Promise<void> {
  while (paused && gen === generation) await sleep(40);
}

async function animate(placement: Placement, gen: number): Promise<void> {
  if (placement.usesHold) {
    view.hold = game.active;
    if (game.hold === null) view.queue = game.queue.slice(1, 6);
    updateChrome();
  }
  const finalPose: Pose = {
    piece: placement.piece,
    rot: placement.rot,
    x: placement.x,
    y: placement.y,
  };
  view.ghost = finalPose;
  view.highlight = columnsOf(placement);
  view.phase = "animating";
  view.active = placement.path[0] ?? finalPose;
  view.row = null;
  updateChrome();
  if (reduceMotion()) {
    view.active = finalPose;
    paint();
    await sleep(60);
    return;
  }
  for (const group of groupPath(placement.path)) {
    if (gen !== generation) return;
    await waitWhilePaused(gen);
    if (group.kind === "step") {
      view.active = group.pose;
      view.row = null;
      paint();
      await sleep(34);
      continue;
    }
    const duration = Math.min(320, 18 * (group.to.y - group.from.y + 3));
    const start = performance.now();
    while (performance.now() - start < duration) {
      if (gen !== generation) return;
      await waitWhilePaused(gen);
      const t = Math.min(1, (performance.now() - start) / duration);
      view.active = group.from;
      view.row = group.from.y + (group.to.y - group.from.y) * t * t;
      paint();
      await nextFrame();
    }
    view.active = group.to;
    view.row = null;
    paint();
  }
}

async function flash(board: Game["board"], rows: number[], gen: number): Promise<void> {
  view.board = board;
  view.active = null;
  view.ghost = null;
  view.clearRows = rows;
  view.phase = "clearing";
  statusEl.textContent = clearLabel(rows.length);
  const duration = reduceMotion() ? 70 : 280;
  const start = performance.now();
  while (performance.now() - start < duration) {
    if (gen !== generation) return;
    await waitWhilePaused(gen);
    view.flash = Math.min(1, (performance.now() - start) / duration);
    paint();
    await nextFrame();
  }
}

async function loop(gen: number, signal: AbortSignal): Promise<void> {
  while (gen === generation) {
    await waitWhilePaused(gen);
    if (gen !== generation) return;
    if (!fits(game.board, spawnPose(game.active))) {
      view.phase = "over";
      view.active = null;
      running = false;
      updateChrome();
      return;
    }
    view.phase = "thinking";
    view.active = spawnPose(game.active);
    view.ghost = null;
    view.highlight = [];
    updateChrome();
    startPulse();
    let decision: Decision;
    try {
      decision = await fetchDecision(game, signal);
    } catch (error) {
      if (gen !== generation || signal.aborted) return;
      fail(error);
      return;
    }
    if (gen !== generation) return;
    await waitWhilePaused(gen);
    if (gen !== generation) return;
    showDecision(decision);
    try {
      await animate(decision.placement, gen);
      if (gen !== generation) return;
      const result = commitPlacement(game, decision.placement, rng);
      game = result.game;
      view.score = game.score;
      view.lines = game.lines;
      view.level = levelFor(game.lines);
      updateChrome();
      if (result.cleared.length > 0) await flash(result.stamped, result.cleared, gen);
      if (gen !== generation) return;
      sync(game);
      view.phase = "thinking";
      updateChrome();
    } catch (error) {
      if (gen !== generation) return;
      fail(error);
      return;
    }
  }
}

function fail(error: unknown): void {
  const code = error instanceof Error ? error.message : "jev_failed";
  if (code === "game_over") {
    view.phase = "over";
    errorEl.textContent = "";
  } else if (code === "aborted") {
    return;
  } else {
    view.phase = "error";
    errorEl.textContent = ERRORS[code] ?? ERRORS.jev_failed ?? "";
  }
  running = false;
  updateChrome();
}

function begin(): void {
  const gen = ++generation;
  const controller = new AbortController();
  paused = false;
  running = true;
  errorEl.textContent = "";
  void loop(gen, controller.signal).finally(() => {
    if (gen === generation) running = false;
    updateChrome();
  });
  activeAbort = controller;
}

let activeAbort: AbortController | null = null;

function restart(): void {
  activeAbort?.abort();
  generation += 1;
  paused = false;
  game = createGame(rng);
  sync(game);
  view.phase = "ready";
  clearDecision();
  running = false;
  updateChrome();
}

startBtn.addEventListener("click", () => {
  if (view.phase === "error" || !running) begin();
});

pauseBtn.addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
  updateChrome();
  if (!paused && view.phase === "thinking") startPulse();
});

restartBtn.addEventListener("click", restart);

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (!running || view.phase === "error")) {
    event.preventDefault();
    begin();
  } else if (event.key === "p" || event.key === "P") {
    pauseBtn.click();
  } else if (event.key === "r" || event.key === "R") {
    restart();
  }
});

new ResizeObserver(() => paint()).observe(canvas);
sync(game);
view.phase = "ready";
clearDecision();
updateChrome();
