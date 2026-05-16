# Script nói nhanh 2 mô hình AI FoxGo

## AI 1: Định giá và dispatch tài xế

Nói theo mũi tên:
- Khách đặt xe tạo ra input: điểm đón, điểm đến, loại xe và thời điểm.
- Feature builder gom thêm quãng đường, khu vực, nhu cầu/cung tài xế và danh sách tài xế gần đó.
- AI Service chạy 3 model: ETA + surge để hỗ trợ báo giá, P_accept để đo khả năng tài xế nhận cuốc, wait-time để ước lượng thời gian khách phải chờ.
- Kết quả cuối có 2 nhánh: báo giá và xếp hạng tài xế.
- Giá dựa trên base fare, phí loại xe, phí km, phí phút và surge.
- Dispatch dựa trên ETA, rating, tỷ lệ nhận, tỷ lệ hủy, thời gian rảnh, priority và P_accept.
- Nếu AI lỗi hoặc timeout, hệ thống dùng rule-based fallback: pricing cố định, Redis GEO và P_accept = 1.0.

Một câu chốt:
- AI giúp ưu tiên tài xế có khả năng nhận cuốc cao hơn, nhưng vẫn có reason_code và score_breakdown để giải thích.

## AI 2: Chatbot Mia RAG

Nói theo mũi tên:
- Trước khi chat, tài liệu FoxGo được tách chunk, embedding tiếng Việt và lưu vào FAISS + BM25.
- Khi người dùng hỏi, hệ thống lấy câu hỏi và lịch sử hội thoại.
- Nếu câu hỏi mơ hồ, hệ thống rewrite query để tìm đúng hơn.
- Retrieval tìm ngữ cảnh bằng semantic search và keyword search, sau đó rerank top context.
- Context được đưa vào grounded prompt cùng persona Mia.
- LLM ưu tiên OpenAI rồi Gemini, key lấy từ biến môi trường.
- Nếu score thấp, thiếu key hoặc LLM lỗi, chatbot dùng fallback: Q&A, template, hỏi lại hoặc đưa hotline/email.

Một câu chốt:
- RAG giúp Mia trả lời theo tài liệu FoxGo thay vì tự đoán, và output có sources/mode/score để kiểm tra độ tin cậy.
