# Rebuild hệ thống & Reseed data

## 1. Rebuild + restart toàn bộ service (Docker)

```bash
# Dừng và xóa container cũ, build lại image từ source mới, khởi động lại
docker compose down
docker compose up -d --build
```

> Sau khi lên, gateway có thể mất 5–10s để downstream gRPC sẵn sàng.  
> Kiểm tra: `docker compose ps` — tất cả phải ở trạng thái `Up`.

---

## 2. Chỉ rebuild một số service cụ thể

```bash
# Ví dụ chỉ rebuild api-gateway và ride-service
docker compose up -d --build api-gateway ride-service
```

---

## 3. Reset database + migrate + seed lại

Chạy **2 lệnh riêng biệt**:

### Bước 1 — Reset cấu trúc (drop DB, tạo lại, push schema)
```bat
scripts\reset-database.bat
```
> Làm: Drop + Create 7 PG databases, drop 2 Mongo databases, chạy `prisma db push` cho từng service.  


### Bước 2 — Seed dữ liệu
```bash
npm run db:seed
```
> Chạy `scripts/seed-database.ts`: tạo admin, customers, drivers, rides, wallets, v.v.

---

## 4. Chỉ seed lại (không reset schema)

```bash
npm run db:seed
```

Nếu seed lỗi enum mismatch (vd: `VehicleType` không nhận `CAR_4`) → chạy full reset ở bước 3.

---

## 5. Kiểm tra sau rebuild

```bash
# Smoke test gateway (cần stack đang chạy)
npm run smoke:gateway

# Xem log service cụ thể
docker compose logs -f api-gateway
docker compose logs -f auth-service

# Lấy OTP đăng ký (dev mock)
docker logs cab-auth-service 2>&1 | findstr OTP      # Windows
docker logs cab-auth-service 2>&1 | grep OTP         # Linux
```

---

## 4. Thứ tự đề xuất khi có thay đổi code lớn

```
1. docker compose down
2. docker compose up -d --build
3. scripts\reset-database.bat       ← reset schema (3 bước)
4. npm run db:seed                  ← seed dữ liệu
5. npm run smoke:gateway            ← kiểm tra
```
