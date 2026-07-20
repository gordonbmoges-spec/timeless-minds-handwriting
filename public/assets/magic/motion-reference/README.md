# Floating hardcover motion references

These production-reference sheets were generated on 2026-07-20 after studying the physical motion in the user-provided 5.09-second hardcover-opening video. No source-video frame is embedded in either asset.

- `floating-overhead-opening-sequence.png`: six stages of one consistent book: closed, 20-degree lift, 65-degree lift, cover past vertical, 150-degree spread, and an open-book page turn.
- `floating-overhead-book-styles.png`: eight distinct half-open books in this fixed order: Confucius, Socrates, Leonardo da Vinci, Shakespeare, Jung, Einstein, Tom Riddle diary, and Human Parchment.

Both sheets use a near-overhead camera so the floating book can be composited over the existing archive without introducing a tabletop or a second camera angle. Both files are true RGBA PNGs: exterior pixels have alpha `0`, while opaque book pixels have alpha `255`.

These are visual/motion references, not runtime animation frames yet. They should be split and normalized only after the camera angle is approved, because each runtime book needs its own consistent full opening sequence rather than a recolored shared cover.

The first per-book test is under `confucius/`. Its QA file records a remaining mid-opening geometry jump, so it has not been promoted into the live animation.
