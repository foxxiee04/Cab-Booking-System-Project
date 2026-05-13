/**
 * FoxGo Mia — shared quick patterns + copy for Customer & Driver apps.
 * Backend RAG (/ai/chat) remains the source of truth; these are fallbacks + instant replies.
 */

export interface FoxgoQuickPattern {
  re: RegExp;
  answer: string;
}

export const GREETING_RE =
  /^(hi+|hello+|hey+|xin chào|chào|alo|oi|ừ|ok|okay|bạn ơi|ơi|yo)\s*[!.]*$/i;

export const GREETING_RESPONSES = [
  'Chào bạn 👋 Mình là Mia, trợ lý FoxGo. Bạn cần gì — đặt xe, thanh toán, ví, hay chuyện tài xế? Cứ hỏi trực tiếp nhé!',
  'Hi bạn! Mình Mia đây. Bạn nói ngắn gọn vấn đề, mình hỗ trợ ngay.',
];

export const THANKS_RE =
  /^(cảm ơn+|thanks+|thank you|ok cảm ơn|oke cảm ơn|cảm ơn bạn)\s*[!.]*$/i;

export const THANKS_RESPONSES = [
  'Không có gì bạn ơi! Cần gì cứ gọi Mia.',
  'Rất vui được giúp bạn. Chúc bạn một ngày tốt lành!',
];

/** First match wins — đặt mẫu cụ thể trước mẫu chung. */
export const FOXGO_QUICK_PATTERNS: FoxgoQuickPattern[] = [
  {
    re: /^(bạn\s+là\s+ai|ban\s+la\s+ai|mia\s+là\s+ai|who\s+are\s+you|what\s+are\s+you|you\s+are\s+\?)\s*[?!.]*$/i,
    answer:
      'Mình là Mia, trợ lý chat FoxGo trong app (bot, không phải người thật). Mình bám thông tin chính thức của FoxGo; nếu bạn hỏi chung chung, mình có thể hỏi lại cho rõ nhé.',
  },
  {
    re: /tài xế.*(không đúng|xấu|quấy|sàm sở|rủi ro|lừa đảo|gian lận|cố ý)/i,
    answer:
      'Nếu bạn không an toàn: tìm chỗ dừng đông người, gọi 113 khi cần.\n'
      + 'Nếu chưa nguy hiểm: giữ bình tĩnh, lưu bằng chứng, kết thúc chuyến khi an toàn và báo FoxGo 1900-1234 / support@foxgo.vn kèm mã chuyến — khiếu nại hoặc đánh giá trong app nhé.',
  },
  {
    re: /hoa hồng|commission|phí nền tảng|chiết khấu tài xế|phần trăm.*tài xế/i,
    answer:
      'Tỷ lệ hoa hồng (tài xế):\n• Xe máy & xe ga: 20%\n• Ô tô 4 chỗ: 18%\n• Ô tô 7 chỗ: 15%\n\nVí dụ cuốc 100.000đ xe 4 chỗ → bạn nhận ~82.000đ. Tiền về ví theo quy định hệ thống (thường sau khi hoàn thành chuyến).',
  },
  {
    re: /rating|đánh giá.*tài xế|sao.*tài xế|tăng rating/i,
    answer:
      'Gợi ý cho tài xế: đón đúng giờ, thân thiện, xe sạch; tránh hủy chuyến không lý do vì ảnh hưởng tỉ lệ nhận cuốc. Rating là trung bình gần đây; chi tiết trong app tài xế.',
  },
  {
    re: /ký quỹ|đặt cọc.*tài xế|wallet.*driver|nạp.*ví tài xế/i,
    answer:
      'Ký quỹ / ví tài xế: cần đủ số dư theo ngưỡng để nhận cuốc. Nạp/rút trong mục Ví trên app tài xế. Khi ngừng hoạt động, hệ thống đối soát và hoàn phần được hoàn theo quy định.',
  },
  {
    re: /rút tiền.*tài xế|withdraw/i,
    answer:
      'Rút tiền ví tài xế: vào Ví → Rút, chọn tài khoản đã liên kết. Hệ thống xử lý theo T+n và quy định hiển thị trong app.',
  },
  {
    re: /hủy cuốc|từ chối cuốc|decline.*driver|chính sách hủy.*tài xế/i,
    answer:
      'Tài xế: nên từ chối ngay khi không thể nhận. Hủy sau khi nhận nhiều lần có thể ảnh hưởng điểm và ưu tiên cuốc. Chi tiết trong mục hồ sơ / trung tâm tài khoản tài xế.',
  },
  {
    re: /tai nạn|sự cố|accident|emergency|113|115/i,
    answer:
      'An toàn trước tiên: gọi 113/114/115 khi cần. Sau đó báo FoxGo qua hotline 1900-1234. Giữ bình tĩnh, chụp ảnh hiện trường nếu có thể.',
  },
  {
    re: /giá|cước|bảng giá|phí.*xe máy|bao nhiêu tiền/i,
    answer:
      'Giá cước khách (tham khảo): xe máy / ga / 4 chỗ / 7 chỗ có đơn giá và km khác nhau; giờ cao điểm có thể surge. Giá chính xác hiển thị khi bạn nhập điểm đón–đến trên app.',
  },
  {
    re: /hủy chuyến|cancel.*chuyến|huỷ/i,
    answer:
      'Khách: có thể hủy trong app khi chuyến chưa kết thúc; phí hủy (nếu có) hiển thị theo thời điểm. Tài xế: xem mục chuyến đang chạy để hủy theo quy định.',
  },
  {
    re: /momo|vnpay|thanh toán|payment|trả tiền/i,
    answer:
      'FoxGo hỗ trợ tiền mặt, MoMo, VNPay (tùy cấu hình chuyến). Chọn khi đặt xe; thanh toán online được xử lý sau khi hoàn thành.',
  },
  {
    re: /voucher|mã giảm giá|khuyến mãi|promo/i,
    answer:
      'Voucher: xem mục Ưu đãi, thu thập mã; khi đặt xe có bước áp dụng voucher. Điều kiện từng mã xem trong chi tiết.',
  },
  {
    re: /đặt xe|book|cách đặt/i,
    answer:
      'Đặt xe khách: chọn điểm đón/đến trên bản đồ → loại xe → thanh toán → xác nhận tìm tài xế. Theo dõi trạng thái trên màn hình chuyến.',
  },
  {
    re: /quên đồ|bỏ quên/i,
    answer:
      'Quên đồ: vào Lịch sử chuyến → liên hệ tài xế. Nếu không liên hệ được: support@foxgo.vn hoặc hotline.',
  },
  {
    re: /đăng ký tài xế|lái xe|trở thành tài xế|app tài xế/i,
    answer:
      'Đăng ký tài xế: tải app FoxGo Driver, gửi GPLX, giấy tờ xe, ảnh. Sau duyệt có thể online nhận cuốc.',
  },
  {
    re: /quy tắc|quy định\s+vận hành|quy định.*tài xế|vận hành(?:.*tài xế)?/i,
    answer:
      'Tài xế: đón đúng điểm, không chèo kéo ngoài app, an toàn giao thông, giữ thái độ chuyên nghiệp. Vi phạm nặng có thể khóa tài khoản.',
  },
  {
    re: /liên hệ|hỗ trợ|hotline|support|email/i,
    answer:
      'Liên hệ FoxGo:\n• Hotline: 1900-1234 (8h–22h)\n• Khách: support@foxgo.vn\n• Tài xế: driver-support@foxgo.vn\n• Hoặc chat Mia ngay trong app.',
  },
];

export const FOXGO_QUICK_REPLIES: string[] = [
  'Hoa hồng & ví tài xế',
  'Rút tiền / ký quỹ',
  'Hủy cuốc / từ chối',
  'Quy định vận hành',
  'Đánh giá tài xế',
  'Liên hệ hỗ trợ',
];

export const FOXGO_AI_WELCOME_ASSISTANT =
  'Chào bạn, mình là Mia — trợ lý FoxGo trong app này.\nKhi online, mình trả lời theo kho thông tin chính thức; lúc chậm mạng bạn vẫn có gợi ý nhanh bên dưới.\nBạn cần hỏi gì? Chọn một dòng gợi ý hoặc gõ câu hỏi nhé.';

export const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const findFoxgoQuickAnswer = (text: string): string | null => {
  const matched = FOXGO_QUICK_PATTERNS.find((p) => p.re.test(text));
  return matched ? matched.answer : null;
};

/** Khi API Mia lỗi / trả lời rỗng — dùng gợi ý cục bộ (mỏng hơn RAG trên server). */
export function miaOfflineFallbackReply(text: string): string | null {
  const quick = findFoxgoQuickAnswer(text);
  if (quick) return quick;
  if (GREETING_RE.test(text)) return pickRandom(GREETING_RESPONSES);
  if (THANKS_RE.test(text)) return pickRandom(THANKS_RESPONSES);
  return null;
}

/** RAG top_k — khớp backend (mặc định 8). */
export const FOXGO_AI_CHAT_TOP_K = 8;
