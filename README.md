# Jev Tetris

Browser Tetris. [Jev](https://typesafe.ai) chooses every move.

The keyboard does not play. The engine first finds every legal lock, including hold. Jev picks one. The browser plays the path to that spot, then locks the piece.

## A move

1. The browser sends the board, the active piece, hold, the upcoming pieces, and the line count to `POST /api/decide`.
2. From spawn, the engine tries left, right, down, and both rotations. Rotation uses SRS shapes and wall kicks. A lock is a pose that cannot drop one more row.
3. Each lock carries the facts Jev sees: lines cleared, holes, height, bumpiness, the deepest well, and the skyline.
4. Jev (`jev-latest`) gets those options as a multiple-choice question and answers with an id from the list. An unknown id is rejected.
5. The browser animates that path. The engine then stamps the cells, clears full rows, and draws the next piece.

The API key stays on the dev server. The browser never receives it.

## Run

You need Node and pnpm. Create a key at [console.typesafe.ai/keys](https://console.typesafe.ai/keys).

```sh
pnpm install
cp .env.example .env
```

Put `TYPESAFE_API_KEY` in `.env`. Then:

```sh
pnpm dev
```

Vite prints the URL, usually http://localhost:5173.

## Scripts

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
