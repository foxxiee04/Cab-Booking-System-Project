from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ACTIVITY_DIR = ROOT / "diagrams" / "02_analysis_design" / "02_activity"
CANVAS_WIDTH = 3600
MAX_CANVAS_HEIGHT = 3400
CANVAS = (CANVAS_WIDTH, MAX_CANVAS_HEIGHT)
WHITE = "#ffffff"
INK = "#111111"
CONNECTOR = "#0052a3"
NODE_FILL = "#d0d0d0"
HEADER_FILL = "#f7f7f7"
CAPTION_LINE = "#d8d8d8"


@dataclass
class Node:
    node_id: str
    label: str
    kind: str
    css: str
    lane: int
    order: int
    column: str = "main"
    local_end: bool = False
    source_hint: str = ""
    x: int = 0
    y: int = 0
    box: tuple[int, int, int, int] = (0, 0, 0, 0)


@dataclass
class Edge:
    source: str
    target: str
    label: str = ""
    dashed: bool = False


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


LANE_FONT = font(28, True)
TEXT_FONT = font(23)
SMALL_FONT = font(19)
CAPTION_FONT = font(34, True)


def clean_label(text: str) -> str:
    return (
        text.strip()
        .strip('"')
        .replace("<br/>", "\n")
        .replace("<br>", "\n")
        .replace("&nbsp;", " ")
    )


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw in text.splitlines() or [""]:
        words = raw.split()
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current)
            current = word
        if current:
            lines.append(current)
    return lines or [text]


def draw_centered(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    fnt: ImageFont.ImageFont,
    max_width: int,
) -> None:
    lines = wrap_text(draw, text, fnt, max_width)
    heights = [draw.textbbox((0, 0), line, font=fnt)[3] for line in lines]
    gap = 4
    total_h = sum(heights) + gap * max(0, len(lines) - 1)
    x1, y1, x2, y2 = box
    y = y1 + (y2 - y1 - total_h) / 2
    for line, line_h in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=fnt)
        w = bbox[2] - bbox[0]
        draw.text((x1 + (x2 - x1 - w) / 2, y), line, fill=INK, font=fnt)
        y += line_h + gap


def parse_mmd(path: Path) -> tuple[list[str], dict[str, Node], list[Edge]]:
    lanes: list[str] = []
    lane_index = -1
    nodes: dict[str, Node] = {}
    edges: list[Edge] = []
    order = 0

    subgraph_re = re.compile(r'^\s*subgraph\s+\w+\["(.+?)"\]')
    start_re = re.compile(r'^\s*(\w+)\(\["?(.+?)"?\]\):::(\w+)')
    rect_re = re.compile(r'^\s*(\w+)\["(.+?)"\]:::(\w+)')
    decision_re = re.compile(r'^\s*(\w+)\{"(.+?)"\}:::(\w+)')

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("classDef"):
            continue
        match = subgraph_re.match(line)
        if match:
            lanes.append(clean_label(match.group(1)))
            lane_index = len(lanes) - 1
            continue
        if line == "end":
            lane_index = -1
            continue

        for regex, kind in [(start_re, "circle"), (decision_re, "decision"), (rect_re, "action")]:
            match = regex.match(line)
            if not match:
                continue
            node_id, label, css = match.groups()
            final_kind = kind
            normalized = label.lower()
            if kind == "circle" and ("end" in normalized or node_id.lower().startswith("done")):
                final_kind = "end"
            elif kind == "circle":
                final_kind = "start"
            nodes[node_id] = Node(node_id, clean_label(label), final_kind, css, max(0, lane_index), order)
            order += 1
            break

        for parsed_edge in parse_edges(line):
            if parsed_edge.source in nodes:
                edges.append(parsed_edge)

    if not lanes:
        lanes = ["User", "System"]
    if len(lanes) == 1:
        lanes.append("System")
    return lanes[:2], nodes, edges


def split_activity_final_nodes(nodes: dict[str, Node], edges: list[Edge]) -> tuple[dict[str, Node], list[Edge]]:
    end_ids = {node_id for node_id, node in nodes.items() if node.kind == "end"}
    if not end_ids:
        return nodes, edges

    next_order = max((node.order for node in nodes.values()), default=0) + 1
    split_nodes = dict(nodes)
    split_edges: list[Edge] = []

    for edge in edges:
        source = split_nodes.get(edge.source)
        target = split_nodes.get(edge.target)
        if source and target and edge.target in end_ids:
            local_id = f"{edge.target}_{edge.source}"
            if local_id not in split_nodes:
                split_nodes[local_id] = Node(
                    local_id,
                    target.label,
                    "end",
                    target.css,
                    source.lane,
                    next_order,
                    local_end=True,
                    source_hint=edge.source,
                )
                next_order += 1
            split_edges.append(Edge(edge.source, local_id, edge.label, edge.dashed))
        else:
            split_edges.append(edge)

    referenced = {edge.source for edge in split_edges} | {edge.target for edge in split_edges}
    for node_id in list(split_nodes):
        if split_nodes[node_id].kind == "end" and not split_nodes[node_id].local_end and node_id not in referenced:
            del split_nodes[node_id]

    return split_nodes, split_edges


def parse_edges(line: str) -> list[Edge]:
    if "-->" not in line and ".->" not in line:
        return []

    source_match = re.match(r"^\s*(\w+)", line)
    if not source_match:
        return []

    source = source_match.group(1)
    rest = line[source_match.end() :]
    edges: list[Edge] = []
    arrow_re = re.compile(r"\s*(?:(-->)|--\s*(.*?)\s*-->|-\.\s*(.*?)\s*\.->)\s*(\w+)")

    while rest:
        match = arrow_re.match(rest)
        if not match:
            break
        plain_arrow, solid_label, dashed_label, target = match.groups()
        label = clean_label(solid_label or dashed_label or "")
        dashed = dashed_label is not None
        edges.append(Edge(source, target, label, dashed))
        source = target
        rest = rest[match.end() :]
        if plain_arrow is None and not label:
            break
    return edges


def compute_rows(nodes: dict[str, Node], edges: list[Edge]) -> dict[str, int]:
    start = next((node.node_id for node in nodes.values() if node.kind == "start"), None)
    if not start:
        start = min(nodes.values(), key=lambda item: item.order).node_id
    main_path = select_main_path(start, nodes, edges)
    main_nodes = set(main_path)
    row: dict[str, int] = {node_id: index for index, node_id in enumerate(main_path)}

    main_edges = set(zip(main_path, main_path[1:]))
    changed = True
    while changed:
        changed = False
        for edge in edges:
            if edge.source not in row or edge.target in row:
                continue
            if (edge.source, edge.target) in main_edges:
                continue
            source_row = row[edge.source]
            target = nodes[edge.target]
            source = nodes[edge.source]
            offset = 1
            if source.kind == "decision" and target.css == "risk":
                offset = 0
            row[edge.target] = source_row + offset
            changed = True

    next_row = max(row.values(), default=0) + 1
    for node in sorted(nodes.values(), key=lambda item: item.order):
        if node.node_id not in row:
            row[node.node_id] = next_row
            next_row += 1

    # Keep error branches close to the decision that produced them. Several
    # diagrams intentionally reuse an error node such as "fix input"; if the
    # node stays near an earlier decision, a later error arrow has to loop over
    # other activities and becomes hard to read.
    for edge in edges:
        source = nodes.get(edge.source)
        target = nodes.get(edge.target)
        if not source or not target:
            continue
        if source.kind == "decision" and target.css == "risk" and edge.source in row and edge.target in row:
            row[edge.target] = max(row[edge.target], row[edge.source])

    end_row = max((value for node_id, value in row.items() if nodes[node_id].kind != "end"), default=0) + 1
    for node in nodes.values():
        if node.kind == "end" and not node.local_end:
            row[node.node_id] = end_row

    occupied: dict[tuple[int, int, str], int] = {}
    adjusted: dict[str, int] = {}
    for node in sorted(nodes.values(), key=lambda item: (row[item.node_id], item.order)):
        slot = "main" if node.node_id in main_nodes else "branch"
        candidate = row[node.node_id]
        while (node.lane, candidate, slot) in occupied:
            candidate += 1
        occupied[(node.lane, candidate, slot)] = 1
        adjusted[node.node_id] = candidate
    return adjusted


def select_main_path(start: str, nodes: dict[str, Node], edges: list[Edge]) -> list[str]:
    outgoing: dict[str, list[Edge]] = defaultdict(list)
    for edge in edges:
        if edge.source in nodes and edge.target in nodes:
            outgoing[edge.source].append(edge)

    path = [start]
    current = start
    visited = {start}
    positive_labels = {"yes", "hop le", "valid", "hợp lệ"}
    negative_labels = {"no", "khong", "khong hop le", "không", "không hợp lệ"}

    while current in outgoing:
        candidates = [edge for edge in outgoing[current] if edge.target not in visited]
        if not candidates:
            break
        node = nodes[current]
        chosen = None
        if node.kind == "decision":
            viable = [edge for edge in candidates if nodes[edge.target].css != "risk"]
            if viable:
                candidates = viable
            for edge in candidates:
                normalized = normalize_label(edge.label)
                if normalized in positive_labels:
                    chosen = edge
                    break
            if not chosen:
                for edge in candidates:
                    normalized = normalize_label(edge.label)
                    if normalized not in negative_labels:
                        chosen = edge
                        break
        if not chosen:
            chosen = next((edge for edge in candidates if not edge.label), candidates[0])
        current = chosen.target
        path.append(current)
        visited.add(current)
        if nodes[current].kind == "end":
            break
    return path


def normalize_label(label: str) -> str:
    return (
        label.lower()
        .replace("ợ", "o")
        .replace("ơ", "o")
        .replace("ô", "o")
        .replace("ó", "o")
        .replace("ò", "o")
        .replace("ỏ", "o")
        .replace("õ", "o")
        .replace("ọ", "o")
        .replace("ệ", "e")
        .replace("ê", "e")
        .replace("é", "e")
        .replace("è", "e")
        .replace("ẻ", "e")
        .replace("ẽ", "e")
        .replace("ẹ", "e")
        .replace("ậ", "a")
        .replace("ă", "a")
        .replace("â", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("ả", "a")
        .replace("ã", "a")
        .replace("ạ", "a")
        .replace("í", "i")
        .replace("ì", "i")
        .replace("ỉ", "i")
        .replace("ĩ", "i")
        .replace("ị", "i")
        .replace("ư", "u")
        .replace("ú", "u")
        .replace("ù", "u")
        .replace("ủ", "u")
        .replace("ũ", "u")
        .replace("ụ", "u")
        .replace("ý", "y")
        .replace("ỳ", "y")
        .replace("ỷ", "y")
        .replace("ỹ", "y")
        .replace("ỵ", "y")
    ).strip()


def assign_positions(nodes: dict[str, Node], rows: dict[str, int], edges: list[Edge]) -> None:
    start = next((node.node_id for node in nodes.values() if node.kind == "start"), None)
    if not start:
        start = min(nodes.values(), key=lambda item: item.order).node_id
    main_nodes = set(select_main_path(start, nodes, edges))
    max_row = max(rows.values(), default=1)
    content_top = 210
    content_bottom = 3050
    step = min(185, max(145, (content_bottom - content_top) // max(1, max_row)))
    y0 = content_top + 30

    for node in nodes.values():
        if node.local_end and node.source_hint:
            node.column = "main" if node.source_hint in main_nodes else "branch"
        else:
            node.column = "main" if node.node_id in main_nodes else "branch"
        if node.lane == 0:
            node.x = 920 if node.column == "main" else 350
        else:
            node.x = 2180 if node.column == "main" else 3140
        node.y = y0 + rows[node.node_id] * step


def node_size(node: Node, draw: ImageDraw.ImageDraw) -> tuple[int, int]:
    if node.kind == "decision":
        return (430 if node.lane == 0 else 520, 135)
    if node.kind in {"start", "end"}:
        return 60, 60
    if node.lane == 0:
        width = 560 if node.column == "main" else 420
    else:
        width = 820 if node.column == "main" else 640
    lines = wrap_text(draw, node.label, TEXT_FONT, width - 44)
    height = max(76, len(lines) * 30 + 30)
    return width, min(132, height)


def draw_node(draw: ImageDraw.ImageDraw, node: Node) -> None:
    width, height = node_size(node, draw)
    x1 = node.x - width // 2
    y1 = node.y - height // 2
    x2 = node.x + width // 2
    y2 = node.y + height // 2
    node.box = (x1, y1, x2, y2)

    if node.kind == "start":
        r = 28
        node.box = (node.x - r, node.y - r, node.x + r, node.y + r)
        draw.ellipse(node.box, fill=INK, outline=INK, width=2)
        return
    if node.kind == "end":
        r = 30
        node.box = (node.x - r, node.y - r, node.x + r, node.y + r)
        draw.ellipse(node.box, fill=WHITE, outline=INK, width=4)
        draw.ellipse((node.x - 15, node.y - 15, node.x + 15, node.y + 15), fill=INK, outline=INK, width=2)
        return
    if node.kind == "decision":
        points = [(node.x, y1), (x2, node.y), (node.x, y2), (x1, node.y)]
        draw.polygon(points, fill=WHITE, outline=INK)
        draw.line(points + [points[0]], fill=INK, width=4)
        draw_centered(draw, node.box, node.label, TEXT_FONT, width - 62)
        return

    draw.rounded_rectangle(node.box, radius=18, fill=NODE_FILL, outline=INK, width=4)
    draw_centered(draw, node.box, node.label, TEXT_FONT, width - 48)


def edge_point(box: tuple[int, int, int, int], side: str) -> tuple[int, int]:
    x1, y1, x2, y2 = box
    if side == "top":
        return ((x1 + x2) // 2, y1)
    if side == "bottom":
        return ((x1 + x2) // 2, y2)
    if side == "left":
        return (x1, (y1 + y2) // 2)
    if side == "right":
        return (x2, (y1 + y2) // 2)
    raise ValueError(side)


def arrow_head(draw: ImageDraw.ImageDraw, p1: tuple[int, int], p2: tuple[int, int]) -> None:
    angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    size = 24
    spread = 0.48
    left = (p2[0] - size * math.cos(angle - spread), p2[1] - size * math.sin(angle - spread))
    right = (p2[0] - size * math.cos(angle + spread), p2[1] - size * math.sin(angle + spread))
    draw.polygon([p2, left, right], fill=CONNECTOR)


def draw_polyline(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], dashed: bool = False) -> None:
    if not dashed:
        draw.line(points, fill=WHITE, width=16, joint="curve")
    if dashed:
        for p1, p2 in zip(points, points[1:]):
            draw_dashed_segment(draw, p1, p2)
    else:
        draw.line(points, fill=CONNECTOR, width=6, joint="curve")
    if len(points) >= 2:
        arrow_head(draw, points[-2], points[-1])


def draw_dashed_segment(draw: ImageDraw.ImageDraw, p1: tuple[int, int], p2: tuple[int, int]) -> None:
    x1, y1 = p1
    x2, y2 = p2
    length = math.hypot(x2 - x1, y2 - y1)
    if length == 0:
        return
    dx = (x2 - x1) / length
    dy = (y2 - y1) / length
    pos = 0.0
    dash = 16
    gap = 10
    while pos < length:
        end = min(pos + dash, length)
        draw.line((x1 + dx * pos, y1 + dy * pos, x1 + dx * end, y1 + dy * end), fill=WHITE, width=16)
        draw.line((x1 + dx * pos, y1 + dy * pos, x1 + dx * end, y1 + dy * end), fill=CONNECTOR, width=6)
        pos += dash + gap


def label_edge(draw: ImageDraw.ImageDraw, text: str, at: tuple[int, int]) -> None:
    if not text:
        return
    box = label_box(draw, text, at)
    draw.rectangle(box, fill=WHITE, outline=None)
    draw.text(at, text, fill=CONNECTOR, font=SMALL_FONT)


def label_box(draw: ImageDraw.ImageDraw, text: str, at: tuple[int, int]) -> tuple[int, int, int, int]:
    bbox = draw.textbbox((0, 0), text, font=SMALL_FONT)
    pad = 5
    return (at[0] - pad, at[1] - pad, at[0] + bbox[2] - bbox[0] + pad, at[1] + bbox[3] - bbox[1] + pad)


def expanded_box(box: tuple[int, int, int, int], pad: int) -> tuple[int, int, int, int]:
    return (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)


def intersects(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]


def label_edge_clear(
    draw: ImageDraw.ImageDraw,
    text: str,
    at: tuple[int, int],
    nodes: dict[str, Node],
    canvas_size: tuple[int, int],
) -> None:
    if not text:
        return
    candidates = [
        at,
        (at[0] + 18, at[1] - 42),
        (at[0] + 18, at[1] + 28),
        (at[0] - 82, at[1] - 42),
        (at[0] - 82, at[1] + 28),
    ]
    occupied = [expanded_box(node.box, 8) for node in nodes.values()]
    for candidate in candidates:
        box = label_box(draw, text, candidate)
        in_bounds = 90 <= box[0] and box[2] <= canvas_size[0] - 90 and 90 <= box[1] and box[3] <= canvas_size[1] - 90
        if in_bounds and not any(intersects(box, item) for item in occupied):
            label_edge(draw, text, candidate)
            return


def label_position(points: list[tuple[int, int]]) -> tuple[int, int]:
    if len(points) == 2:
        return ((points[0][0] + points[1][0]) // 2 + 8, (points[0][1] + points[1][1]) // 2 - 26)
    longest = (points[0], points[1])
    longest_len = -1.0
    for p1, p2 in zip(points, points[1:]):
        length = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        if length > longest_len:
            longest = (p1, p2)
            longest_len = length
    p1, p2 = longest
    return ((p1[0] + p2[0]) // 2 + 8, (p1[1] + p2[1]) // 2 - 26)


def route_edge(source: Node, target: Node, label: str = "") -> list[tuple[int, int]]:
    sx, sy = source.x, source.y
    tx, ty = target.x, target.y
    left_corridor = 100
    right_corridor = 3490
    negative_label = normalize_label(label) in {"no", "khong", "khong hop le", "không", "không hợp lệ"}

    if source.kind == "decision" and negative_label and ty > sy + 10:
        corridor_x = left_corridor if source.lane == 0 else right_corridor
        start = edge_point(source.box, "left" if source.lane == 0 else "right")
        end = edge_point(target.box, "top")
        approach_y = max(96, target.box[1] - 2)
        return [start, (corridor_x, start[1]), (corridor_x, approach_y), (end[0], approach_y), end]

    if target.kind == "end" and abs(tx - sx) > 20 and ty > sy:
        if source.lane == 0:
            start = edge_point(source.box, "left")
            corridor_x = left_corridor
            end = edge_point(target.box, "left" if corridor_x < tx else "right")
        else:
            start = edge_point(source.box, "right")
            corridor_x = right_corridor
            end = edge_point(target.box, "right" if corridor_x > tx else "left")
        return [start, (corridor_x, start[1]), (corridor_x, end[1]), end]

    if source.column == "main" and target.column == "branch" and ty >= sy - 10:
        if source.lane == target.lane:
            if ty > sy + 10:
                start = edge_point(source.box, "bottom")
                end = edge_point(target.box, "top")
                mid_y = (start[1] + end[1]) // 2
                return [start, (start[0], mid_y), (end[0], mid_y), end]
            start = edge_point(source.box, "right" if tx > sx else "left")
            end = edge_point(target.box, "left" if tx > sx else "right")
            return [start, end]
        start = edge_point(source.box, "right" if tx > sx else "left")
        if abs(ty - sy) < 36:
            end = edge_point(target.box, "left" if tx > sx else "right")
            return [start, end]
        end = edge_point(target.box, "top")
        corridor_x = left_corridor if target.lane == 0 else right_corridor
        return [start, (corridor_x, start[1]), (corridor_x, end[1]), end]

    if source.column == "branch" and target.column == "main" and ty >= sy - 10:
        if source.lane == target.lane and abs(ty - sy) < 36:
            start = edge_point(source.box, "right" if tx > sx else "left")
            end = edge_point(target.box, "left" if tx > sx else "right")
            return [start, end]
        corridor_x = left_corridor if source.lane == 0 else right_corridor
        start = edge_point(source.box, "left" if source.lane == 0 else "right")
        end = edge_point(target.box, "top")
        approach_y = max(96, target.box[1] - 2)
        return [start, (corridor_x, start[1]), (corridor_x, approach_y), (end[0], approach_y), end]

    if ty < sy - 10:
        if source.lane != target.lane:
            route_x = left_corridor if source.lane == 0 else right_corridor
            start = edge_point(source.box, "top")
            end = edge_point(target.box, "top")
            depart_y = max(96, source.box[1] - 2)
            approach_y = max(96, target.box[1] - 2)
            return [start, (start[0], depart_y), (route_x, depart_y), (route_x, approach_y), (end[0], approach_y), end]
        if source.lane == 0 and target.lane == 0:
            start_side = "left"
            target_side = "left"
            route_x = left_corridor
        elif source.lane == 1 and target.lane == 1:
            start_side = "right"
            target_side = "right"
            route_x = right_corridor
        else:
            start_side = "left" if source.x >= target.x else "right"
            target_side = "right" if source.x >= target.x else "left"
            route_x = min(source.box[0], target.box[0]) - 70 if source.x >= target.x else max(source.box[2], target.box[2]) + 70
            route_x = max(left_corridor, min(right_corridor, route_x))
        start = edge_point(source.box, start_side)
        end = edge_point(target.box, target_side)
        if target.column == "main":
            if source.lane == 0:
                start = edge_point(source.box, "left")
                route_x = left_corridor
            else:
                start = edge_point(source.box, "right")
                route_x = right_corridor
            end = edge_point(target.box, "top")
            approach_y = max(96, target.box[1] - 2)
            return [start, (route_x, start[1]), (route_x, approach_y), (end[0], approach_y), end]
        return [start, (route_x, start[1]), (route_x, end[1]), end]
    if abs(ty - sy) < 36 and abs(tx - sx) > 20:
        start = edge_point(source.box, "right" if tx > sx else "left")
        end = edge_point(target.box, "left" if tx > sx else "right")
        return [start, end]
    start = edge_point(source.box, "bottom")
    end = edge_point(target.box, "top")
    if abs(tx - sx) < 20:
        return [start, end]
    gap = end[1] - start[1]
    if gap > 12:
        mid_y = start[1] + gap // 2
    else:
        start = edge_point(source.box, "right" if tx > sx else "left")
        end = edge_point(target.box, "left" if tx > sx else "right")
        mid_x = (start[0] + end[0]) // 2
        return [start, (mid_x, start[1]), (mid_x, end[1]), end]
    return [start, (start[0], mid_y), (end[0], mid_y), end]


def image_title(path: Path) -> str:
    acronyms = {"ai": "AI", "gps": "GPS", "otp": "OTP", "t24h": "T+24h", "topup": "Top-Up"}
    parts = path.stem.split("_")
    if parts and parts[0].isdigit():
        parts = parts[1:]
    return " ".join(acronyms.get(part.lower(), part.capitalize()) for part in parts)


def estimate_lane_bottom(nodes: dict[str, Node], draw: ImageDraw.ImageDraw) -> int:
    max_node_bottom = 0
    for node in nodes.values():
        _, height = node_size(node, draw)
        max_node_bottom = max(max_node_bottom, node.y + height // 2)
    return min(3180, max(1500, max_node_bottom + 150))


def draw_frame(draw: ImageDraw.ImageDraw, lanes: list[str], lane_bottom: int, fill: bool = True) -> None:
    left = (80, 80, 1260, lane_bottom)
    right = (1260, 80, 3520, lane_bottom)
    for box, label in [(left, lanes[0]), (right, lanes[1])]:
        if fill:
            draw.rectangle(box, fill=WHITE, outline=INK, width=4)
            draw.rectangle((box[0], box[1], box[2], box[1] + 58), fill=HEADER_FILL, outline=INK, width=3)
            draw_centered(draw, (box[0], box[1] + 4, box[2], box[1] + 54), label, LANE_FONT, box[2] - box[0] - 36)
        else:
            draw.rectangle(box, outline=INK, width=4)
            draw.rectangle((box[0], box[1], box[2], box[1] + 58), outline=INK, width=3)
    draw.line((1260, 80, 1260, lane_bottom), fill=INK, width=4)


def render_activity(path: Path) -> None:
    lanes, nodes, edges = parse_mmd(path)
    nodes, edges = split_activity_final_nodes(nodes, edges)
    rows = compute_rows(nodes, edges)
    assign_positions(nodes, rows, edges)

    measure_img = Image.new("RGB", CANVAS, WHITE)
    measure_draw = ImageDraw.Draw(measure_img)
    lane_bottom = estimate_lane_bottom(nodes, measure_draw)
    canvas_size = (CANVAS_WIDTH, lane_bottom + 220)

    img = Image.new("RGB", canvas_size, WHITE)
    draw = ImageDraw.Draw(img)
    draw_frame(draw, lanes, lane_bottom, fill=True)

    for node in sorted(nodes.values(), key=lambda item: item.order):
        draw_node(draw, node)

    routed_edges: list[tuple[Edge, list[tuple[int, int]]]] = []
    for edge in edges:
        source = nodes.get(edge.source)
        target = nodes.get(edge.target)
        if not source or not target:
            continue
        points = route_edge(source, target, edge.label)
        routed_edges.append((edge, points))
        draw_polyline(draw, points, dashed=edge.dashed)
        if edge.label:
            label_edge(draw, edge.label, label_position(points))

    # Redraw nodes over connector lines so retry/back edges do not cut through
    # labels. Arrow endpoints still touch node borders, matching UML tools.
    for node in sorted(nodes.values(), key=lambda item: item.order):
        draw_node(draw, node)

    # Keep arrowheads and branch labels visible after nodes are painted over
    # connector endpoints.
    for edge, points in routed_edges:
        if len(points) >= 2:
            arrow_head(draw, points[-2], points[-1])
        if edge.label:
            label_edge_clear(draw, edge.label, label_position(points), nodes, canvas_size)

    caption_line_y = lane_bottom + 90
    draw.line((320, caption_line_y, 3280, caption_line_y), fill=CAPTION_LINE, width=2)
    draw_centered(draw, (300, lane_bottom + 110, 3300, lane_bottom + 190), image_title(path), CAPTION_FONT, 2700)
    img.save(path.with_suffix(".png"), "PNG", optimize=True)


def main() -> None:
    for path in sorted(ACTIVITY_DIR.glob("*.mmd")):
        print(f"render {path.name}")
        render_activity(path)


if __name__ == "__main__":
    main()
