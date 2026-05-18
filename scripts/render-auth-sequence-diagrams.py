from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SEQUENCE_DIR = ROOT / "diagrams" / "02_analysis_design" / "03_sequence"
MERMAID_CONFIG = ROOT / "diagrams" / "mermaid.config.json"
PUPPETEER_CONFIG = ROOT / "diagrams" / "puppeteer.config.json"

CANVAS = (2400, 1600)
TEXT = "#0f172a"
WHITE = "#ffffff"

CAPTIONS = {
    "30_customer_registration_sequence": "Sequence đăng ký tài khoản khách hàng",
    "31_customer_login_sequence": "Sequence đăng nhập khách hàng",
    "32_driver_login_sequence": "Sequence đăng nhập tài xế",
    "33_admin_login_sequence": "Sequence đăng nhập quản trị viên",
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_centered(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str) -> None:
    fnt = font(44, True)
    bbox = draw.textbbox((0, 0), text, font=fnt)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = box[0] + (box[2] - box[0] - width) / 2
    y = box[1] + (box[3] - box[1] - height) / 2
    draw.text((x, y), text, font=fnt, fill=TEXT)


def normalize_with_caption(path: Path) -> None:
    caption_h = 145
    img = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", img.size, (255, 255, 255, 255))
    bbox = ImageChops.difference(img, background).getbbox()
    if bbox:
        pad = 40
        img = img.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(img.width, bbox[2] + pad),
                min(img.height, bbox[3] + pad),
            )
        )

    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 255))
    max_w = CANVAS[0] - 130
    max_h = CANVAS[1] - caption_h - 95
    scale = min(max_w / img.width, max_h / img.height, 1.35)
    size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    resized = img.resize(size, Image.Resampling.LANCZOS)
    x = (CANVAS[0] - size[0]) // 2
    y = 45 + max(0, (max_h - size[1]) // 2)
    canvas.alpha_composite(resized, (x, y))

    draw = ImageDraw.Draw(canvas)
    line_y = CANVAS[1] - caption_h + 18
    draw.line((240, line_y, CANVAS[0] - 240, line_y), fill="#cbd5e1", width=2)
    draw_centered(
        draw,
        (80, line_y + 32, CANVAS[0] - 80, CANVAS[1] - 28),
        CAPTIONS.get(path.stem, path.stem),
    )
    canvas.convert("RGB").save(path, "PNG", optimize=True, dpi=(300, 300))


def render_sequence(source: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(source)

    output = source.with_suffix(".png")
    raw_output = output.with_name(f"{output.stem}.raw.png")
    executable = "npx.cmd" if sys.platform.startswith("win") else "npx"
    command = [
        executable,
        "mmdc",
        "-i",
        str(source),
        "-o",
        str(raw_output),
        "-c",
        str(MERMAID_CONFIG),
        "-p",
        str(PUPPETEER_CONFIG),
        "--theme",
        "default",
        "--backgroundColor",
        "white",
        "--width",
        "2200",
        "--height",
        "1300",
        "--scale",
        "2",
    ]
    try:
        subprocess.run(command, cwd=ROOT, check=True)
        raw_output.replace(output)
        normalize_with_caption(output)
    finally:
        if raw_output.exists():
            raw_output.unlink()

    print(f"rendered {output.relative_to(ROOT)}")


def main() -> None:
    for stem in CAPTIONS:
        render_sequence(SEQUENCE_DIR / f"{stem}.mmd")


if __name__ == "__main__":
    main()
