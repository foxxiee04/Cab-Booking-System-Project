from __future__ import annotations

import argparse
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = Path(r"E:\Nam4 - Ki 2\KLTN2025\KLTN_IS_TranQuocSang_DuongDucQuy.docx")
BPMN_DIR = ROOT / "diagrams" / "02_analysis_design" / "00_bpmn"
ACTIVITY_DIR = ROOT / "diagrams" / "02_analysis_design" / "02_activity"
SEQUENCE_DIR = ROOT / "diagrams" / "02_analysis_design" / "03_sequence"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "v": "urn:schemas-microsoft-com:vml",
}

for prefix, uri in NS.items():
    if prefix in {"rel", "ct"}:
        ET.register_namespace("", uri)
    else:
        ET.register_namespace(prefix, uri)

EMU_PER_INCH = 914400
MAX_IMAGE_WIDTH_IN = 6.10
MAX_IMAGE_HEIGHT_IN = 8.65
IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
CODEX_MEDIA_PREFIX = "media/codex_replacement_"
MIN_DRAWING_EMU = 635  # 0.05pt: invisible for straight connectors, valid for Word extents.


@dataclass(frozen=True)
class Replacement:
    caption_key: str
    image_path: Path


BPMN_REPLACEMENTS = (
    Replacement("BPMN quy trình quản lý tài khoản và hồ sơ người dùng", BPMN_DIR / "01_bpmn_account_profile.png"),
    Replacement("BPMN quy trình đặt xe và điều phối tài xế", BPMN_DIR / "02_bpmn_booking_dispatch.png"),
    Replacement("BPMN quy trình thực hiện và theo dõi chuyến đi", BPMN_DIR / "03_bpmn_ride_execution_tracking.png"),
    Replacement("BPMN quy trình hủy chuyến", BPMN_DIR / "04_bpmn_cancellation.png"),
    Replacement("BPMN quy trình thanh toán và ví tài xế", BPMN_DIR / "05_bpmn_payment_wallet.png"),
    Replacement("BPMN quy trình hỗ trợ sau chuyến và quản trị vận hành", BPMN_DIR / "06_bpmn_support_admin.png"),
)

ACTIVITY_REPLACEMENTS = (
    Replacement("Activity Diagram - Đăng ký tài khoản khách hàng", ACTIVITY_DIR / "26_customer_registration_activity.png"),
    Replacement("Activity Diagram - Đăng nhập khách hàng", ACTIVITY_DIR / "27_customer_login_activity.png"),
    Replacement("Activity Diagram - Quản lý hồ sơ cá nhân", ACTIVITY_DIR / "08_profile_management_activity.png"),
    Replacement("Activity Diagram - Ước tính giá chuyến đi", ACTIVITY_DIR / "09_fare_estimation_activity.png"),
    Replacement("Activity Diagram - Đặt xe và tìm tài xế", ACTIVITY_DIR / "02_customer_booking_activity.png"),
    Replacement("Activity Diagram - Theo dõi chuyến đi thời gian thực", ACTIVITY_DIR / "14_realtime_tracking_activity.png"),
    Replacement("Activity Diagram - Chat và gọi trong chuyến", ACTIVITY_DIR / "20_chat_notification_activity.png"),
    Replacement("Activity Diagram - Hủy chuyến", ACTIVITY_DIR / "15_cancellation_refund_activity.png"),
    Replacement("Activity Diagram - Thanh toán chuyến đi online", ACTIVITY_DIR / "16_online_payment_activity.png"),
    Replacement("Activity Diagram - Áp dụng voucher", ACTIVITY_DIR / "06_voucher_review_activity.png"),
    Replacement("Activity Diagram - Đánh giá tài xế", ACTIVITY_DIR / "06_voucher_review_activity.png"),
    Replacement("Activity Diagram - Xem lịch sử chuyến đi", ACTIVITY_DIR / "13_ride_lifecycle_activity.png"),
    Replacement("Activity Diagram - Sử dụng AI chatbot hỗ trợ", ACTIVITY_DIR / "21_ai_support_activity.png"),
    Replacement("Activity Diagram - Đăng ký tài xế", ACTIVITY_DIR / "03_driver_onboarding_activity.png"),
    Replacement("Activity Diagram - Đăng nhập tài xế", ACTIVITY_DIR / "28_driver_login_activity.png"),
    Replacement("Activity Diagram - Bật/tắt trạng thái nhận chuyến", ACTIVITY_DIR / "12_driver_availability_activity.png"),
    Replacement("Activity Diagram - Cập nhật vị trí tài xế", ACTIVITY_DIR / "14_realtime_tracking_activity.png"),
    Replacement("Activity Diagram - Nhận và chấp nhận chuyến", ACTIVITY_DIR / "11_driver_acceptance_activity.png"),
    Replacement("Activity Diagram - Cập nhật trạng thái chuyến đi", ACTIVITY_DIR / "13_ride_lifecycle_activity.png"),
    Replacement("Activity Diagram - Nạp tiền ví tài xế", ACTIVITY_DIR / "17_driver_wallet_topup_activity.png"),
    Replacement("Activity Diagram - Yêu cầu rút tiền ví tài xế", ACTIVITY_DIR / "18_driver_withdrawal_activity.png"),
    Replacement("Activity Diagram - Xem doanh thu và lịch sử giao dịch", ACTIVITY_DIR / "04_payment_wallet_activity.png"),
    Replacement("Activity Diagram - Đăng nhập quản trị viên", ACTIVITY_DIR / "29_admin_login_activity.png"),
    Replacement("Activity Diagram - Duyệt hồ sơ tài xế", ACTIVITY_DIR / "03_driver_onboarding_activity.png"),
    Replacement("Activity Diagram - Quản lý khách hàng, tài xế và chuyến đi", ACTIVITY_DIR / "05_admin_operations_activity.png"),
    Replacement("Activity Diagram - Quản lý bảng giá và voucher", ACTIVITY_DIR / "06_voucher_review_activity.png"),
    Replacement("Activity Diagram - Quản lý thanh toán và ví thương nhân", ACTIVITY_DIR / "04_payment_wallet_activity.png"),
    Replacement("Activity Diagram - Xem dashboard, báo cáo và log", ACTIVITY_DIR / "05_admin_operations_activity.png"),
    Replacement("Activity Diagram - Gửi và quản lý thông báo", ACTIVITY_DIR / "20_chat_notification_activity.png"),
    Replacement("Activity Diagram - Xử lý khiếu nại và hỗ trợ", ACTIVITY_DIR / "19_complaint_handling_activity.png"),
    Replacement("Activity Diagram - Quên mật khẩu và đặt lại mật khẩu", ACTIVITY_DIR / "23_forgot_password_activity.png"),
    Replacement("Activity Diagram - Đăng xuất", ACTIVITY_DIR / "24_logout_activity.png"),
    Replacement("Activity Diagram - Thanh toán tiền mặt và ghi công nợ tài xế", ACTIVITY_DIR / "25_cash_payment_debt_activity.png"),
)

SEQUENCE_REPLACEMENTS = (
    Replacement("Sequence Diagram - Đăng ký tài khoản khách hàng", SEQUENCE_DIR / "30_customer_registration_sequence.png"),
    Replacement("Sequence Diagram - Đăng nhập khách hàng", SEQUENCE_DIR / "31_customer_login_sequence.png"),
    Replacement("Sequence Diagram - Đăng nhập tài xế", SEQUENCE_DIR / "32_driver_login_sequence.png"),
    Replacement("Sequence Diagram - Đăng nhập quản trị viên", SEQUENCE_DIR / "33_admin_login_sequence.png"),
)

ALL_REPLACEMENTS = BPMN_REPLACEMENTS + ACTIVITY_REPLACEMENTS + SEQUENCE_REPLACEMENTS


def qn(prefix: str, name: str) -> str:
    return f"{{{NS[prefix]}}}{name}"


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS)).strip()


def paragraph_texts(document_xml: bytes) -> list[str]:
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        return []
    return [paragraph_text(p) for p in body.findall("w:p", NS)]


def next_nonempty_text(paragraphs: list[ET.Element], index: int) -> str:
    for paragraph in paragraphs[index + 1 : min(len(paragraphs), index + 5)]:
        text = paragraph_text(paragraph)
        if text:
            return text
    return ""


def find_replacement(caption: str) -> Replacement | None:
    for replacement in ALL_REPLACEMENTS:
        if replacement.caption_key in caption:
            return replacement
    return None


def existing_media_relationships(rels_root: ET.Element) -> dict[str, str]:
    result: dict[str, str] = {}
    for rel in rels_root.findall("rel:Relationship", NS):
        target = rel.attrib.get("Target", "")
        if target.startswith("media/"):
            result[rel.attrib["Id"]] = target
    return result


def remove_old_codex_relationships(rels_root: ET.Element) -> None:
    for rel in list(rels_root.findall("rel:Relationship", NS)):
        if rel.attrib.get("Target", "").startswith(CODEX_MEDIA_PREFIX):
            rels_root.remove(rel)


def next_rid_factory(rels_root: ET.Element):
    max_id = 0
    for rel in rels_root.findall("rel:Relationship", NS):
        match = re.fullmatch(r"rId(\d+)", rel.attrib.get("Id", ""))
        if match:
            max_id = max(max_id, int(match.group(1)))

    def next_rid() -> str:
        nonlocal max_id
        max_id += 1
        return f"rId{max_id}"

    return next_rid


def add_image_relationship(rels_root: ET.Element, rid: str, target: str) -> None:
    ET.SubElement(
        rels_root,
        qn("rel", "Relationship"),
        {"Id": rid, "Type": IMAGE_REL_TYPE, "Target": target},
    )


def image_size_inches(image_path: Path, max_width_in: float) -> tuple[int, int]:
    with Image.open(image_path) as image:
        width_px, height_px = image.size

    aspect = height_px / width_px
    width_in = min(max_width_in, MAX_IMAGE_WIDTH_IN)
    height_in = width_in * aspect
    if height_in > MAX_IMAGE_HEIGHT_IN:
        height_in = MAX_IMAGE_HEIGHT_IN
        width_in = height_in / aspect

    return int(round(width_in * EMU_PER_INCH)), int(round(height_in * EMU_PER_INCH))


def update_drawing_size(drawing_parent: ET.Element, cx: int, cy: int) -> None:
    for extent in drawing_parent.findall(".//wp:extent", NS):
        extent.set("cx", str(cx))
        extent.set("cy", str(cy))

    for xfrm_ext in drawing_parent.findall(".//pic:spPr/a:xfrm/a:ext", NS):
        xfrm_ext.set("cx", str(cx))
        xfrm_ext.set("cy", str(cy))


def media_name(index: int, source: Path) -> str:
    safe = re.sub(r"[^A-Za-z0-9_]+", "_", source.stem).strip("_").lower()
    return f"{CODEX_MEDIA_PREFIX}{index:03d}_{safe}.png"


def ensure_png_content_type(content_types_root: ET.Element) -> None:
    for default in content_types_root.findall("ct:Default", NS):
        if default.attrib.get("Extension", "").lower() == "png":
            default.set("ContentType", "image/png")
            return

    ET.SubElement(
        content_types_root,
        qn("ct", "Default"),
        {"Extension": "png", "ContentType": "image/png"},
    )


def set_update_fields(settings_xml: bytes | None) -> bytes | None:
    if settings_xml is None:
        return None

    root = ET.fromstring(settings_xml)
    update_fields = root.find("w:updateFields", NS)
    if update_fields is None:
        update_fields = ET.SubElement(root, qn("w", "updateFields"))
    update_fields.set(qn("w", "val"), "true")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def fix_nonpositive_drawing_extents(document_root: ET.Element) -> int:
    fixed = 0
    for extent in document_root.findall(".//wp:extent", NS) + document_root.findall(".//a:xfrm/a:ext", NS):
        for attr in ("cx", "cy"):
            try:
                value = int(extent.attrib.get(attr, "0"))
            except ValueError:
                value = 0
            if value <= 0:
                extent.set(attr, str(MIN_DRAWING_EMU))
                fixed += 1

    for shape in document_root.findall(".//v:shape", NS):
        style = shape.attrib.get("style", "")
        next_style = re.sub(r"(?i)(^|;)height:0(?=;|$)", r"\1height:.05pt", style)
        next_style = re.sub(r"(?i)(^|;)width:0(?=;|$)", r"\1width:.05pt", next_style)
        if next_style != style:
            shape.set("style", next_style)
            fixed += 1

    return fixed


def has_toc(document_xml: bytes) -> bool:
    root = ET.fromstring(document_xml)
    for instr in root.findall(".//w:instrText", NS):
        if instr.text and "TOC" in instr.text.upper():
            return True
    return False


def update_docx(docx_path: Path) -> tuple[Path, list[str], bool, bool, int]:
    if not docx_path.exists():
        raise FileNotFoundError(docx_path)
    if docx_path.suffix.lower() != ".docx":
        raise ValueError(f"Expected .docx file, got {docx_path}")

    for replacement in ALL_REPLACEMENTS:
        if not replacement.image_path.exists():
            raise FileNotFoundError(replacement.image_path)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = docx_path.with_name(f"{docx_path.stem}.before-image-replace-{timestamp}{docx_path.suffix}")
    shutil.copy2(docx_path, backup)

    new_media: dict[str, bytes] = {}
    logs: list[str] = []

    with ZipFile(backup, "r") as zin:
        document_xml = zin.read("word/document.xml")
        rels_xml = zin.read("word/_rels/document.xml.rels")
        settings_xml = zin.read("word/settings.xml") if "word/settings.xml" in zin.namelist() else None
        content_types_xml = zin.read("[Content_Types].xml")

        original_texts = paragraph_texts(document_xml)
        document_root = ET.fromstring(document_xml)
        rels_root = ET.fromstring(rels_xml)
        content_types_root = ET.fromstring(content_types_xml)
        fixed_drawings = fix_nonpositive_drawing_extents(document_root)
        remove_old_codex_relationships(rels_root)
        next_rid = next_rid_factory(rels_root)
        old_media = existing_media_relationships(rels_root)

        body = document_root.find("w:body", NS)
        if body is None:
            raise ValueError("word/document.xml has no body")

        paragraphs = body.findall("w:p", NS)
        replacement_index = 0
        for index, paragraph in enumerate(paragraphs):
            caption = next_nonempty_text(paragraphs, index)
            replacement = find_replacement(caption)
            if replacement is None:
                continue

            blips = paragraph.findall(".//a:blip", NS)
            if not blips:
                continue

            for blip in blips:
                old_rid = blip.attrib.get(qn("r", "embed"))
                old_target = old_media.get(old_rid or "", "")
                replacement_index += 1
                rid = next_rid()
                target = media_name(replacement_index, replacement.image_path)
                add_image_relationship(rels_root, rid, target)
                new_media[f"word/{target}"] = replacement.image_path.read_bytes()
                blip.set(qn("r", "embed"), rid)

                drawing_parent = paragraph
                current_extent = paragraph.find(".//wp:extent", NS)
                current_width_in = MAX_IMAGE_WIDTH_IN
                if current_extent is not None and current_extent.attrib.get("cx"):
                    current_width_in = min(current_width_in, int(current_extent.attrib["cx"]) / EMU_PER_INCH)
                cx, cy = image_size_inches(replacement.image_path, current_width_in)
                update_drawing_size(drawing_parent, cx, cy)

                logs.append(
                    f"{caption} | {old_rid}:{old_target} -> {rid}:{target} "
                    f"({cx / EMU_PER_INCH:.2f}in x {cy / EMU_PER_INCH:.2f}in)"
                )

        if not logs:
            raise ValueError("No matching BPMN, Activity, or Sequence captions found")

        ensure_png_content_type(content_types_root)
        updated_document_xml = ET.tostring(document_root, encoding="utf-8", xml_declaration=True)
        updated_rels_xml = ET.tostring(rels_root, encoding="utf-8", xml_declaration=True)
        updated_settings_xml = set_update_fields(settings_xml)
        updated_content_types_xml = ET.tostring(content_types_root, encoding="utf-8", xml_declaration=True)

        text_unchanged = original_texts == paragraph_texts(updated_document_xml)
        toc_present = has_toc(updated_document_xml)

        fd, tmp_name = tempfile.mkstemp(prefix="docx-image-replace-", suffix=".docx", dir=str(docx_path.parent))
        os.close(fd)
        tmp_path = Path(tmp_name)
        try:
            with ZipFile(tmp_path, "w", ZIP_DEFLATED) as zout:
                for info in zin.infolist():
                    name = info.filename
                    if name in {
                        "word/document.xml",
                        "word/_rels/document.xml.rels",
                        "word/settings.xml",
                        "[Content_Types].xml",
                    }:
                        continue
                    if name.startswith(f"word/{CODEX_MEDIA_PREFIX}"):
                        continue
                    zout.writestr(info, zin.read(name))

                zout.writestr("[Content_Types].xml", updated_content_types_xml)
                zout.writestr("word/_rels/document.xml.rels", updated_rels_xml)
                zout.writestr("word/document.xml", updated_document_xml)
                if updated_settings_xml is not None:
                    zout.writestr("word/settings.xml", updated_settings_xml)
                for name, content in new_media.items():
                    zout.writestr(name, content)

            os.replace(tmp_path, docx_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    return backup, logs, text_unchanged, toc_present, fixed_drawings


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace BPMN, Activity, and selected Sequence images inside a Word document.")
    parser.add_argument("--docx", type=Path, default=DEFAULT_DOCX)
    args = parser.parse_args()

    backup, logs, text_unchanged, toc_present, fixed_drawings = update_docx(args.docx)
    print(f"BACKUP={backup}")
    print(f"REPLACED={len(logs)}")
    print(f"DRAWING_EXTENTS_REPAIRED={fixed_drawings}")
    print(f"TEXT_UNCHANGED={text_unchanged}")
    print(f"TOC_FIELD_PRESENT={toc_present}")
    print("UPDATE_FIELDS_ON_OPEN=True")
    for line in logs:
        print(line)


if __name__ == "__main__":
    main()
