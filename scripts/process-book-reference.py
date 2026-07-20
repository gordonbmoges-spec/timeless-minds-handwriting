#!/usr/bin/env python3
"""Extract the generated book reference and create a parchment-page preview.

The processing is deterministic: it preserves every source frame, keys the green
background, recolors the original leather, and replaces printed page interiors
with a low-detail parchment treatment while retaining the source illumination.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np


def cover_crop(image: np.ndarray, width: int, height: int) -> np.ndarray:
    source_height, source_width = image.shape[:2]
    scale = max(width / source_width, height / source_height)
    resized = cv2.resize(
        image,
        (round(source_width * scale), round(source_height * scale)),
        interpolation=cv2.INTER_LANCZOS4,
    )
    y = (resized.shape[0] - height) // 2
    x = (resized.shape[1] - width) // 2
    return resized[y : y + height, x : x + width]


def soft_mask(mask: np.ndarray, sigma: float = 1.3) -> np.ndarray:
    return cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), sigma)


def run_encoder(command: list[str]) -> subprocess.Popen[bytes]:
    return subprocess.Popen(command, stdin=subprocess.PIPE)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("background", type=Path)
    parser.add_argument("parchment", type=Path)
    parser.add_argument("--preview", type=Path, required=True)
    parser.add_argument("--alpha", type=Path, required=True)
    args = parser.parse_args()

    capture = cv2.VideoCapture(str(args.source))
    if not capture.isOpened():
        raise SystemExit(f"Could not open {args.source}")

    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

    background_source = cv2.imread(str(args.background), cv2.IMREAD_COLOR)
    parchment_source = cv2.imread(str(args.parchment), cv2.IMREAD_COLOR)
    if background_source is None or parchment_source is None:
        raise SystemExit("Could not load the background or parchment texture")

    background = cover_crop(background_source, width, height)
    background = cv2.GaussianBlur(background, (0, 0), 1.8)
    background = np.clip(background.astype(np.float32) * 0.72, 0, 255).astype(np.uint8)
    parchment = cover_crop(parchment_source, width, height)
    parchment = cv2.GaussianBlur(parchment, (0, 0), 1.2)

    args.preview.parent.mkdir(parents=True, exist_ok=True)
    args.alpha.parent.mkdir(parents=True, exist_ok=True)
    preview_silent = args.preview.with_suffix(".silent.mp4")

    ffmpeg_common = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-s",
        f"{width}x{height}",
        "-r",
        f"{fps:g}",
    ]
    preview_encoder = run_encoder(
        ffmpeg_common
        + [
            "-pix_fmt",
            "bgr24",
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "17",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(preview_silent),
        ]
    )
    alpha_encoder = run_encoder(
        ffmpeg_common
        + [
            "-pix_fmt",
            "bgra",
            "-i",
            "-",
            "-c:v",
            "prores_ks",
            "-profile:v",
            "4",
            "-pix_fmt",
            "yuva444p10le",
            str(args.alpha),
        ]
    )

    close_kernel = np.ones((11, 11), np.uint8)
    open_kernel = np.ones((3, 3), np.uint8)

    for frame_index in range(total_frames):
        ok, frame = capture.read()
        if not ok:
            break

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        hue, saturation, value = cv2.split(hsv)

        green = cv2.inRange(hsv, np.array([52, 22, 8]), np.array([108, 255, 255]))
        green = cv2.morphologyEx(green, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        foreground = 255 - green
        foreground[height - 45 :, :] = 0
        foreground = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, open_kernel)

        component_count, labels, stats, _ = cv2.connectedComponentsWithStats(
            (foreground > 0).astype(np.uint8)
        )
        book_mask = np.zeros_like(foreground)
        if component_count > 1:
            candidates = [
                index
                for index in range(1, component_count)
                if stats[index, cv2.CC_STAT_AREA] > 1_000
            ]
            if candidates:
                largest = max(candidates, key=lambda index: stats[index, cv2.CC_STAT_AREA])
                book_mask[labels == largest] = 255
        book_mask = cv2.morphologyEx(book_mask, cv2.MORPH_CLOSE, close_kernel)
        book_alpha = soft_mask(book_mask, 1.25)

        # Change the source burgundy leather into deep archival green without
        # inventing new geometry or disturbing the original highlights.
        red_leather = (
            (((hue < 23) | (hue > 170)) & (saturation > 42) & (value < 190))
            & (book_mask > 0)
        ).astype(np.uint8) * 255
        leather_mix = soft_mask(cv2.morphologyEx(red_leather, cv2.MORPH_CLOSE, close_kernel), 1.4)
        green_hsv = hsv.copy()
        green_hsv[:, :, 0] = 66
        green_hsv[:, :, 1] = np.clip(saturation.astype(np.float32) * 0.9 + 28, 0, 255).astype(np.uint8)
        green_hsv[:, :, 2] = np.clip(value.astype(np.float32) * 0.82, 0, 255).astype(np.uint8)
        green_leather = cv2.cvtColor(green_hsv, cv2.COLOR_HSV2BGR)
        processed_book = (
            frame.astype(np.float32) * (1.0 - leather_mix[:, :, None])
            + green_leather.astype(np.float32) * leather_mix[:, :, None]
        ).astype(np.uint8)

        # Printed glyphs are thin dark holes in a large neutral page region.
        # Closing the mask fills those holes, while a blurred illumination map
        # preserves the original folds and page-turn shadows.
        page_seed = (
            (book_mask > 0)
            & (hue < 36)
            & (saturation < 118)
            & (value > 68)
        ).astype(np.uint8) * 255
        page_mask = cv2.morphologyEx(page_seed, cv2.MORPH_CLOSE, close_kernel, iterations=2)
        page_mask = cv2.morphologyEx(page_mask, cv2.MORPH_OPEN, open_kernel)
        page_mix = soft_mask(page_mask, 1.05)
        page_mix *= min(1.0, max(0.0, (frame_index - 12) / 14.0))

        smooth_light = cv2.GaussianBlur(value, (0, 0), 10).astype(np.float32) / 205.0
        smooth_light = np.clip(smooth_light, 0.45, 1.12)
        parchment_frame = np.clip(
            parchment.astype(np.float32) * smooth_light[:, :, None], 0, 255
        ).astype(np.uint8)
        processed_book = (
            processed_book.astype(np.float32) * (1.0 - page_mix[:, :, None])
            + parchment_frame.astype(np.float32) * page_mix[:, :, None]
        ).astype(np.uint8)

        # A synthetic detached shadow keeps the floating book grounded after
        # the original green-table shadow has been removed.
        shadow = cv2.GaussianBlur(book_alpha, (0, 0), 18)
        shadow = np.roll(shadow, shift=(18, 24), axis=(0, 1)) * 0.52
        preview = background.astype(np.float32) * (1.0 - shadow[:, :, None])
        preview = (
            preview * (1.0 - book_alpha[:, :, None])
            + processed_book.astype(np.float32) * book_alpha[:, :, None]
        ).astype(np.uint8)

        alpha_frame = np.dstack(
            [processed_book, np.clip(book_alpha * 255.0, 0, 255).astype(np.uint8)]
        )
        assert preview_encoder.stdin is not None
        assert alpha_encoder.stdin is not None
        preview_encoder.stdin.write(preview.tobytes())
        alpha_encoder.stdin.write(alpha_frame.tobytes())

    capture.release()
    assert preview_encoder.stdin is not None
    assert alpha_encoder.stdin is not None
    preview_encoder.stdin.close()
    alpha_encoder.stdin.close()
    if preview_encoder.wait() != 0 or alpha_encoder.wait() != 0:
        raise SystemExit("Video encoding failed")

    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(preview_silent),
            "-i",
            str(args.source),
            "-map",
            "0:v:0",
            "-map",
            "1:a?",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            "-movflags",
            "+faststart",
            str(args.preview),
        ],
        check=True,
    )
    preview_silent.unlink(missing_ok=True)
    print(args.preview)
    print(args.alpha)


if __name__ == "__main__":
    main()
