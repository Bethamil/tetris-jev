export const COLS = 10;
export const ROWS = 22;
export const HIDDEN_ROWS = 2;
export const SPAWN_X = 3;
export const SPAWN_Y = 0;

export const PIECE_IDS = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type PieceId = (typeof PIECE_IDS)[number];

export interface Pose {
  piece: PieceId;
  rot: number;
  x: number;
  y: number;
}

/** Occupied cells inside a 4×4 box, for each SRS rotation. */
export const SHAPES: Record<PieceId, readonly [number, number][][]> = {
  I: [
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
  ],
  O: [
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  S: [
    [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
    ],
  ],
  J: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
  ],
  L: [
    [
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  ],
};

export const COLORS: Record<PieceId, string> = {
  I: "#2ec4b6",
  O: "#f0c14d",
  T: "#b07cf0",
  S: "#3cbf7a",
  Z: "#ef5d7a",
  J: "#4c8dff",
  L: "#f08a3c",
};

export const ORIENTATION_EN: Record<PieceId, readonly string[]> = {
  I: [
    "horizontal bar",
    "vertical bar",
    "horizontal bar, one row lower in its box",
    "vertical bar, one column left of the other vertical",
  ],
  O: ["square", "square", "square", "square"],
  T: ["stem up", "stem right", "stem down", "stem left"],
  S: ["horizontal", "vertical", "horizontal, one row lower", "vertical, one column left"],
  Z: ["horizontal", "vertical", "horizontal, one row lower", "vertical, one column left"],
  J: [
    "flat base, nub on the left",
    "upright, nub on the upper right",
    "flat top, nub on the right",
    "upright, nub on the lower left",
  ],
  L: [
    "flat base, nub on the right",
    "upright, nub on the lower right",
    "flat top, nub on the left",
    "upright, nub on the upper left",
  ],
};

type Kick = readonly [number, number];

/** SRS kicks as [x, yUp]. Board rows grow downward, so yUp is subtracted from row. */
export const JLSTZ_KICKS: Record<string, readonly Kick[]> = {
  "0>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "1>0": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "1>2": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "2>1": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "2>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "3>2": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "3>0": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "0>3": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

export const I_KICKS: Record<string, readonly Kick[]> = {
  "0>1": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "1>0": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "1>2": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "2>1": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "2>3": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "3>2": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "3>0": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "0>3": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

export function isPieceId(value: unknown): value is PieceId {
  return typeof value === "string" && (PIECE_IDS as readonly string[]).includes(value);
}

export function spawnPose(piece: PieceId): Pose {
  return { piece, rot: 0, x: SPAWN_X, y: SPAWN_Y };
}
