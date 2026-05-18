from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ACTIVITY_DIR = ROOT / "diagrams" / "02_analysis_design" / "02_activity"

CANVAS_W = 2400
MARGIN_X = 70
TOP = 70
HEADER_H = 82
LANE_GAP = 0
CAPTION_H = 135
BOTTOM_PAD = 70
RANK_GAP = 195
MIN_NODE_GAP = 58

INK = "#111827"
BLUE = "#0757a6"
WHITE = "#ffffff"
LANE_HEADER = "#f3f4f6"
ACTION_FILL = "#d9d9d9"


@dataclass
class Node:
    id: str
    label: str
    lane: int
    kind: str
    style: str
    order: int


@dataclass
class Edge:
    source: str
    target: str
    label: str | None = None
    dashed: bool = False


@dataclass
class Diagram:
    path: Path
    lanes: list[str]
    nodes: dict[str, Node]
    edges: list[Edge]


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


FONT_HEADER = font(44, True)
FONT_NODE = font(40)
FONT_NODE_BOLD = font(40, True)
FONT_EDGE = font(30)
FONT_CAPTION = font(46, True)
FONT_SMALL = font(30)


SUBGRAPH_RE = re.compile(r'^\s*subgraph\s+\w+\["(?P<label>.+?)"\]\s*$')
NODE_RE = re.compile(
    r"^\s*(?P<id>[A-Za-z][A-Za-z0-9_]*)\s*"
    r"(?P<body>(?:\(\[.*?\]\)|\{.*?\}|\[.*?\]))"
    r"\s*:::(?P<style>[A-Za-z][A-Za-z0-9_]*)\s*$"
)
ID_RE = re.compile(r"\s*(?P<id>[A-Za-z][A-Za-z0-9_]*)")
ARROW_RE = re.compile(
    r"\s*(?:(?P<plain>-->)|--\s*(?P<label>[^<>-]+?)\s*-->|-\.\s*(?P<dlabel>.*?)\s*\.->)\s*"
)

VI_LABELS = {
    "Actor: Admin": "Tác nhân: Quản trị viên",
    "Actor: Authenticated User": "Tác nhân: Người dùng đã đăng nhập",
    "Actor: Customer": "Tác nhân: Khách hàng",
    "Actor: Customer / Driver": "Tác nhân: Khách hàng / Tài xế",
    "Actor: Customer / Driver / Admin": "Tác nhân: Khách hàng / Tài xế / Quản trị viên",
    "Actor: Customer Booking": "Tác nhân: Đặt xe của khách hàng",
    "Actor: Driver": "Tác nhân: Tài xế",
    "Actor: Driver App": "Tác nhân: Ứng dụng tài xế",
    "Actor: Scheduler": "Tác nhân: Bộ lập lịch",
    "Actor: User": "Tác nhân: Người dùng",
    "System: AI Service": "Hệ thống: Dịch vụ AI",
    "System: Auth Service": "Hệ thống: Dịch vụ xác thực",
    "System: Client / API Gateway / Auth Service": "Hệ thống: Client / API Gateway / Auth",
    "System: Driver Review": "Hệ thống: Duyệt tài xế",
    "System: Driver Service / Redis GEO": "Hệ thống: Driver Service / Redis GEO",
    "System: FoxGo": "Hệ thống: FoxGo",
    "System: Gateway / Notification": "Hệ thống: Gateway / Thông báo",
    "System: Matching / Driver Pool": "Hệ thống: Ghép chuyến / Nhóm tài xế",
    "System: Operations Platform": "Hệ thống: Nền tảng vận hành",
    "System: Payment / Review": "Hệ thống: Thanh toán / Đánh giá",
    "System: Payment / Wallet": "Hệ thống: Thanh toán / Ví",
    "System: Payment Service": "Hệ thống: Dịch vụ thanh toán",
    "System: Pricing / Map": "Hệ thống: Định giá / Bản đồ",
    "System: Profile Service": "Hệ thống: Dịch vụ hồ sơ",
    "System: Realtime Gateway": "Hệ thống: Realtime Gateway",
    "System: Ride / Payment / Wallet": "Hệ thống: Chuyến đi / Thanh toán / Ví",
    "System: Ride Service": "Hệ thống: Dịch vụ chuyến đi",
    "System: Support / Admin": "Hệ thống: Hỗ trợ / Quản trị",
    "System: Wallet / Admin": "Hệ thống: Ví / Quản trị",
    "System: Wallet / Payment": "Hệ thống: Ví / Thanh toán",
    "System: Wallet Service": "Hệ thống: Dịch vụ ví",
    "AI/pricing model available?": "Mô hình AI/định giá sẵn sàng?",
    "Accept quote?": "Chấp nhận báo giá?",
    "Accept request?": "Nhận yêu cầu?",
    "Account exists and active?": "Tài khoản tồn tại và đang hoạt động?",
    "Account exists and role allowed?": "Tài khoản tồn tại và đúng vai trò?",
    "Acknowledge duplicate safely": "Xác nhận trùng lặp an toàn",
    "Activate driver profile and wallet": "Kích hoạt hồ sơ và ví tài xế",
    "Admin approves?": "Quản trị viên phê duyệt?",
    "Admin reviews case and contacts parties": "Quản trị viên xem xét và liên hệ các bên",
    "Allow driver matching without online checkout": "Cho phép ghép tài xế không cần thanh toán online",
    "Amount matches fare and fees?": "Số tiền khớp giá cước và phí?",
    "Amount matches ride fare and quote?": "Số tiền khớp giá chuyến và báo giá?",
    "Amount numeric, min/max valid?": "Số tiền hợp lệ theo min/max?",
    "Amount, balance, bank data valid?": "Số tiền, số dư, tài khoản ngân hàng hợp lệ?",
    "Another driver already assigned": "Đã có tài xế khác nhận chuyến",
    "Answer safe and confident?": "Câu trả lời an toàn và đủ tin cậy?",
    "Apply discount to fare": "Áp dụng giảm giá vào cước",
    "Apply surge, vehicle multiplier, voucher": "Áp dụng surge, hệ số xe và voucher",
    "Approve/reject driver application": "Duyệt/từ chối hồ sơ tài xế",
    "Approve/reject withdrawal or refund": "Duyệt/từ chối rút tiền hoặc hoàn tiền",
    "Approved?": "Được duyệt?",
    "Ask Mia support chatbot": "Hỏi chatbot hỗ trợ Mia",
    "Assign driver and create ride room": "Gán tài xế và tạo phòng chuyến đi",
    "Assignment lock acquired?": "Khóa gán chuyến thành công?",
    "Batch window and lock valid?": "Cửa sổ batch và khóa hợp lệ?",
    "Block offer because driver not eligible": "Chặn đề nghị vì tài xế chưa đủ điều kiện",
    "Booking active and quote not expired?": "Booking còn hiệu lực và báo giá chưa hết hạn?",
    "Booking created": "Booking đã được tạo",
    "Broadcast ARRIVING / ARRIVED": "Phát trạng thái ARRIVING / ARRIVED",
    "Broadcast location to customer room": "Phát vị trí tới phòng của khách hàng",
    "Build ride offer with route, fare, timeout": "Tạo đề nghị chuyến với tuyến, giá và thời hạn",
    "Cache quote with short TTL": "Lưu báo giá tạm thời với TTL ngắn",
    "Calculate cancellation fee and refund amount": "Tính phí hủy và số tiền hoàn",
    "Calculate distance, ETA, base fare": "Tính quãng đường, ETA và giá cơ bản",
    "Calculate fare, ETA, surge, discount": "Tính giá cước, ETA, surge và giảm giá",
    "Calculate fare, commission, discount, platform fee": "Tính cước, hoa hồng, giảm giá và phí nền tảng",
    "Calculate platform commission": "Tính hoa hồng nền tảng",
    "Callback already processed?": "Callback đã được xử lý?",
    "Candidate driver found?": "Tìm thấy tài xế phù hợp?",
    "Capture cash confirmation\nor online checkout result": "Ghi nhận xác nhận tiền mặt\nhoặc kết quả thanh toán online",
    "Choose MoMo or VNPay": "Chọn MoMo hoặc VNPay",
    "Choose register, login, or forgot password": "Chọn đăng ký, đăng nhập hoặc quên mật khẩu",
    "Clear access token, refresh token, user cache": "Xóa access token, refresh token và cache người dùng",
    "Click logout": "Bấm đăng xuất",
    "Client acknowledged or reconnecting?": "Client đã xác nhận hoặc đang kết nối lại?",
    "Close complaint with reason": "Đóng khiếu nại kèm lý do",
    "Close ride and publish ride.completed": "Đóng chuyến và phát sự kiện ride.completed",
    "Code format valid?": "Định dạng mã hợp lệ?",
    "Complete ride": "Hoàn tất chuyến đi",
    "Complete trip": "Hoàn thành hành trình",
    "Completion data valid?\nGPS, fare, duration": "Dữ liệu hoàn tất hợp lệ?\nGPS, cước, thời lượng",
    "Compose chat message or call request": "Soạn tin nhắn chat hoặc yêu cầu gọi",
    "Confirm logout?": "Xác nhận đăng xuất?",
    "Continue to booking?": "Tiếp tục đặt xe?",
    "Correct amount or bank format": "Sửa số tiền hoặc định dạng ngân hàng",
    "Correct amount or provider": "Sửa số tiền hoặc nhà cung cấp",
    "Correct invalid GPS or reconnect": "Sửa GPS không hợp lệ hoặc kết nối lại",
    "Correct invalid status transition": "Sửa chuyển trạng thái không hợp lệ",
    "Correct missing address or invalid coordinates": "Sửa địa chỉ thiếu hoặc tọa độ sai",
    "Create DebtRecord for platform commission": "Tạo DebtRecord cho hoa hồng nền tảng",
    "Create booking request": "Tạo yêu cầu đặt xe",
    "Create driver account": "Tạo tài khoản tài xế",
    "Create password reset OTP": "Tạo OTP đặt lại mật khẩu",
    "Create payment order and checkout URL": "Tạo đơn thanh toán và URL checkout",
    "Create ride assignment atomically": "Tạo gán chuyến theo cơ chế nguyên tử",
    "Create top-up payment order": "Tạo đơn thanh toán nạp ví",
    "Create user/session and issue JWT": "Tạo người dùng/phiên và cấp JWT",
    "Create withdrawal approval task": "Tạo tác vụ duyệt rút tiền",
    "Credentials, MFA, role valid?": "Thông tin đăng nhập, MFA, vai trò hợp lệ?",
    "Credit wallet ledger": "Ghi có vào sổ cái ví",
    "Customer chooses cash payment": "Khách hàng chọn thanh toán tiền mặt",
    "Debit available balance and write ledger": "Ghi nợ số dư khả dụng và ghi sổ cái",
    "Delivery acknowledged?": "Đã xác nhận gửi thành công?",
    "Dispatch ranked nearby drivers": "Điều phối tài xế gần nhất theo xếp hạng",
    "Driver approved, online, location fresh?": "Tài xế đã duyệt, online, vị trí mới?",
    "Driver approved, vehicle active, wallet OK?": "Tài xế đã duyệt, xe hoạt động, ví hợp lệ?",
    "Driver assigned": "Đã gán tài xế",
    "Driver assigned before timeout?": "Gán tài xế trước khi hết hạn?",
    "Driver authenticated and wallet active?": "Tài xế đã xác thực và ví hoạt động?",
    "Driver completes ride and collects cash": "Tài xế hoàn tất chuyến và thu tiền mặt",
    "Driver rejects, offline, or timeout": "Tài xế từ chối, offline hoặc hết hạn",
    "Driver verified and wallet active?": "Tài xế đã xác minh và ví hoạt động?",
    "Driver views platform fee debt": "Tài xế xem công nợ phí nền tảng",
    "Duplicate open complaint?": "Có khiếu nại đang mở bị trùng?",
    "Edit name, email, phone, avatar, address": "Sửa tên, email, điện thoại, avatar, địa chỉ",
    "Edit route or cancel booking draft": "Sửa tuyến hoặc hủy bản nháp đặt xe",
    "Emit Socket.IO event": "Phát sự kiện Socket.IO",
    "End chat/call session": "Kết thúc phiên chat/gọi",
    "Enough trusted context?": "Đủ ngữ cảnh tin cậy?",
    "Enter OTP code": "Nhập mã OTP",
    "Enter admin credentials": "Nhập thông tin quản trị viên",
    "Enter amount and bank account": "Nhập số tiền và tài khoản ngân hàng",
    "Enter decision, reason, amount, or filter": "Nhập quyết định, lý do, số tiền hoặc bộ lọc",
    "Enter new password and confirmation": "Nhập mật khẩu mới và xác nhận",
    "Enter or select voucher": "Nhập hoặc chọn voucher",
    "Enter phone number and password fields": "Nhập số điện thoại và mật khẩu",
    "Enter pickup, destination, vehicle type": "Nhập điểm đón, điểm đến, loại xe",
    "Enter registered phone number": "Nhập số điện thoại đã đăng ký",
    "Enter top-up amount and provider": "Nhập số tiền nạp và nhà cung cấp",
    "Escalate to support/admin workflow": "Chuyển sang luồng hỗ trợ/quản trị",
    "Execute selected action and audit": "Thực thi hành động và ghi audit",
    "Expand radius or relax ranking window": "Mở rộng bán kính hoặc nới điều kiện xếp hạng",
    "Expand radius or retry next driver": "Mở rộng bán kính hoặc thử tài xế kế tiếp",
    "Fail safely, keep audit trail,\nallow retry when possible": "Xử lý thất bại an toàn, giữ audit\nvà cho phép thử lại khi có thể",
    "Fields valid?\nemail, phone, file type, size": "Trường dữ liệu hợp lệ?\nemail, điện thoại, loại file, dung lượng",
    "Files valid?\ntype, size, required fields": "Tệp hợp lệ?\nloại, dung lượng, trường bắt buộc",
    "Filter approved, vehicle match, not busy": "Lọc tài xế đã duyệt, đúng xe, chưa bận",
    "Find online nearby drivers": "Tìm tài xế online gần đó",
    "Fix GPS permission or invalid location": "Sửa quyền GPS hoặc vị trí không hợp lệ",
    "Fix category, note length, or attachment": "Sửa danh mục, độ dài ghi chú hoặc tệp đính kèm",
    "Fix empty text, length, or attachment format": "Sửa nội dung trống, độ dài hoặc định dạng tệp",
    "Fix phone, OTP, or password validation": "Sửa lỗi điện thoại, OTP hoặc mật khẩu",
    "Fix rejected or invalid documents": "Sửa giấy tờ bị từ chối hoặc không hợp lệ",
    "GPS format, speed, timestamp valid?": "Định dạng GPS, tốc độ, thời gian hợp lệ?",
    "Generate OTP, hash it, store TTL": "Tạo OTP, băm và lưu TTL",
    "Generate grounded answer with guardrails": "Tạo câu trả lời có căn cứ và kiểm soát an toàn",
    "Go to cancellation/refund flow": "Chuyển sang luồng hủy/hoàn tiền",
    "Grant location permission": "Cấp quyền vị trí",
    "Handle cancellation or no-show policy": "Xử lý hủy chuyến hoặc chính sách no-show",
    "Hash new password and revoke old sessions": "Băm mật khẩu mới và thu hồi phiên cũ",
    "Hold driver earning for T+24h": "Giữ thu nhập tài xế trong T+24h",
    "Hold not settled, not disputed,\ndriver wallet active?": "Khoản giữ chưa tất toán, không tranh chấp,\nví tài xế hoạt động?",
    "Identity or vehicle duplicated?": "Trùng định danh hoặc phương tiện?",
    "Input valid and complete?": "Dữ liệu nhập hợp lệ và đầy đủ?",
    "Input valid?\nrequired fields, coordinate format": "Dữ liệu nhập hợp lệ?\ntrường bắt buộc, định dạng tọa độ",
    "Inside service area and route found?": "Trong vùng phục vụ và tìm thấy tuyến?",
    "JWT valid and owner/admin allowed?": "JWT hợp lệ và đúng chủ sở hữu/quản trị?",
    "Join ride socket room": "Tham gia phòng socket của chuyến đi",
    "Keep debt open and restrict by policy if needed": "Giữ công nợ mở và hạn chế theo chính sách nếu cần",
    "Keep latest state for reconnect": "Giữ trạng thái mới nhất để kết nối lại",
    "Latitude/longitude valid and fresh?": "Vĩ độ/kinh độ hợp lệ và mới?",
    "Leave Socket.IO rooms and disconnect realtime session": "Rời phòng Socket.IO và ngắt phiên realtime",
    "Link ride, payment, chat, and review evidence": "Liên kết bằng chứng chuyến, thanh toán, chat, đánh giá",
    "Load matured held earnings": "Tải các khoản thu nhập giữ đã đến hạn",
    "Log conversation and feedback": "Ghi log hội thoại và phản hồi",
    "Login with new password": "Đăng nhập bằng mật khẩu mới",
    "Mark arrived": "Đánh dấu đã đến",
    "Mark booking no-driver and notify customer": "Đánh dấu không có tài xế và thông báo khách hàng",
    "Mark failed/cancelled and keep audit": "Đánh dấu thất bại/đã hủy và giữ audit",
    "Mark location stale or driver unavailable": "Đánh dấu vị trí cũ hoặc tài xế không khả dụng",
    "Mark payment completed": "Đánh dấu thanh toán hoàn tất",
    "Mark top-up failed and keep audit": "Đánh dấu nạp ví thất bại và giữ audit",
    "Method supported and ride payable?": "Phương thức được hỗ trợ và chuyến có thể thanh toán?",
    "Monitor ride, user, voucher, system health": "Giám sát chuyến đi, người dùng, voucher, sức khỏe hệ thống",
    "Move held balance to available balance": "Chuyển số dư giữ sang số dư khả dụng",
    "Navigate to pickup": "Di chuyển tới điểm đón",
    "Next state allowed?": "Trạng thái tiếp theo được phép?",
    "No duplicate pending request and T+24h passed?": "Không có yêu cầu trùng đang chờ và đã qua T+24h?",
    "Normalize address and coordinates": "Chuẩn hóa địa chỉ và tọa độ",
    "Notify affected user or ops channel": "Thông báo người dùng liên quan hoặc kênh vận hành",
    "Notify counterpart and operations": "Thông báo bên còn lại và đội vận hành",
    "Notify customer and driver apps": "Thông báo ứng dụng khách hàng và tài xế",
    "Notify driver": "Thông báo tài xế",
    "Notify driver of review result": "Thông báo kết quả duyệt cho tài xế",
    "Notify driver that earning is available": "Thông báo tài xế có thu nhập khả dụng",
    "Notify no driver available\nand release booking": "Thông báo không có tài xế\nvà giải phóng booking",
    "Notify user about profile update": "Thông báo người dùng về cập nhật hồ sơ",
    "OTP correct, fresh, attempts within limit?": "OTP đúng, còn hạn, số lần thử trong giới hạn?",
    "OTP valid and not expired?": "OTP hợp lệ và chưa hết hạn?",
    "Offer accepted before timeout?": "Đề nghị được nhận trước khi hết hạn?",
    "Offer still active?": "Đề nghị còn hiệu lực?",
    "Open forgot password screen": "Mở màn hình quên mật khẩu",
    "Open operations dashboard": "Mở dashboard vận hành",
    "Open profile screen": "Mở màn hình hồ sơ",
    "Open provider checkout": "Mở trang thanh toán nhà cung cấp",
    "Participant and ride room valid?": "Người tham gia và phòng chuyến hợp lệ?",
    "Password policy satisfied?": "Đạt chính sách mật khẩu?",
    "Pay and submit rating/review": "Thanh toán và gửi đánh giá",
    "Pay at MoMo/VNPay": "Thanh toán tại MoMo/VNPay",
    "Payload valid and safe?": "Payload hợp lệ và an toàn?",
    "Payment captured or wallet hold exists?": "Đã ghi nhận thanh toán hoặc có khoản giữ ví?",
    "Payment method supported?": "Phương thức thanh toán được hỗ trợ?",
    "Persist profile and audit change": "Lưu hồ sơ và ghi audit thay đổi",
    "Phone/email/identity conflict?": "Trùng điện thoại/email/định danh?",
    "Phone/password format valid?": "Định dạng điện thoại/mật khẩu hợp lệ?",
    "Pickup confirmed and ride not cancelled?": "Đã xác nhận đón và chuyến chưa bị hủy?",
    "Ping valid and ride not conflicting?": "Ping hợp lệ và không xung đột chuyến?",
    "Process each matured hold": "Xử lý từng khoản giữ đến hạn",
    "Publish payment.completed event": "Phát sự kiện payment.completed",
    "Publish payment.finalized and debt.updated": "Phát sự kiện payment.finalized và debt.updated",
    "Publish wallet.settled event": "Phát sự kiện wallet.settled",
    "Put application in review queue": "Đưa hồ sơ vào hàng đợi duyệt",
    "Question length and content valid?": "Độ dài và nội dung câu hỏi hợp lệ?",
    "Rank by distance, rating, idle time": "Xếp hạng theo khoảng cách, đánh giá, thời gian rảnh",
    "Rating 1-5 and comment length valid?": "Điểm 1-5 và độ dài bình luận hợp lệ?",
    "Read answer and suggested action": "Đọc câu trả lời và hành động gợi ý",
    "Reason format valid?": "Định dạng lý do hợp lệ?",
    "Receive provider callback": "Nhận callback từ nhà cung cấp",
    "Receive realtime message or push notification": "Nhận tin nhắn realtime hoặc thông báo đẩy",
    "Receive return URL or IPN callback": "Nhận return URL hoặc IPN callback",
    "Receive ride request": "Nhận yêu cầu chuyến",
    "Receive support resolution": "Nhận kết quả hỗ trợ",
    "Recipient online in socket room?": "Người nhận đang online trong phòng socket?",
    "Record delivery status": "Ghi nhận trạng thái gửi",
    "Record driver earning as cash collected": "Ghi nhận thu nhập tài xế từ tiền mặt đã thu",
    "Refresh token exists?": "Có refresh token?",
    "Refund, warning, lock, or no action?": "Hoàn tiền, cảnh báo, khóa, hay không xử lý?",
    "Register deferred cash payment": "Ghi nhận thanh toán tiền mặt trả sau",
    "Reject because hold, balance,\nor bank data is invalid": "Từ chối vì khoản giữ, số dư\nhoặc dữ liệu ngân hàng không hợp lệ",
    "Reject because ride already started/completed": "Từ chối vì chuyến đã bắt đầu/hoàn tất",
    "Reject duplicate or early review": "Từ chối đánh giá trùng hoặc quá sớm",
    "Reject inactive wallet or unauthorized user": "Từ chối ví không hoạt động hoặc người dùng không có quyền",
    "Reject insufficient balance, hold, or duplicate": "Từ chối do thiếu số dư, khoản giữ hoặc trùng lặp",
    "Reject locked, inactive, or wrong role account": "Từ chối tài khoản bị khóa, ngưng hoạt động hoặc sai vai trò",
    "Reject online request and show reason": "Từ chối yêu cầu online và hiển thị lý do",
    "Reject or let timer expire": "Từ chối hoặc để hết thời gian",
    "Reject stale offer": "Từ chối đề nghị hết hiệu lực",
    "Reject stale or cancelled booking": "Từ chối booking cũ hoặc đã hủy",
    "Reject unauthenticated or forbidden request": "Từ chối yêu cầu chưa xác thực hoặc bị cấm",
    "Reject unauthorized cancellation": "Từ chối hủy chuyến không có quyền",
    "Reject unauthorized complaint": "Từ chối khiếu nại không có quyền",
    "Reject unauthorized or inactive wallet": "Từ chối ví không có quyền hoặc không hoạt động",
    "Reject unauthorized or rate-limited request": "Từ chối yêu cầu không có quyền hoặc vượt giới hạn",
    "Reject unauthorized room access": "Từ chối truy cập phòng không có quyền",
    "Reject unauthorized socket event": "Từ chối sự kiện socket không có quyền",
    "Reject unsupported method or paid ride": "Từ chối phương thức không hỗ trợ hoặc chuyến đã thanh toán",
    "Reject with reason": "Từ chối kèm lý do",
    "Reject with reason and required fixes": "Từ chối kèm lý do và yêu cầu sửa",
    "Release earning or process withdrawal": "Giải phóng thu nhập hoặc xử lý rút tiền",
    "Remove from candidate pool": "Loại khỏi nhóm ứng viên",
    "Request new OTP or correct code": "Yêu cầu OTP mới hoặc sửa mã",
    "Request ride cancellation": "Yêu cầu hủy chuyến",
    "Requester belongs to ride or account?": "Người gửi thuộc chuyến hoặc tài khoản?",
    "Requester belongs to ride?": "Người yêu cầu thuộc chuyến?",
    "Required fields and evidence format valid?": "Trường bắt buộc và định dạng bằng chứng hợp lệ?",
    "Retrieve relevant policy, ride, payment docs": "Truy xuất chính sách, chuyến, tài liệu thanh toán liên quan",
    "Retry later and alert ops": "Thử lại sau và cảnh báo vận hành",
    "Retry or keep task pending": "Thử lại hoặc giữ tác vụ đang chờ",
    "Retry payment or choose another method": "Thử thanh toán lại hoặc chọn phương thức khác",
    "Return safe fallback and escalation option": "Trả fallback an toàn và tùy chọn chuyển hỗ trợ",
    "Return to login screen": "Quay về màn hình đăng nhập",
    "Review documents and license class": "Duyệt giấy tờ và hạng bằng lái",
    "Review pickup, dropoff, fare, timeout": "Xem điểm đón, điểm đến, giá và thời hạn",
    "Revoke refresh token in auth_db": "Thu hồi refresh token trong auth_db",
    "Ride active": "Chuyến đang hoạt động",
    "Ride assigned": "Chuyến đã được gán",
    "Ride completed": "Chuyến đi hoàn tất",
    "Ride completed and not reviewed?": "Chuyến đã hoàn tất và chưa đánh giá?",
    "Ride completed?": "Chuyến đi đã hoàn tất?",
    "Ride state allows cancellation?": "Trạng thái chuyến cho phép hủy?",
    "Ride still active?": "Chuyến vẫn đang hoạt động?",
    "Route input valid?": "Thông tin tuyến hợp lệ?",
    "Route serviceable?": "Tuyến nằm trong vùng phục vụ?",
    "SMS provider accepted request?": "Nhà cung cấp SMS chấp nhận yêu cầu?",
    "Select reason and optional note": "Chọn lý do và ghi chú tùy chọn",
    "Select task": "Chọn tác vụ",
    "Send GPS update": "Gửi cập nhật GPS",
    "Send OTP through SMS/mock provider": "Gửi OTP qua SMS/mock provider",
    "Send feedback or request human help": "Gửi phản hồi hoặc yêu cầu hỗ trợ người thật",
    "Send offer to next ranked driver": "Gửi đề nghị cho tài xế kế tiếp",
    "Send periodic GPS ping": "Gửi ping GPS định kỳ",
    "Send push/SMS/email fallback": "Gửi fallback push/SMS/email",
    "Sender belongs to active ride?": "Người gửi thuộc chuyến đang hoạt động?",
    "Sensitive phone change?": "Thay đổi số điện thoại nhạy cảm?",
    "Set driver ONLINE and store GEO location": "Đặt tài xế ONLINE và lưu vị trí GEO",
    "Settle oldest debt by FIFO": "Tất toán công nợ cũ nhất theo FIFO",
    "Settlement or withdrawal allowed?": "Cho phép tất toán hoặc rút tiền?",
    "Shorten, clarify, or remove invalid input": "Rút gọn, làm rõ hoặc bỏ nội dung không hợp lệ",
    "Show duplicate or stale version error": "Hiển thị lỗi trùng hoặc phiên bản cũ",
    "Show eligibility reason": "Hiển thị lý do đủ/không đủ điều kiện",
    "Show field-level validation errors": "Hiển thị lỗi kiểm tra theo từng trường",
    "Show format error\nand request correction": "Hiển thị lỗi định dạng\nvà yêu cầu sửa",
    "Show generic recovery message": "Hiển thị thông báo khôi phục chung",
    "Show invalid code format": "Hiển thị mã sai định dạng",
    "Show login or permission error": "Hiển thị lỗi đăng nhập hoặc phân quyền",
    "Show missing or invalid reason": "Hiển thị lý do thiếu hoặc không hợp lệ",
    "Show required field or format error": "Hiển thị lỗi thiếu trường hoặc sai định dạng",
    "Show review validation error": "Hiển thị lỗi kiểm tra đánh giá",
    "Show unavailable route or area message": "Hiển thị thông báo tuyến/khu vực chưa hỗ trợ",
    "Show unsupported method error": "Hiển thị lỗi phương thức không hỗ trợ",
    "Show validation error\nand let customer edit": "Hiển thị lỗi kiểm tra\nvà cho khách hàng sửa",
    "Sign in or register with OTP": "Đăng nhập hoặc đăng ký bằng OTP",
    "Signature, amount, status valid?": "Chữ ký, số tiền, trạng thái hợp lệ?",
    "Signature, status, idempotency valid?": "Chữ ký, trạng thái, idempotency hợp lệ?",
    "Signed in?": "Đã đăng nhập?",
    "Skip disputed, inactive, or duplicate hold": "Bỏ qua khoản tranh chấp, không hoạt động hoặc trùng",
    "Start trip after customer pickup": "Bắt đầu chuyến sau khi đón khách",
    "Stay in current session": "Ở lại phiên hiện tại",
    "Stop tracking when ride closes": "Dừng theo dõi khi chuyến đóng",
    "Store latest location in Redis and ride trail": "Lưu vị trí mới nhất vào Redis và lịch sử chuyến",
    "Store message/call metadata": "Lưu metadata tin nhắn/cuộc gọi",
    "Store review and update rating aggregate": "Lưu đánh giá và cập nhật điểm tổng hợp",
    "Submit OTP code": "Gửi mã OTP",
    "Submit complaint, category, evidence": "Gửi khiếu nại, danh mục, bằng chứng",
    "Submit phone OTP": "Gửi OTP điện thoại",
    "Submit rating and optional comment": "Gửi điểm đánh giá và bình luận tùy chọn",
    "T+24h schedule": "Lịch T+24h",
    "Target service accepted update?": "Dịch vụ đích chấp nhận cập nhật?",
    "Toggle online or offline": "Chuyển online hoặc offline",
    "Top up wallet or wait for FIFO settlement": "Nạp ví hoặc chờ tất toán FIFO",
    "Track assigned driver and ride state": "Theo dõi tài xế đã gán và trạng thái chuyến",
    "Track complaint status": "Theo dõi trạng thái khiếu nại",
    "Track route, GPS, and elapsed time": "Theo dõi tuyến, GPS và thời gian",
    "Turn offline or end session": "Chuyển offline hoặc kết thúc phiên",
    "Update Redis GEO and driver status": "Cập nhật Redis GEO và trạng thái tài xế",
    "Update ride status to CANCELLED": "Cập nhật trạng thái chuyến thành CANCELLED",
    "Upload identity, license, vehicle, avatar": "Tải lên CCCD, bằng lái, xe, avatar",
    "Use rule-based ETA and surge fallback": "Dùng fallback ETA và surge theo luật",
    "User context and rate limit valid?": "Ngữ cảnh người dùng và giới hạn tần suất hợp lệ?",
    "Verify changed phone by OTP": "Xác minh số điện thoại mới bằng OTP",
    "View cancellation, fee, refund result": "Xem kết quả hủy, phí, hoàn tiền",
    "View fare, ETA, distance, discount": "Xem giá cước, ETA, quãng đường, giảm giá",
    "View fare, ETA, route, voucher result": "Xem giá cước, ETA, tuyến và voucher",
    "View payment result": "Xem kết quả thanh toán",
    "View updated profile": "Xem hồ sơ đã cập nhật",
    "View updated wallet balance": "Xem số dư ví đã cập nhật",
    "View withdrawal result": "Xem kết quả rút tiền",
    "Void payment, refund, or release hold": "Hủy thanh toán, hoàn tiền hoặc giải phóng khoản giữ",
    "Voucher active, unused,\nnot expired, min fare met?": "Voucher hoạt động, chưa dùng,\nchưa hết hạn, đạt giá tối thiểu?",
    "Wait for admin approval": "Chờ quản trị viên duyệt",
    "Wallet has available balance?": "Ví có số dư khả dụng?",
    "Write audit log with admin id": "Ghi audit log với mã quản trị viên",
    "Write immutable payment ledger": "Ghi sổ cái thanh toán bất biến",
    "Write logout audit event": "Ghi sự kiện audit đăng xuất",
    "Write password reset audit log": "Ghi audit log đặt lại mật khẩu",
    "Write settlement ledger entry": "Ghi bút toán tất toán",
    "Finance review": "Duyệt tài chính",
    "Live operations": "Vận hành trực tiếp",
    "No": "Không",
    "Yes": "Có",
    "max attempts reached": "Đạt số lần thử tối đa",
    "max radius": "Đạt bán kính tối đa",
    "no more holds": "Không còn khoản giữ",
}


VI_CAPTIONS = {
    "02_customer_booking_activity": "Hoạt động đặt xe của khách hàng",
    "03_driver_onboarding_activity": "Hoạt động đăng ký tài xế",
    "04_payment_wallet_activity": "Hoạt động thanh toán và ví",
    "05_admin_operations_activity": "Hoạt động vận hành của quản trị viên",
    "06_voucher_review_activity": "Hoạt động voucher và đánh giá",
    "07_auth_otp_activity": "Hoạt động xác thực OTP",
    "08_profile_management_activity": "Hoạt động quản lý hồ sơ",
    "09_fare_estimation_activity": "Hoạt động ước tính giá cước",
    "10_driver_matching_activity": "Hoạt động ghép tài xế",
    "11_driver_acceptance_activity": "Hoạt động tài xế nhận chuyến",
    "12_driver_availability_activity": "Hoạt động trạng thái sẵn sàng của tài xế",
    "13_ride_lifecycle_activity": "Hoạt động vòng đời chuyến đi",
    "14_realtime_tracking_activity": "Hoạt động theo dõi thời gian thực",
    "15_cancellation_refund_activity": "Hoạt động hủy chuyến và hoàn tiền",
    "16_online_payment_activity": "Hoạt động thanh toán trực tuyến",
    "17_driver_wallet_topup_activity": "Hoạt động nạp ví tài xế",
    "18_driver_withdrawal_activity": "Hoạt động rút tiền của tài xế",
    "19_complaint_handling_activity": "Hoạt động xử lý khiếu nại",
    "20_chat_notification_activity": "Hoạt động chat và thông báo",
    "21_ai_support_activity": "Hoạt động hỗ trợ AI",
    "22_settlement_t24h_activity": "Hoạt động đối soát T+24h",
    "23_forgot_password_activity": "Hoạt động quên mật khẩu",
    "24_logout_activity": "Hoạt động đăng xuất",
    "25_cash_payment_debt_activity": "Hoạt động thanh toán tiền mặt và công nợ",
}


def vi(text: str) -> str:
    return VI_LABELS.get(text, text)


def clean_label(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
        value = value[1:-1]
    return value.replace("<br/>", "\n").replace("<br>", "\n").strip()


def parse_node(line: str, lane: int, order: int) -> Node | None:
    match = NODE_RE.match(line)
    if not match:
        return None

    node_id = match.group("id")
    body = match.group("body")
    style = match.group("style")

    if body.startswith("([") and body.endswith("])"):
        label = vi(clean_label(body[2:-2]))
        if node_id.lower() in {"done", "end"} or label.lower() == "end":
            kind = "end"
        else:
            kind = "start"
    elif body.startswith("{") and body.endswith("}"):
        label = vi(clean_label(body[1:-1]))
        kind = "decision"
    elif body.startswith("[") and body.endswith("]"):
        label = vi(clean_label(body[1:-1]))
        kind = "action"
    else:
        return None

    return Node(node_id, label, lane, kind, style, order)


def parse_edge_line(line: str) -> list[Edge]:
    text = line.strip()
    if not text or text.startswith("classDef") or "--" not in text and "-." not in text:
        return []

    source_match = ID_RE.match(text)
    if not source_match:
        return []

    edges: list[Edge] = []
    source = source_match.group("id")
    pos = source_match.end()

    while pos < len(text):
        arrow_match = ARROW_RE.match(text, pos)
        if not arrow_match:
            break

        label = arrow_match.group("label") or arrow_match.group("dlabel")
        dashed = arrow_match.group("dlabel") is not None
        pos = arrow_match.end()

        target_match = ID_RE.match(text, pos)
        if not target_match:
            break

        target = target_match.group("id")
        edges.append(Edge(source, target, vi(label.strip()) if label else None, dashed))
        source = target
        pos = target_match.end()

    return edges


def parse_diagram(path: Path) -> Diagram:
    lanes: list[str] = []
    nodes: dict[str, Node] = {}
    edges: list[Edge] = []
    current_lane: int | None = None
    order = 0

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        subgraph = SUBGRAPH_RE.match(line)
        if subgraph:
            current_lane = len(lanes)
            lanes.append(vi(clean_label(subgraph.group("label"))))
            continue

        if current_lane is not None and line.strip() == "end":
            current_lane = None
            continue

        if current_lane is not None:
            node = parse_node(line, current_lane, order)
            if node:
                nodes[node.id] = node
                order += 1
            continue

        edges.extend(parse_edge_line(line))

    if len(lanes) != 2:
        raise ValueError(f"{path.name}: expected exactly 2 swimlanes, found {len(lanes)}")

    return Diagram(path, lanes, nodes, [edge for edge in edges if edge.source in nodes and edge.target in nodes])


def caption_from_path(path: Path) -> str:
    if path.stem in VI_CAPTIONS:
        return VI_CAPTIONS[path.stem]

    parts = path.stem.split("_")
    if parts and parts[0].isdigit():
        parts = parts[1:]
    acronyms = {
        "ai": "AI",
        "api": "API",
        "gps": "GPS",
        "ipn": "IPN",
        "jwt": "JWT",
        "otp": "OTP",
        "t24h": "T+24h",
        "topup": "Top-Up",
    }
    return " ".join(acronyms.get(part.lower(), part.capitalize()) for part in parts)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            result.append("")
            continue

        line = words[0]
        for word in words[1:]:
            trial = f"{line} {word}"
            if draw.textlength(trial, font=fnt) <= max_width:
                line = trial
            else:
                result.append(line)
                line = word
        result.append(line)
    return result


def text_block_size(draw: ImageDraw.ImageDraw, lines: list[str], fnt: ImageFont.ImageFont) -> tuple[int, int, int]:
    line_h = draw.textbbox((0, 0), "Ag", font=fnt)[3] - draw.textbbox((0, 0), "Ag", font=fnt)[1] + 12
    widths = [math.ceil(draw.textlength(line, font=fnt)) for line in lines] or [0]
    return max(widths), max(1, len(lines)) * line_h - 12, line_h


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


def lane_boxes() -> list[tuple[int, int, int, int]]:
    lane_w = (CANVAS_W - MARGIN_X * 2 - LANE_GAP) // 2
    left = (MARGIN_X, TOP, MARGIN_X + lane_w, TOP)
    right_x = MARGIN_X + lane_w + LANE_GAP
    right = (right_x, TOP, right_x + lane_w, TOP)
    return [left, right]


def rank_nodes(diagram: Diagram) -> dict[str, int]:
    rank = {node_id: 0 for node_id, node in diagram.nodes.items() if node.kind == "start"}
    first_seen: dict[str, int] = {}

    for edge in diagram.edges:
        for node_id in (edge.source, edge.target):
            node = diagram.nodes[node_id]
            if node.kind != "end" and node_id not in first_seen:
                first_seen[node_id] = len(first_seen)

    for node_id, node in sorted(diagram.nodes.items(), key=lambda item: item[1].order):
        if node.kind != "end" and node_id not in first_seen:
            first_seen[node_id] = len(first_seen)

    for _ in range(len(diagram.nodes) * 3):
        changed = False
        for edge in diagram.edges:
            source = diagram.nodes[edge.source]
            target = diagram.nodes[edge.target]
            if target.kind == "end":
                continue
            if first_seen.get(edge.target, 0) <= first_seen.get(edge.source, 0):
                continue
            next_rank = rank.get(source.id, 0) + 1
            if next_rank > rank.get(target.id, -1):
                rank[target.id] = next_rank
                changed = True
        if not changed:
            break

    for node_id, node in diagram.nodes.items():
        rank.setdefault(node_id, max(0, node.order))

    for node_id, node in diagram.nodes.items():
        if node.kind != "end":
            continue
        incoming = [edge.source for edge in diagram.edges if edge.target == node_id]
        rank[node_id] = max([rank.get(source, 0) + 1 for source in incoming] or [max(rank.values(), default=0) + 1])

    return rank


def measure_nodes(
    draw: ImageDraw.ImageDraw,
    diagram: Diagram,
    lane_rects: list[tuple[int, int, int, int]],
) -> dict[str, tuple[int, int]]:
    sizes: dict[str, tuple[int, int]] = {}
    lane_w = lane_rects[0][2] - lane_rects[0][0]
    action_w = min(820, lane_w - 220)
    decision_w = min(750, lane_w - 250)

    for node in diagram.nodes.values():
        if node.kind in {"start", "end"}:
            label_lines = [] if node.label.lower() in {"start", "end"} else wrap_text(draw, node.label, FONT_SMALL, 360)
            _, label_h, _ = text_block_size(draw, label_lines, FONT_SMALL) if label_lines else (0, 0, 0)
            sizes[node.id] = (max(80, 420 if label_lines else 80), 70 + (label_h + 12 if label_lines else 0))
            continue

        if node.kind == "decision":
            lines = wrap_text(draw, node.label, FONT_NODE, decision_w - 180)
            _, text_h, _ = text_block_size(draw, lines, FONT_NODE)
            sizes[node.id] = (decision_w, max(150, text_h + 78))
            continue

        lines = wrap_text(draw, node.label, FONT_NODE, action_w - 62)
        _, text_h, _ = text_block_size(draw, lines, FONT_NODE)
        sizes[node.id] = (action_w, max(118, text_h + 48))

    return sizes


def place_nodes(
    diagram: Diagram,
    ranks: dict[str, int],
    sizes: dict[str, tuple[int, int]],
    lane_rects: list[tuple[int, int, int, int]],
) -> tuple[dict[str, tuple[int, int, int, int]], int]:
    boxes: dict[str, tuple[int, int, int, int]] = {}
    rank_y = {rank: TOP + HEADER_H + 105 + rank * RANK_GAP for rank in set(ranks.values())}

    for lane_index, lane in enumerate(lane_rects):
        last_bottom = TOP + HEADER_H + 45
        lane_nodes = [
            node
            for node in sorted(diagram.nodes.values(), key=lambda item: (ranks[item.id], item.order))
            if node.lane == lane_index
        ]
        cx = (lane[0] + lane[2]) // 2
        for node in lane_nodes:
            width, height = sizes[node.id]
            desired_y = rank_y[ranks[node.id]]
            top = int(desired_y - height / 2)
            if top < last_bottom + MIN_NODE_GAP:
                top = last_bottom + MIN_NODE_GAP
            left = int(cx - width / 2)
            boxes[node.id] = (left, top, left + width, top + height)
            last_bottom = top + height

    content_bottom = max(box[3] for box in boxes.values()) if boxes else TOP + HEADER_H
    canvas_h = content_bottom + BOTTOM_PAD + CAPTION_H
    return boxes, canvas_h


def node_anchor(box: tuple[int, int, int, int], side: str) -> tuple[int, int]:
    x1, y1, x2, y2 = box
    if side == "top":
        return ((x1 + x2) // 2, y1)
    if side == "bottom":
        return ((x1 + x2) // 2, y2)
    if side == "left":
        return (x1, (y1 + y2) // 2)
    if side == "right":
        return (x2, (y1 + y2) // 2)
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def vertical_segment_hits_node(
    x: int,
    y1: int,
    y2: int,
    boxes: dict[str, tuple[int, int, int, int]],
    exclude: set[str],
) -> bool:
    top = min(y1, y2)
    bottom = max(y1, y2)
    for node_id, box in boxes.items():
        if node_id in exclude:
            continue
        if box[0] - 12 <= x <= box[2] + 12 and max(top, box[1]) < min(bottom, box[3]):
            return True
    return False


def draw_polyline(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    color: str = BLUE,
    width: int = 5,
    dashed: bool = False,
) -> None:
    if len(points) < 2:
        return

    if dashed:
        for start, end in zip(points, points[1:]):
            x1, y1 = start
            x2, y2 = end
            length = math.hypot(x2 - x1, y2 - y1)
            if length == 0:
                continue
            ux = (x2 - x1) / length
            uy = (y2 - y1) / length
            pos = 0.0
            while pos < length:
                segment = min(pos + 20, length)
                draw.line(
                    (
                        x1 + ux * pos,
                        y1 + uy * pos,
                        x1 + ux * segment,
                        y1 + uy * segment,
                    ),
                    fill=color,
                    width=width,
                )
                pos += 32
    else:
        draw.line(points, fill=color, width=width, joint="curve")

    x1, y1 = points[-2]
    x2, y2 = points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    length = 27
    spread = 0.52
    p1 = (x2 - length * math.cos(angle - spread), y2 - length * math.sin(angle - spread))
    p2 = (x2 - length * math.cos(angle + spread), y2 - length * math.sin(angle + spread))
    draw.polygon([(x2, y2), p1, p2], fill=color)


def edge_route(
    edge: Edge,
    diagram: Diagram,
    boxes: dict[str, tuple[int, int, int, int]],
    lane_rects: list[tuple[int, int, int, int]],
) -> tuple[list[tuple[int, int]], tuple[int, int]]:
    source = diagram.nodes[edge.source]
    target = diagram.nodes[edge.target]
    src_box = boxes[edge.source]
    dst_box = boxes[edge.target]

    if source.lane == target.lane:
        if dst_box[1] >= src_box[3]:
            start = node_anchor(src_box, "bottom")
            end = node_anchor(dst_box, "top")
            if vertical_segment_hits_node(start[0], start[1], end[1], boxes, {edge.source, edge.target}):
                lane = lane_rects[source.lane]
                side = "left" if source.lane == 0 else "right"
                side_x = lane[0] + 34 if source.lane == 0 else lane[2] - 34
                start = node_anchor(src_box, side)
                end = node_anchor(dst_box, side)
                points = [start, (side_x, start[1]), (side_x, end[1]), end]
                label_at = (side_x + 14 if source.lane == 0 else side_x - 95, (start[1] + end[1]) // 2 - 20)
                return points, label_at
            points = [start, end]
            label_at = (points[0][0] + 18, (points[0][1] + points[1][1]) // 2 - 20)
            return points, label_at

        lane = lane_rects[source.lane]
        side = "left" if source.lane == 0 else "right"
        side_x = lane[0] + 34 if source.lane == 0 else lane[2] - 34
        start = node_anchor(src_box, side)
        end = node_anchor(dst_box, side)
        points = [start, (side_x, start[1]), (side_x, end[1]), end]
        label_at = (side_x + 14 if source.lane == 0 else side_x - 95, min(start[1], end[1]) + 28)
        return points, label_at

    if source.lane < target.lane:
        start = node_anchor(src_box, "right")
        end = node_anchor(dst_box, "left")
    else:
        start = node_anchor(src_box, "left")
        end = node_anchor(dst_box, "right")

    divider_x = lane_rects[0][2]
    mid_x = divider_x
    points = [start, (mid_x, start[1]), (mid_x, end[1]), end]
    label_y = (start[1] + end[1]) // 2 - 24
    if source.lane == 0:
        label_at = (mid_x - 315, label_y)
    else:
        label_at = (mid_x + 55, label_y)
    return points, label_at


def draw_edge_label(draw: ImageDraw.ImageDraw, text: str, point: tuple[int, int]) -> None:
    lines = wrap_text(draw, text, FONT_EDGE, 260)
    width, height, line_h = text_block_size(draw, lines, FONT_EDGE)
    x, y = point
    pad_x = 9
    pad_y = 5
    draw.rectangle((x - pad_x, y - pad_y, x + width + pad_x, y + height + pad_y), fill=WHITE)
    cursor_y = y
    for line in lines:
        draw.text((x, cursor_y), line, font=FONT_EDGE, fill=BLUE)
        cursor_y += line_h


def draw_node(
    draw: ImageDraw.ImageDraw,
    node: Node,
    box: tuple[int, int, int, int],
) -> None:
    x1, y1, x2, y2 = box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2

    if node.kind == "start":
        r = 30
        circle = (cx - r, y1, cx + r, y1 + r * 2)
        draw.ellipse(circle, fill=INK, outline=INK, width=4)
        if node.label.lower() != "start":
            lines = wrap_text(draw, node.label, FONT_SMALL, x2 - x1 - 20)
            draw_centered_lines(draw, (x1, y1 + 68, x2, y2), lines, FONT_SMALL)
        return

    if node.kind == "end":
        r = 32
        circle = (cx - r, cy - r, cx + r, cy + r)
        draw.ellipse(circle, fill=WHITE, outline=INK, width=4)
        draw.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=INK, outline=INK, width=4)
        return

    if node.kind == "decision":
        points = [(cx, y1), (x2, cy), (cx, y2), (x1, cy)]
        draw.polygon(points, fill=WHITE, outline=INK)
        draw.line(points + [points[0]], fill=INK, width=4)
        lines = wrap_text(draw, node.label, FONT_NODE, max(120, x2 - x1 - 190))
        draw_centered_lines(draw, box, lines, FONT_NODE)
        return

    draw.rounded_rectangle(box, radius=18, fill=ACTION_FILL, outline=INK, width=4)
    lines = wrap_text(draw, node.label, FONT_NODE, x2 - x1 - 62)
    draw_centered_lines(draw, box, lines, FONT_NODE_BOLD if node.style == "ok" else FONT_NODE)


def draw_caption(draw: ImageDraw.ImageDraw, canvas_h: int, caption: str) -> None:
    line_y = canvas_h - CAPTION_H + 18
    draw.line((260, line_y, CANVAS_W - 260, line_y), fill="#cbd5e1", width=2)
    draw_centered_lines(
        draw,
        (MARGIN_X, line_y + 34, CANVAS_W - MARGIN_X, canvas_h - 26),
        [caption],
        FONT_CAPTION,
    )


def render(diagram: Diagram) -> None:
    measure_img = Image.new("RGB", (10, 10), WHITE)
    measure_draw = ImageDraw.Draw(measure_img)

    lane_tops = lane_boxes()
    ranks = rank_nodes(diagram)
    sizes = measure_nodes(measure_draw, diagram, lane_tops)
    boxes, canvas_h = place_nodes(diagram, ranks, sizes, lane_tops)

    lane_rects = [(x1, TOP, x2, canvas_h - CAPTION_H - 28) for x1, _, x2, _ in lane_tops]
    img = Image.new("RGB", (CANVAS_W, canvas_h), WHITE)
    draw = ImageDraw.Draw(img)

    for idx, lane in enumerate(lane_rects):
        draw.rectangle(lane, fill=WHITE, outline=INK, width=4)
        draw.rectangle((lane[0], lane[1], lane[2], lane[1] + HEADER_H), fill=LANE_HEADER, outline=INK, width=4)
        draw_centered_lines(draw, (lane[0], lane[1], lane[2], lane[1] + HEADER_H), [diagram.lanes[idx]], FONT_HEADER)

    label_positions: list[tuple[str, tuple[int, int]]] = []
    for edge in diagram.edges:
        points, label_at = edge_route(edge, diagram, boxes, lane_rects)
        draw_polyline(draw, points, dashed=edge.dashed)
        if edge.label:
            label_positions.append((edge.label, label_at))

    for node in sorted(diagram.nodes.values(), key=lambda item: item.order):
        draw_node(draw, node, boxes[node.id])

    for label, point in label_positions:
        draw_edge_label(draw, label, point)

    draw_caption(draw, canvas_h, caption_from_path(diagram.path))
    img.save(diagram.path.with_suffix(".png"), "PNG", optimize=True, dpi=(300, 300))


def main() -> None:
    paths = sorted(ACTIVITY_DIR.glob("*_activity.mmd"))
    if not paths:
        raise SystemExit(f"No activity diagrams found in {ACTIVITY_DIR}")

    for path in paths:
        diagram = parse_diagram(path)
        render(diagram)
        print(f"rendered {path.with_suffix('.png').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
