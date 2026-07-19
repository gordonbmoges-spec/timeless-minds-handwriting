#!/usr/bin/env python3
"""Remove generated white/checkerboard backdrops from isolated book assets."""

from collections import deque
from pathlib import Path
import sys

from PIL import Image, ImageFilter


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _ = pixel
    spread = max(red, green, blue) - min(red, green, blue)
    average = (red + green + blue) / 3
    return (spread <= 20 and average >= 174) or min(red, green, blue) >= 238


def extract(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    background = Image.new("L", image.size, 0)
    background_pixels = background.load()
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if seen[index] or not is_background(pixels[x, y]):
            return
        seen[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        background_pixels[x, y] = 255
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    softened = background.filter(ImageFilter.GaussianBlur(0.8))
    alpha = softened.point(lambda value: 255 - value)
    image.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError(f"No foreground found in {source}")
    left, top, right, bottom = bounds
    padding = 18
    crop = image.crop((max(0, left - padding), max(0, top - padding), min(width, right + padding), min(height, bottom + padding)))
    target.parent.mkdir(parents=True, exist_ok=True)
    crop.save(target, "WEBP", quality=90, method=6)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract-book-alpha.py SOURCE TARGET")
    extract(Path(sys.argv[1]), Path(sys.argv[2]))
