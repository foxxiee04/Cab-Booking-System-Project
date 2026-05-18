from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BPMN_DIR = ROOT / "diagrams" / "02_analysis_design" / "00_bpmn"

CANVAS_W = 2400
MARGIN_X = 70
TOP = 62
TITLE_H = 106
HEADER_H = 82
CAPTION_H = 108
BOTTOM_PAD = 56

INK = "#111827"
BLUE = "#0757a6"
WHITE = "#ffffff"
LANE_A = "#ffffff"
LANE_B = "#fafafa"
LANE_HEADER = "#eef2f7"
LANE_BORDER = "#cbd5e1"
TASK_FILL = "#e5e7eb"
GATEWAY_FILL = "#ffffff"


@dataclass(frozen=True)
class NodeSpec:
    id: str
    lane: int
    step: int
    kind: str
    label: str


@dataclass(frozen=True)
class EdgeSpec:
    source: str
    target: str
    label: str | None = None


@dataclass(frozen=True)
class ProcessSpec:
    filename: str
    title: str
    lanes: tuple[str, ...]
    nodes: tuple[NodeSpec, ...]
    edges: tuple[EdgeSpec, ...]


@dataclass
class NodeLayout:
    spec: NodeSpec
    box: tuple[int, int, int, int]
    shape_box: tuple[int, int, int, int]
    text_box: tuple[int, int, int, int]
    lines: list[str]

    @property
    def cx(self) -> int:
        return (self.shape_box[0] + self.shape_box[2]) // 2

    @property
    def cy(self) -> int:
        return (self.shape_box[1] + self.shape_box[3]) // 2


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


FONT_TITLE = font(50, True)
FONT_HEADER = font(40, True)
FONT_NODE = font(34)
FONT_NODE_BOLD = font(34, True)
FONT_EDGE = font(28)
FONT_EVENT = font(30, True)
FONT_CAPTION = font(44, True)


def n(node_id: str, lane: int, step: int, kind: str, label: str) -> NodeSpec:
    return NodeSpec(node_id, lane, step, kind, label)


def e(source: str, target: str, label: str | None = None) -> EdgeSpec:
    return EdgeSpec(source, target, label)


PROCESSES: tuple[ProcessSpec, ...] = (
    ProcessSpec(
        "01_bpmn_account_profile.png",
        "BPMN-01: Quy trình quản lý tài khoản và hồ sơ người dùng",
        ("Người dùng", "Hệ thống", "Quản trị viên"),
        (
            n("start", 0, 0, "start", "Bắt đầu"),
            n("open", 0, 1, "task", "Mở chức năng tài khoản"),
            n("has_account", 1, 2, "gateway", "Đã có tài khoản?"),
            n("register", 1, 3, "task", "Đăng ký và xác thực thông tin"),
            n("login", 0, 4, "task", "Đăng nhập vào hệ thống"),
            n("need", 0, 5, "gateway", "Nhu cầu thao tác?"),
            n("update", 0, 6, "task", "Cập nhật hồ sơ cá nhân"),
            n("forgot", 1, 6, "task", "Xác minh quên mật khẩu và đặt lại mật khẩu"),
            n("save_profile", 1, 7, "task", "Lưu và xác thực thay đổi hồ sơ"),
            n("driver_docs", 0, 7, "task", "Tài xế bổ sung hồ sơ đăng ký"),
            n("review", 2, 8, "task", "Kiểm tra và xét duyệt hồ sơ tài xế"),
            n("docs_ok", 2, 9, "gateway", "Hồ sơ hợp lệ?"),
            n("request_fix", 1, 10, "task", "Yêu cầu bổ sung hoặc từ chối hồ sơ"),
            n("logout", 0, 11, "task", "Đăng xuất khi kết thúc phiên"),
            n("end", 1, 12, "end", "Kết thúc"),
        ),
        (
            e("start", "open"),
            e("open", "has_account"),
            e("has_account", "register", "Không"),
            e("has_account", "login", "Có"),
            e("register", "login"),
            e("login", "need"),
            e("need", "update", "Cập nhật hồ sơ"),
            e("update", "save_profile"),
            e("save_profile", "logout"),
            e("need", "forgot", "Quên mật khẩu"),
            e("forgot", "login"),
            e("need", "driver_docs", "Đăng ký tài xế"),
            e("driver_docs", "review"),
            e("review", "docs_ok"),
            e("docs_ok", "request_fix", "Không"),
            e("request_fix", "driver_docs"),
            e("docs_ok", "logout", "Có"),
            e("logout", "end"),
        ),
    ),
    ProcessSpec(
        "02_bpmn_booking_dispatch.png",
        "BPMN-02: Quy trình đặt xe và điều phối tài xế",
        ("Khách hàng", "Hệ thống", "Tài xế"),
        (
            n("start", 0, 0, "start", "Bắt đầu"),
            n("enter_route", 0, 1, "task", "Nhập điểm đón, điểm đến và loại xe"),
            n("valid", 1, 2, "gateway", "Thông tin hợp lệ?"),
            n("adjust", 0, 3, "task", "Điều chỉnh thông tin đặt xe"),
            n("estimate", 1, 3, "task", "Ước tính giá và thời gian đón"),
            n("confirm", 0, 4, "gateway", "Khách xác nhận?"),
            n("pay_method", 1, 5, "gateway", "Phương thức thanh toán?"),
            n("prepay", 0, 6, "task", "Thực hiện thanh toán trả trước"),
            n("pay_ok", 1, 7, "gateway", "Thanh toán thành công?"),
            n("record", 1, 8, "task", "Ghi nhận yêu cầu đặt xe"),
            n("find_driver", 1, 9, "task", "Tìm tài xế phù hợp"),
            n("candidate", 1, 10, "gateway", "Còn tài xế phù hợp?"),
            n("no_driver", 0, 11, "task", "Thông báo không tìm được tài xế"),
            n("invite", 2, 11, "task", "Nhận lời mời chuyến"),
            n("accept", 2, 12, "gateway", "Tài xế nhận chuyến?"),
            n("assign", 1, 13, "task", "Phân công tài xế cho chuyến"),
            n("notify_customer", 0, 14, "task", "Nhận thông tin tài xế"),
            n("end", 1, 15, "end", "Tài xế đã nhận chuyến"),
        ),
        (
            e("start", "enter_route"),
            e("enter_route", "valid"),
            e("valid", "adjust", "Không"),
            e("adjust", "enter_route"),
            e("valid", "estimate", "Có"),
            e("estimate", "confirm"),
            e("confirm", "adjust", "Không"),
            e("confirm", "pay_method", "Có"),
            e("pay_method", "prepay", "Trả trước"),
            e("prepay", "pay_ok"),
            e("pay_ok", "adjust", "Không"),
            e("pay_ok", "record", "Có"),
            e("pay_method", "record", "Tiền mặt"),
            e("record", "find_driver"),
            e("find_driver", "candidate"),
            e("candidate", "no_driver", "Không"),
            e("no_driver", "end"),
            e("candidate", "invite", "Có"),
            e("invite", "accept"),
            e("accept", "find_driver", "Không/quá hạn"),
            e("accept", "assign", "Có"),
            e("assign", "notify_customer"),
            e("notify_customer", "end"),
        ),
    ),
    ProcessSpec(
        "03_bpmn_ride_execution_tracking.png",
        "BPMN-03: Quy trình thực hiện và theo dõi chuyến đi",
        ("Khách hàng", "Hệ thống", "Tài xế"),
        (
            n("start", 1, 0, "start", "Tài xế đã nhận chuyến"),
            n("go_pickup", 2, 1, "task", "Di chuyển đến điểm đón"),
            n("track_driver", 0, 2, "task", "Theo dõi vị trí tài xế"),
            n("arrive", 2, 3, "task", "Xác nhận đã đến điểm đón"),
            n("notify_arrive", 1, 4, "task", "Thông báo tài xế đã đến"),
            n("board", 0, 5, "task", "Khách lên xe"),
            n("start_trip", 2, 6, "task", "Xác nhận bắt đầu chuyến"),
            n("moving", 1, 7, "task", "Cập nhật trạng thái đang di chuyển"),
            n("track_trip", 0, 8, "task", "Theo dõi hành trình"),
            n("complete_driver", 2, 9, "task", "Xác nhận hoàn thành chuyến"),
            n("complete_system", 1, 10, "task", "Ghi nhận chuyến hoàn thành"),
            n("invoice", 0, 11, "task", "Xem hóa đơn và kết quả chuyến"),
            n("end", 1, 12, "end", "Kết thúc"),
        ),
        (
            e("start", "go_pickup"),
            e("go_pickup", "track_driver"),
            e("track_driver", "arrive"),
            e("arrive", "notify_arrive"),
            e("notify_arrive", "board"),
            e("board", "start_trip"),
            e("start_trip", "moving"),
            e("moving", "track_trip"),
            e("track_trip", "complete_driver"),
            e("complete_driver", "complete_system"),
            e("complete_system", "invoice"),
            e("invoice", "end"),
        ),
    ),
    ProcessSpec(
        "04_bpmn_cancellation.png",
        "BPMN-04: Quy trình hủy chuyến",
        ("Người yêu cầu hủy", "Hệ thống", "Tài chính", "Bên còn lại"),
        (
            n("start", 0, 0, "start", "Bắt đầu"),
            n("send_cancel", 0, 1, "task", "Gửi yêu cầu hủy chuyến"),
            n("completed", 1, 2, "gateway", "Chuyến đã hoàn thành?"),
            n("reject", 1, 3, "task", "Từ chối hủy chuyến"),
            n("eligible", 1, 4, "gateway", "Đủ điều kiện hủy?"),
            n("not_allowed", 1, 5, "task", "Thông báo không được hủy"),
            n("fee_refund", 1, 6, "gateway", "Có phí hoặc hoàn tiền?"),
            n("finance", 2, 7, "task", "Xử lý phí hủy hoặc hoàn tiền"),
            n("update_cancel", 1, 8, "task", "Cập nhật trạng thái chuyến đã hủy"),
            n("release", 1, 9, "task", "Giải phóng tài xế hoặc yêu cầu đặt xe"),
            n("notify_other", 3, 10, "task", "Nhận thông báo hủy chuyến"),
            n("end", 1, 11, "end", "Kết thúc"),
        ),
        (
            e("start", "send_cancel"),
            e("send_cancel", "completed"),
            e("completed", "reject", "Có"),
            e("reject", "end"),
            e("completed", "eligible", "Không"),
            e("eligible", "not_allowed", "Không"),
            e("not_allowed", "end"),
            e("eligible", "fee_refund", "Có"),
            e("fee_refund", "finance", "Có"),
            e("finance", "update_cancel"),
            e("fee_refund", "update_cancel", "Không"),
            e("update_cancel", "release"),
            e("release", "notify_other"),
            e("notify_other", "end"),
        ),
    ),
    ProcessSpec(
        "05_bpmn_payment_wallet.png",
        "BPMN-05: Quy trình thanh toán và ví tài xế",
        ("Khách hàng", "Hệ thống", "Tài xế", "Quản trị viên"),
        (
            n("start", 1, 0, "start", "Chuyến hoàn thành"),
            n("pay_type", 1, 1, "gateway", "Hình thức thanh toán?"),
            n("cash", 0, 2, "task", "Trả tiền mặt cho tài xế"),
            n("record_cash", 1, 3, "task", "Ghi nhận tiền mặt tài xế đã thu"),
            n("earning", 1, 4, "task", "Tính thu nhập và phí nền tảng"),
            n("available", 1, 5, "task", "Chuyển thu nhập đủ điều kiện thành số dư khả dụng"),
            n("debt", 2, 6, "gateway", "Có công nợ tiền mặt?"),
            n("track_debt", 2, 7, "task", "Theo dõi thu nhập chờ và công nợ"),
            n("withdraw", 2, 8, "task", "Gửi yêu cầu rút tiền"),
            n("request_ok", 3, 9, "gateway", "Yêu cầu hợp lệ?"),
            n("reject", 3, 10, "task", "Từ chối và nêu lý do"),
            n("approve", 3, 11, "task", "Duyệt yêu cầu rút tiền"),
            n("wallet", 1, 12, "task", "Cập nhật giao dịch và số dư ví"),
            n("end", 1, 13, "end", "Kết thúc"),
        ),
        (
            e("start", "pay_type"),
            e("pay_type", "cash", "Tiền mặt"),
            e("cash", "record_cash"),
            e("record_cash", "earning"),
            e("pay_type", "earning", "Online/ví"),
            e("earning", "available"),
            e("available", "debt"),
            e("debt", "track_debt", "Có"),
            e("track_debt", "withdraw"),
            e("debt", "withdraw", "Không"),
            e("withdraw", "request_ok"),
            e("request_ok", "reject", "Không"),
            e("reject", "end"),
            e("request_ok", "approve", "Có"),
            e("approve", "wallet"),
            e("wallet", "end"),
        ),
    ),
    ProcessSpec(
        "06_bpmn_support_admin.png",
        "BPMN-06: Quy trình hỗ trợ sau chuyến và quản trị vận hành",
        ("Khách hàng/Tài xế", "Hệ thống", "Quản trị viên"),
        (
            n("start", 0, 0, "start", "Phát sinh nhu cầu hỗ trợ"),
            n("type", 0, 1, "gateway", "Loại yêu cầu?"),
            n("complaint", 0, 2, "task", "Gửi phản ánh hoặc khiếu nại"),
            n("record", 1, 3, "task", "Ghi nhận yêu cầu và thông báo trạng thái"),
            n("need_admin", 1, 4, "gateway", "Cần quản trị viên xử lý?"),
            n("guide", 1, 5, "task", "Trả hướng dẫn hỗ trợ thông thường"),
            n("check", 2, 5, "task", "Kiểm tra thông tin chuyến, tài khoản hoặc giao dịch"),
            n("result", 2, 6, "gateway", "Kết quả xử lý?"),
            n("reject", 2, 7, "task", "Từ chối yêu cầu và ghi lý do"),
            n("resolve", 2, 8, "task", "Xử lý yêu cầu và cập nhật kết quả"),
            n("notify", 1, 9, "task", "Thông báo kết quả cho người dùng"),
            n("end", 1, 10, "end", "Kết thúc"),
        ),
        (
            e("start", "type"),
            e("type", "guide", "Hỗ trợ thường"),
            e("type", "complaint", "Phản ánh/khiếu nại"),
            e("complaint", "record"),
            e("record", "need_admin"),
            e("need_admin", "guide", "Không"),
            e("guide", "notify"),
            e("need_admin", "check", "Có"),
            e("check", "result"),
            e("result", "reject", "Từ chối"),
            e("reject", "notify"),
            e("result", "resolve", "Xử lý"),
            e("resolve", "notify"),
            e("notify", "end"),
        ),
    ),
)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        line = words[0]
        for word in words[1:]:
            trial = f"{line} {word}"
            if draw.textlength(trial, font=fnt) <= max_width:
                line = trial
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def text_block_size(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    fnt: ImageFont.ImageFont,
    leading: int = 12,
) -> tuple[int, int, int]:
    bbox = draw.textbbox((0, 0), "Ag", font=fnt)
    line_h = bbox[3] - bbox[1] + leading
    widths = [math.ceil(draw.textlength(line, font=fnt)) for line in lines] or [0]
    return max(widths), max(1, len(lines)) * line_h - leading, line_h


def draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    lines: list[str],
    fnt: ImageFont.ImageFont,
    fill: str = INK,
) -> None:
    _, text_h, line_h = text_block_size(draw, lines, fnt)
    y = box[1] + (box[3] - box[1] - text_h) / 2
    for line in lines:
        width = draw.textlength(line, font=fnt)
        x = box[0] + (box[2] - box[0] - width) / 2
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h


def measure_node(
    draw: ImageDraw.ImageDraw,
    spec: NodeSpec,
    lane_w: int,
) -> tuple[int, int, list[str], tuple[int, int, int, int]]:
    node_w = min(560, lane_w - 92)

    if spec.kind in {"start", "end"}:
        diameter = 90
        lines = wrap_text(draw, spec.label, FONT_EVENT, min(node_w, lane_w - 110))
        text_w, text_h, _ = text_block_size(draw, lines, FONT_EVENT)
        width = max(diameter, text_w)
        height = diameter + 16 + text_h
        text_box = (0, diameter + 16, width, height)
        return width, height, lines, text_box

    if spec.kind == "gateway":
        diamond_w = min(430, lane_w - 108)
        text_w = int(diamond_w * 0.64)
        lines = wrap_text(draw, spec.label, FONT_NODE_BOLD, text_w)
        _, text_h, _ = text_block_size(draw, lines, FONT_NODE_BOLD)
        diamond_h = max(178, text_h + 98)
        text_box = (
            int((diamond_w - text_w) / 2),
            int((diamond_h - text_h) / 2 - 10),
            int((diamond_w + text_w) / 2),
            int((diamond_h + text_h) / 2 + 10),
        )
        return diamond_w, diamond_h, lines, text_box

    lines = wrap_text(draw, spec.label, FONT_NODE, node_w - 50)
    _, text_h, _ = text_block_size(draw, lines, FONT_NODE)
    height = max(116, text_h + 54)
    text_box = (24, 18, node_w - 24, height - 18)
    return node_w, height, lines, text_box


def build_layout(
    draw: ImageDraw.ImageDraw,
    process: ProcessSpec,
) -> tuple[dict[str, NodeLayout], list[tuple[int, int, int, int]], int, int, int]:
    lane_count = len(process.lanes)
    lane_w = (CANVAS_W - MARGIN_X * 2) // lane_count
    body_top = TOP + TITLE_H

    measured: dict[str, tuple[int, int, list[str], tuple[int, int, int, int]]] = {}
    max_h = 0
    for spec in process.nodes:
        measured[spec.id] = measure_node(draw, spec, lane_w)
        max_h = max(max_h, measured[spec.id][1])

    step_gap = max(178, max_h + 40)
    first_center_y = body_top + HEADER_H + max(110, max_h // 2 + 34)
    max_step = max(node.step for node in process.nodes)
    lane_bottom = int(first_center_y + max_step * step_gap + max_h / 2 + BOTTOM_PAD)
    canvas_h = lane_bottom + CAPTION_H

    lane_boxes: list[tuple[int, int, int, int]] = []
    for idx in range(lane_count):
        x0 = MARGIN_X + idx * lane_w
        x1 = MARGIN_X + (idx + 1) * lane_w if idx < lane_count - 1 else CANVAS_W - MARGIN_X
        lane_boxes.append((x0, body_top, x1, lane_bottom))

    layouts: dict[str, NodeLayout] = {}
    for spec in process.nodes:
        width, height, lines, rel_text_box = measured[spec.id]
        lane_box = lane_boxes[spec.lane]
        cx = (lane_box[0] + lane_box[2]) // 2
        cy = int(first_center_y + spec.step * step_gap)
        x0 = int(cx - width / 2)
        y0 = int(cy - height / 2)
        box = (x0, y0, x0 + width, y0 + height)

        if spec.kind in {"start", "end"}:
            diameter = 90
            sx0 = int(cx - diameter / 2)
            sy0 = y0
            shape_box = (sx0, sy0, sx0 + diameter, sy0 + diameter)
        else:
            shape_box = box

        text_box = (
            box[0] + rel_text_box[0],
            box[1] + rel_text_box[1],
            box[0] + rel_text_box[2],
            box[1] + rel_text_box[3],
        )
        layouts[spec.id] = NodeLayout(spec, box, shape_box, text_box, lines)

    return layouts, lane_boxes, lane_bottom, step_gap, canvas_h


def anchor(layout: NodeLayout, side: str) -> tuple[int, int]:
    x0, y0, x1, y1 = layout.shape_box
    if layout.spec.kind in {"start", "end"} and side == "bottom":
        return ((layout.box[0] + layout.box[2]) // 2, layout.box[3])
    if side == "top":
        return ((x0 + x1) // 2, y0)
    if side == "bottom":
        return ((x0 + x1) // 2, y1)
    if side == "left":
        return (x0, (y0 + y1) // 2)
    if side == "right":
        return (x1, (y0 + y1) // 2)
    raise ValueError(side)


def arrow_head(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], fill: str) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0 and dy == 0:
        return
    angle = math.atan2(dy, dx)
    length = 18
    spread = math.radians(30)
    points = [
        end,
        (
            int(end[0] - length * math.cos(angle - spread)),
            int(end[1] - length * math.sin(angle - spread)),
        ),
        (
            int(end[0] - length * math.cos(angle + spread)),
            int(end[1] - length * math.sin(angle + spread)),
        ),
    ]
    draw.polygon(points, fill=fill)


def draw_polyline(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    fill: str = INK,
    width: int = 4,
) -> None:
    clean_points = [points[0]]
    for point in points[1:]:
        if point != clean_points[-1]:
            clean_points.append(point)

    if len(clean_points) < 2:
        return

    for start, end in zip(clean_points, clean_points[1:]):
        draw.line((start, end), fill=fill, width=width)
    arrow_head(draw, clean_points[-2], clean_points[-1], fill)


def route_edge(
    source: NodeLayout,
    target: NodeLayout,
    lane_boxes: list[tuple[int, int, int, int]],
) -> list[tuple[int, int]]:
    source_cy = source.cy
    target_cy = target.cy
    source_cx = source.cx
    target_cx = target.cx

    if target_cy > source_cy:
        start = anchor(source, "bottom")
        end = anchor(target, "top")
        if target.spec.step > source.spec.step + 1:
            if source.spec.lane != target.spec.lane:
                if target_cx <= source_cx:
                    start = anchor(source, "left")
                    end = anchor(target, "left")
                    rail_x = min(source.shape_box[0], target.shape_box[0]) - 42
                    rail_x = max(lane_boxes[min(source.spec.lane, target.spec.lane)][0] + 24, rail_x)
                else:
                    start = anchor(source, "right")
                    end = anchor(target, "right")
                    rail_x = max(source.shape_box[2], target.shape_box[2]) + 42
                    rail_x = min(lane_boxes[max(source.spec.lane, target.spec.lane)][2] - 24, rail_x)
                return [start, (rail_x, start[1]), (rail_x, end[1]), end]

            lane_box = lane_boxes[source.spec.lane]
            right_space = lane_box[2] - max(source.shape_box[2], target.shape_box[2])
            left_space = min(source.shape_box[0], target.shape_box[0]) - lane_box[0]
            if right_space >= left_space:
                start = anchor(source, "right")
                end = anchor(target, "right")
                rail_x = lane_box[2] - 24
            else:
                start = anchor(source, "left")
                end = anchor(target, "left")
                rail_x = lane_box[0] + 24
            return [start, (rail_x, start[1]), (rail_x, end[1]), end]
        if abs(source_cx - target_cx) < 8:
            return [start, end]
        mid_y = int((start[1] + end[1]) / 2)
        return [start, (start[0], mid_y), (end[0], mid_y), end]

    source_lane = source.spec.lane
    target_lane = target.spec.lane
    if target_cx <= source_cx:
        start = anchor(source, "left")
        end = anchor(target, "left")
        rail_x = min(source.shape_box[0], target.shape_box[0]) - 42
        rail_x = max(lane_boxes[min(source_lane, target_lane)][0] + 24, rail_x)
    else:
        start = anchor(source, "right")
        end = anchor(target, "right")
        rail_x = max(source.shape_box[2], target.shape_box[2]) + 42
        rail_x = min(lane_boxes[max(source_lane, target_lane)][2] - 24, rail_x)
    return [start, (rail_x, start[1]), (rail_x, end[1]), end]


def label_position(points: list[tuple[int, int]]) -> tuple[int, int]:
    best_start = points[0]
    best_end = points[-1]
    best_len = -1.0
    for start, end in zip(points, points[1:]):
        segment_len = math.hypot(end[0] - start[0], end[1] - start[1])
        if segment_len > best_len:
            best_len = segment_len
            best_start = start
            best_end = end
    return ((best_start[0] + best_end[0]) // 2, (best_start[1] + best_end[1]) // 2)


def draw_edge_label(draw: ImageDraw.ImageDraw, label: str, points: list[tuple[int, int]]) -> None:
    cx, cy = label_position(points)
    lines = wrap_text(draw, label, FONT_EDGE, 190)
    width, height, _ = text_block_size(draw, lines, FONT_EDGE, leading=8)
    pad_x = 14
    pad_y = 8
    box = (
        int(cx - width / 2 - pad_x),
        int(cy - height / 2 - pad_y),
        int(cx + width / 2 + pad_x),
        int(cy + height / 2 + pad_y),
    )
    draw.rounded_rectangle(box, radius=10, fill=WHITE, outline="#bfdbfe", width=2)
    draw_centered_lines(draw, box, lines, FONT_EDGE, fill=BLUE)


def draw_node(draw: ImageDraw.ImageDraw, layout: NodeLayout) -> None:
    spec = layout.spec
    x0, y0, x1, y1 = layout.shape_box

    if spec.kind == "task":
        draw.rounded_rectangle(layout.shape_box, radius=22, fill=TASK_FILL, outline=INK, width=4)
        draw_centered_lines(draw, layout.text_box, layout.lines, FONT_NODE)
        return

    if spec.kind == "gateway":
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        points = [(cx, y0), (x1, cy), (cx, y1), (x0, cy)]
        draw.polygon(points, fill=GATEWAY_FILL, outline=INK)
        draw.line(points + [points[0]], fill=INK, width=4)
        draw_centered_lines(draw, layout.text_box, layout.lines, FONT_NODE_BOLD)
        return

    draw.ellipse(layout.shape_box, fill=WHITE, outline=INK, width=5 if spec.kind == "start" else 7)
    if spec.kind == "end":
        inset = 9
        draw.ellipse((x0 + inset, y0 + inset, x1 - inset, y1 - inset), outline=INK, width=3)
    draw_centered_lines(draw, layout.text_box, layout.lines, FONT_EVENT)


def draw_title(draw: ImageDraw.ImageDraw, title: str) -> None:
    lines = wrap_text(draw, title, FONT_TITLE, CANVAS_W - MARGIN_X * 2)
    draw_centered_lines(draw, (MARGIN_X, TOP, CANVAS_W - MARGIN_X, TOP + TITLE_H), lines, FONT_TITLE)


def draw_lanes(
    draw: ImageDraw.ImageDraw,
    process: ProcessSpec,
    lane_boxes: list[tuple[int, int, int, int]],
) -> None:
    for idx, (label, box) in enumerate(zip(process.lanes, lane_boxes)):
        fill = LANE_A if idx % 2 == 0 else LANE_B
        x0, y0, x1, y1 = box
        draw.rectangle(box, fill=fill, outline=LANE_BORDER, width=3)
        header = (x0, y0, x1, y0 + HEADER_H)
        draw.rectangle(header, fill=LANE_HEADER, outline=LANE_BORDER, width=3)
        lines = wrap_text(draw, label, FONT_HEADER, x1 - x0 - 44)
        draw_centered_lines(draw, header, lines, FONT_HEADER)


def render_process(process: ProcessSpec) -> Path:
    scratch = Image.new("RGB", (CANVAS_W, 100), WHITE)
    scratch_draw = ImageDraw.Draw(scratch)
    layouts, lane_boxes, lane_bottom, _, canvas_h = build_layout(scratch_draw, process)

    image = Image.new("RGB", (CANVAS_W, canvas_h), WHITE)
    draw = ImageDraw.Draw(image)

    draw_title(draw, process.title)
    draw_lanes(draw, process, lane_boxes)

    label_jobs: list[tuple[str, list[tuple[int, int]]]] = []
    for edge in process.edges:
        source = layouts[edge.source]
        target = layouts[edge.target]
        points = route_edge(source, target, lane_boxes)
        draw_polyline(draw, points)
        if edge.label:
            label_jobs.append((edge.label, points))

    for layout in layouts.values():
        draw_node(draw, layout)

    for label, points in label_jobs:
        draw_edge_label(draw, label, points)

    caption_box = (MARGIN_X, lane_bottom + 14, CANVAS_W - MARGIN_X, canvas_h - 24)
    caption_lines = wrap_text(draw, process.title, FONT_CAPTION, CANVAS_W - MARGIN_X * 2)
    draw_centered_lines(draw, caption_box, caption_lines, FONT_CAPTION)

    BPMN_DIR.mkdir(parents=True, exist_ok=True)
    output = BPMN_DIR / process.filename
    image.save(output, dpi=(300, 300))
    return output


def main() -> None:
    for process in PROCESSES:
        output = render_process(process)
        print(f"Rendered {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
