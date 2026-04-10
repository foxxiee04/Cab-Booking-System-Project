# Thiet ke he thong xac thuc OTP

## 1. Muc tieu

He thong OTP duoc thiet ke de xac minh nguoi dung thuc su so huu so dien thoai dang ky. OTP chi phuc vu muc dich verify, khong co API fetch OTP.

## 2. Nguyen tac thiet ke

- OTP duoc sinh va quan ly hoan toan tai server.
- OTP duoc luu duoi dang hash, kem TTL ngan mac dinh 120 giay.
- OTP chi duoc dung mot lan va bi xoa ngay sau khi verify thanh cong.
- Gioi han toi da 5 lan nhap sai cho moi ma OTP.
- Gioi han resend va rate limit theo so dien thoai/IP de chong spam.
- Client chi gui `request OTP` va `verify OTP`, khong bao gio nhan plain OTP tu API.

## 3. Kien truc thanh phan

Client
↓
Auth API
↓
OTP Service
├── Redis (hash OTP + TTL + attempt counter + resend cooldown)
└── SMS Gateway

`SMS Gateway` duoc truu tuong hoa bang `SmsService`:

- `mock`: ghi OTP vao log cua `auth-service` phuc vu moi truong KLTN/dev.
- `twilio`: gui OTP qua nha cung cap SMS that.

## 4. Luong xu ly

### 4.1. Dang ky moi

1. Client gui so dien thoai.
2. Auth API sinh OTP 6 chu so.
3. OTP Service hash OTP va luu vao Redis voi TTL 120 giay.
4. SMS Gateway gui OTP:
   - Dev/KLTN: ghi log server.
   - Production: gui SMS that.
5. Client nhap OTP va gui verify.
6. Server kiem tra hash, TTL, so lan sai.
7. Neu hop le, cho phep hoan tat dang ky.

### 4.2. Quen mat khau

Dung chung co che OTP nhung voi `purpose=reset`.

## 5. Van hanh trong moi truong KLTN/dev

Trong che do `OTP_SMS_MODE=mock`, `auth-service` ghi OTP ra log theo mau:

```text
[OTP][register] 0555555555: 646906
```

Co the xem OTP bang cac lenh nhu:

```bash
docker logs --tail 200 cab-auth-service
docker compose logs --tail 200 --no-color auth-service
pm2 logs auth-service
```

Co che nay giu nguyen kien truc server-side OTP, chi thay kenh gui SMS bang log server.

## 6. Kha nang mo rong

Khi chuyen sang production, chi can cau hinh `OTP_SMS_MODE=twilio` va cac bien `TWILIO_*`. Khong can thay doi luong register, verify, Redis hay giao dien client.