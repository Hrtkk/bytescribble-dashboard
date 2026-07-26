# Scribble Board — dashboard.bytescribble.com

A drawing board for no reason at all. Part of [ByteScribble](https://bytescribble.com).

- Ink that **tapers with pointer speed** (and real pressure on a stylus)
- **Mirror modes** — 1×, 2×, 6×, 12× — turn any doodle into a mandala
- Undo/redo, light/dark board, PNG export
- Keyboard: `B` brush, `E` eraser, `⌘Z` undo, `[` `]` size

Strokes are stored as data, not pixels, so undo, theme switches and window
resizes all replay cleanly. Nothing is saved or uploaded anywhere.

The shell is a panel grid with one panel today — more can slot in later
without a redesign, which is the "scale it later" part.

```sh
npm install && npm run dev
```
