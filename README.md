# Nexus Kinetic

เว็บไซต์แคตตาล็อกเกม 115 รายการ ใช้ดีไซน์แบบ Bright Confidence พร้อมภาพปกและ package ID จาก Google Play ระบบสมาชิก VIP ราคา 550 บาท/เดือน คำสั่งซื้อ หลังบ้านผู้ดูแล และการบันทึกข้อมูลที่รองรับ Google Cloud

## ระบบที่มี

- แคตตาล็อกเกม 115 รายการจากฐานเดิม พร้อมหมวด รายละเอียด ราคา ราคา VIP และสถานะ
- สมัครบัญชี เข้าสู่ระบบ token แบบลงลายเซ็น และสิทธิ์ user/admin
- คำสั่งซื้อใช้ราคาปกติหรือราคา VIP ตามสิทธิ์จริง
- สมาชิก VIP ราคาเดียว 550 บาท/เดือน
- Payment checkout URL และ webhook ตรวจ HMAC ก่อนเปิดสิทธิ์ VIP
- หลังบ้านจัดการสถานะคำสั่งซื้อ ผู้ใช้ สิทธิ์ VIP ราคา และสถานะเกม
- Local ใช้ `data/store.json`; Cloud Run ใช้ Firestore โดยอัตโนมัติ

## รันในเครื่อง

```bash
pnpm install
cp .env.example .env
pnpm dev
```

ตั้ง `ADMIN_EMAIL` ให้ตรงกับอีเมลเจ้าของก่อนสมัครบัญชีครั้งแรก บัญชีนั้นจะได้รับสิทธิ์ admin

## Payment webhook

ส่ง `POST /api/payment/webhook` ด้วย JSON:

```json
{ "status": "paid", "amount": 550, "reference": "USER_ID" }
```

ตั้ง header `x-payment-signature` เป็น HMAC-SHA256 แบบ hex ของ raw JSON โดยใช้ `PAYMENT_WEBHOOK_SECRET` ระบบจะเพิ่ม VIP 1 เดือนเฉพาะยอด 550 บาทและลายเซ็นถูกต้อง

## Deploy ไป Google Cloud Run

ต้องมีโปรเจกต์ Google Cloud และ `gcloud` ที่ล็อกอินแล้ว:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
gcloud firestore databases create --location=asia-southeast1
gcloud artifacts repositories create nexus --repository-format=docker --location=asia-southeast1
printf "replace-with-a-long-random-secret" | gcloud secrets create nexus-session-secret --data-file=-
printf "replace-with-payment-webhook-secret" | gcloud secrets create nexus-payment-webhook-secret --data-file=-
gcloud builds submit --config cloudbuild.yaml
```

ให้ Cloud Run service account มีสิทธิ์ `roles/datastore.user` และ `roles/secretmanager.secretAccessor` จากนั้นตั้งค่าตัวแปรเพิ่มเติม:

```bash
gcloud run services update nexus-kinetic --region=asia-southeast1 \
  --set-env-vars=ADMIN_EMAIL=owner@example.com,PAYMENT_CHECKOUT_URL=https://provider.example/checkout
```

ตรวจระบบหลัง deploy ที่ `https://YOUR_CLOUD_RUN_URL/api/health` ซึ่งต้องตอบ `storage: firestore`

## ข้อควรทำก่อน production

- ใช้ Secret Manager เก็บ secret ทุกตัว
- เปลี่ยน `PAYMENT_CHECKOUT_URL` และรูปแบบ webhook ให้ตรงเอกสารของผู้ให้บริการจริง
- เปิด Cloud Armor/rate limiting หากรับทราฟฟิกสาธารณะจำนวนมาก
- สำรอง Firestore และเปิด Cloud Logging alert
