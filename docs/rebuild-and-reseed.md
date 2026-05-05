# Rebuild & reseed (ngắn gọn)

## Rebuild Docker

```bash
docker compose down
docker compose up -d --build
```

Chỉ build vài service: `docker compose up -d --build api-gateway`

Đợi vài giây rồi kiểm tra: `docker compose ps`

---

## Reseed đầy đủ (xóa DB → schema → seed API)

```bat
scripts\reset-database.bat
```

```bash
npm run db:seed
```

- Reset: drop PG/Mongo + `prisma db push`, script có bước restart service sau push (wallet cần re-seed `SystemBankAccount`).
- Seed: `scripts/seed-database.ts` — pure API Gateway (ngoại lệ 1 admin bootstrap DB). Kết quả: `docs/seed-accounts-reference.md`.

Linux/macOS có thể dùng `./scripts/reset-database.sh`.

---

## Chỉ chạy lại seed (DB đã đúng schema)

```bash
npm run db:seed
```

Nếu lỗi schema/enum → chạy full reset như trên.

---

## Kiểm tra nhanh

```bash
curl -s http://localhost:3000/health
npm run smoke:gateway
```

Mật khẩu seed chung: xem `docs/seed-accounts-reference.md`.
