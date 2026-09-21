import {
  APIError,
  type ChoiceCriteria,
  choice,
  type EntryType,
  score,
  TypeSafeClient,
} from "@typesafe-ai/sdk";
import { levelFor } from "../engine/game";
import { placementLabel } from "../engine/labels";
import { COLS, isPieceId, ORIENTATION_EN, type PieceId, ROWS } from "../engine/pieces";
import { type DecideInput, legalPlacements, type Placement } from "../engine/placements";
import { boardRows } from "../engine/rules";

export interface Alternative {
  label: string;
  probability: number;
  chosen: boolean;
}

export interface Decision {
  placement: Placement;
  confidence: number;
  alternatives: Alternative[];
  pressure: { score: number; confidence: number };
  model: string;
}

export class DecideError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "DecideError";
    this.code = code;
  }
}

export function parseDecideInput(body: unknown): DecideInput {
  if (!body || typeof body !== "object") throw new DecideError("bad_request");
  const raw = body as Record<string, unknown>;
  if (!Array.isArray(raw.board) || raw.board.length !== ROWS) throw new DecideError("bad_request");
  const board = raw.board.map((row) => {
    if (!Array.isArray(row) || row.length !== COLS) throw new DecideError("bad_request");
    return row.map((cell) => {
      if (cell === null) return null;
      if (!isPieceId(cell)) throw new DecideError("bad_request");
      return cell;
    });
  });
  if (!isPieceId(raw.active)) throw new DecideError("bad_request");
  if (!(raw.hold === null || isPieceId(raw.hold))) throw new DecideError("bad_request");
  if (!Array.isArray(raw.queue) || raw.queue.length < 1 || raw.queue.length > 14) {
    throw new DecideError("bad_request");
  }
  const queue: PieceId[] = [];
  for (const piece of raw.queue) {
    if (!isPieceId(piece)) throw new DecideError("bad_request");
    queue.push(piece);
  }
  if (typeof raw.canHold !== "boolean") throw new DecideError("bad_request");
  if (
    typeof raw.lines !== "number" ||
    !Number.isInteger(raw.lines) ||
    raw.lines < 0 ||
    raw.lines > 100_000
  ) {
    throw new DecideError("bad_request");
  }
  return {
    board,
    active: raw.active,
    hold: raw.hold,
    queue,
    canHold: raw.canHold,
    lines: raw.lines,
  };
}

function holdAction(input: DecideInput, placement: Placement): string {
  if (!placement.usesHold) return `Lock the active ${placement.piece}`;
  if (input.hold) return `Store ${input.active} and lock the held ${placement.piece}`;
  return `Store ${input.active} and lock upcoming ${placement.piece}`;
}

function criteriaFor(input: DecideInput, placements: Placement[]): ChoiceCriteria {
  const criteria: ChoiceCriteria = {};
  for (const placement of placements) {
    criteria[placement.id] = {
      action: holdAction(input, placement),
      orientation: ORIENTATION_EN[placement.piece][placement.rot] ?? "unknown",
      columns: `${placement.columns[0]} through ${placement.columns[1]}`,
      lowest_cell_rows_from_bottom: placement.lowestRowFromBottom,
      lines_cleared: placement.linesCleared,
      holes_after: placement.holesAfter,
      highest_stack_after: placement.maxHeightAfter,
      bumpiness_after: placement.bumpinessAfter,
      deepest_well_after: placement.wellAfter,
      skyline_left_to_right: placement.skyline.join(" "),
    };
  }
  return criteria;
}

function gameState(input: DecideInput): EntryType {
  return {
    board: boardRows(input.board),
    active: input.active,
    hold: input.hold ?? "empty",
    upcoming: input.queue.slice(0, 5),
    lines_cleared: input.lines,
    level: levelFor(input.lines),
  };
}

const PLACEMENT_INSTRUCTIONS: EntryType = {
  question: "Which legal Tetris placement should be played now?",
  goal: "Survive and score. Prefer a line clear that does not add buried holes. Keep the stack low and even. Keep a deep side well when an I is in `upcoming` or `hold` and that well does not make the stack dangerous. Choose a hold option when that piece fits `board` better than `active`.",
  facts:
    "`board` is 22 strings from the ceiling down, 10 characters each; a dot is empty. Every option is a legal lock. Skyline heights count filled cells up from the floor, including two hidden rows, so 22 touches the ceiling.",
};

const PRESSURE_INSTRUCTIONS: EntryType = {
  question: "How close is this Tetris stack to topping out?",
  inspect: "`board`",
  focus:
    "Judge the filled stack before the next piece locks. Ignore which placement might be chosen.",
};

const PRESSURE_LEVELS: [EntryType, EntryType, EntryType, EntryType] = [
  {
    what: "Low and open. Most of the well is empty and several pieces can land without burying a hole.",
    examples: ["only the bottom rows have blocks", "a flat stack a few rows high"],
  },
  {
    what: "Some height, unevenness, or a few holes, while the upper part of the well is still clear.",
    examples: ["a skyline around the middle", "one or two covered holes"],
  },
  {
    what: "High, ragged, or full of holes. Only careful placements still fit.",
    examples: ["blocks in the upper third", "many covered holes"],
  },
  {
    what: "About to top out. The next piece may have nowhere safe to land.",
    examples: ["blocks in the top rows", "almost every column is tall"],
  },
];

export function selectionFrom(
  placements: Placement[],
  answer: { choice: string; confidence: number; probabilities: Record<string, number> },
  pressure: { score: number; confidence: number },
  model: string,
): Decision {
  const chosen = placements.find((placement) => placement.id === answer.choice);
  if (!chosen) throw new DecideError("unknown_choice");
  const alternatives = Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, probability]) => {
      const placement = placements.find((item) => item.id === id);
      return {
        label: placement ? placementLabel(placement) : id,
        probability,
        chosen: id === chosen.id,
      };
    });
  return { placement: chosen, confidence: answer.confidence, alternatives, pressure, model };
}

export async function askJev(
  input: DecideInput,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Decision> {
  if (!apiKey.trim()) throw new DecideError("missing_api_key");
  const placements = legalPlacements(input);
  if (placements.length === 0) throw new DecideError("game_over");
  const client = new TypeSafeClient({ apiKey, timeout: 12_000 });
  try {
    const response = await client.systemOne(
      {
        model: "jev-latest",
        state: gameState(input),
        questions: {
          placement: choice(PLACEMENT_INSTRUCTIONS, criteriaFor(input, placements)),
          stack_pressure: score(PRESSURE_INSTRUCTIONS, PRESSURE_LEVELS),
        },
      },
      { signal },
    );
    const decision = selectionFrom(
      placements,
      {
        choice: response.answers.placement.choice,
        confidence: response.answers.placement.confidence,
        probabilities: response.answers.placement.probabilities,
      },
      {
        score: response.answers.stack_pressure.score,
        confidence: response.answers.stack_pressure.confidence,
      },
      response.model,
    );
    console.info(
      `jev ${decision.placement.id} confidence=${decision.confidence.toFixed(2)} pressure=${decision.pressure.score.toFixed(2)} tokens=${response.usage.input_tokens}+${response.usage.output_tokens}`,
    );
    return decision;
  } catch (error) {
    if (signal?.aborted) throw new DecideError("aborted");
    if (error instanceof DecideError) throw error;
    if (error instanceof APIError && (error.status === 401 || error.status === 403)) {
      throw new DecideError("rejected_key");
    }
    throw new DecideError("jev_failed");
  }
}
