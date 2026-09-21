import { describe, expect, it } from "vitest";
import { createGame } from "../engine/game";
import { legalPlacements } from "../engine/placements";
import { DecideError, selectionFrom } from "./decide";

describe("selectionFrom", () => {
  const game = createGame(() => 0.999);
  const placements = legalPlacements({
    board: game.board,
    active: game.active,
    hold: null,
    queue: game.queue,
    canHold: true,
    lines: 0,
  });
  const first = placements[0];
  const second = placements[1];

  it("plays the option Jev named, even when another option has more probability", () => {
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    if (!first || !second) return;
    const decision = selectionFrom(
      placements,
      {
        choice: first.id,
        confidence: 0.2,
        probabilities: { [first.id]: 0.2, [second.id]: 0.8 },
      },
      { score: 0.4, confidence: 1 },
      "jev-test",
    );
    expect(decision.placement.id).toBe(first.id);
    expect(decision.confidence).toBe(0.2);
  });

  it("refuses a choice that is not a legal placement", () => {
    expect(() =>
      selectionFrom(
        placements,
        { choice: "not-a-move", confidence: 1, probabilities: {} },
        { score: 0, confidence: 1 },
        "jev-test",
      ),
    ).toThrow(DecideError);
  });
});
