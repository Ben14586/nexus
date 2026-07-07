import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

type Role = "user" | "admin";
type User = { id: string; name: string; email: string; passwordHash: string; salt: string; role: Role; vipUntil?: string; createdAt: string };
type OrderStatus = "รอรับเรื่อง" | "กำลังดำเนินการ" | "ส่งมอบแล้ว" | "ยกเลิก";
type Order = { id: string; userId: string; serviceId: string; serviceName: string; price: number; status: OrderStatus; createdAt: string; updatedAt: string };
type Game = { id: string; name: string; officialTitle: string; packageId: string; category: string; description: string; tags: string[]; price: number; vipPrice: number; status: string; imageUrl: string; lastUpdated: string };
type Store = { users: User[]; orders: Order[]; games: Game[] };

const baseCatalog: Game[] = JSON.parse(fs.readFileSync(path.resolve("game-catalog.json"), "utf8"));
const dataDir = path.resolve("data");
const dataFile = path.join(dataDir, "store.json");
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "";
const useFirestore = Boolean(projectId && process.env.USE_FIRESTORE !== "false");
const sessionSecret = process.env.SESSION_SECRET || "local-development-secret-change-before-production";

async function metadataToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } });
  if (!response.ok) throw new Error(`Google metadata token failed: ${response.status}`);
  return (await response.json() as { access_token: string }).access_token;
}

async function firestoreRequest(method: string, body?: unknown) {
  const token = await metadataToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/nexus/state`;
  return fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}

function emptyStore(): Store { return { users: [], orders: [], games: structuredClone(baseCatalog) }; }

async function loadStore(): Promise<Store> {
  if (useFirestore) {
    const response = await firestoreRequest("GET");
    if (response.status === 404) { const initial = emptyStore(); await saveStore(initial); return initial; }
    if (!response.ok) throw new Error(`Firestore read failed: ${response.status}`);
    const document = await response.json() as any;
    const parsed = JSON.parse(document.fields.payload.stringValue) as Store;
    if (!parsed.games?.length) parsed.games = structuredClone(baseCatalog);
    return parsed;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify(emptyStore(), null, 2));
  const store = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Partial<Store>;
  return { users: store.users || [], orders: store.orders || [], games: store.games?.length ? store.games : structuredClone(baseCatalog) };
}

async function saveStore(store: Store) {
  if (useFirestore) {
    const response = await firestoreRequest("PATCH", { fields: { payload: { stringValue: JSON.stringify(store) } } });
    if (!response.ok) throw new Error(`Firestore write failed: ${response.status}`);
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function hash(password: string, salt: string) { return crypto.scryptSync(password, salt, 64).toString("hex"); }
function signToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 7 * 86400000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function verifyToken(value?: string) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; exp: number }; return parsed.exp > Date.now() ? parsed.userId : null; } catch { return null; }
}
function publicUser(user: User) { return { id: user.id, name: user.name, email: user.email, role: user.role, vipUntil: user.vipUntil, createdAt: user.createdAt }; }
function addMonth(value?: string) { const base = value && new Date(value) > new Date() ? new Date(value) : new Date(); base.setMonth(base.getMonth() + 1); return base.toISOString(); }

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  app.use(express.json({ limit: "200kb", verify: (req: any, _res, buffer) => { req.rawBody = buffer; } }));

  const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = verifyToken(req.header("authorization")?.replace(/^Bearer\s+/i, ""));
    if (!userId) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
    const user = (await loadStore()).users.find(item => item.id === userId);
    if (!user) return res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });
    (req as any).user = user; next();
  };
  const admin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "สงวนสิทธิ์สำหรับผู้ดูแลระบบ" });
    next();
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true, storage: useFirestore ? "firestore" : "local", games: baseCatalog.length }));
  app.get("/api/services", async (_req, res) => res.json((await loadStore()).games));

  app.post("/api/auth/register", async (req, res) => {
    const name = String(req.body.name || "").trim(); const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "");
    if (name.length < 2 || !email.includes("@") || password.length < 8) return res.status(400).json({ error: "กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร" });
    const store = await loadStore();
    if (store.users.some(user => user.email === email)) return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
    const salt = crypto.randomBytes(16).toString("hex");
    const role: Role = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "user";
    const user: User = { id: crypto.randomUUID(), name, email, salt, passwordHash: hash(password, salt), role, createdAt: new Date().toISOString() };
    store.users.push(user); await saveStore(store);
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  });
  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "");
    const user = (await loadStore()).users.find(item => item.email === email);
    if (!user || hash(password, user.salt) !== user.passwordHash) return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  });
  app.get("/api/me", auth, (req, res) => res.json(publicUser((req as any).user)));
  app.get("/api/orders", auth, async (req, res) => res.json((await loadStore()).orders.filter(order => order.userId === (req as any).user.id)));
  app.post("/api/orders", auth, async (req, res) => {
    const store = await loadStore(); const game = store.games.find(item => item.id === req.body.serviceId);
    if (!game) return res.status(404).json({ error: "ไม่พบเกม" });
    const user = (req as any).user as User; const isVip = Boolean(user.vipUntil && new Date(user.vipUntil) > new Date());
    const now = new Date().toISOString();
    const order: Order = { id: `NK-${Date.now().toString().slice(-8)}`, userId: user.id, serviceId: game.id, serviceName: game.name, price: isVip ? game.vipPrice : game.price, status: "รอรับเรื่อง", createdAt: now, updatedAt: now };
    store.orders.unshift(order); await saveStore(store); res.status(201).json(order);
  });

  app.post("/api/checkout/vip", auth, (req, res) => {
    const base = process.env.PAYMENT_CHECKOUT_URL;
    if (!base) return res.status(503).json({ error: "ยังไม่ได้ตั้งค่าผู้ให้บริการชำระเงิน กรุณากำหนด PAYMENT_CHECKOUT_URL" });
    const url = new URL(base); url.searchParams.set("plan", "vip-monthly"); url.searchParams.set("amount", "550"); url.searchParams.set("reference", (req as any).user.id);
    res.json({ checkoutUrl: url.toString() });
  });
  app.post("/api/payment/webhook", async (req: any, res) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: "Webhook secret is not configured" });
    const signature = req.header("x-payment-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody || Buffer.from("")).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: "Invalid webhook signature" });
    if (req.body.status === "paid" && Number(req.body.amount) === 550 && req.body.reference) {
      const store = await loadStore(); const user = store.users.find(item => item.id === req.body.reference);
      if (user) { user.vipUntil = addMonth(user.vipUntil); await saveStore(store); }
    }
    res.json({ received: true });
  });

  app.get("/api/admin/overview", auth, admin, async (_req, res) => { const store = await loadStore(); res.json({ users: store.users.map(publicUser), orders: store.orders, games: store.games }); });
  app.patch("/api/admin/orders/:id", auth, admin, async (req, res) => {
    const allowed: OrderStatus[] = ["รอรับเรื่อง", "กำลังดำเนินการ", "ส่งมอบแล้ว", "ยกเลิก"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
    const store = await loadStore(); const order = store.orders.find(item => item.id === req.params.id); if (!order) return res.status(404).json({ error: "ไม่พบคำสั่งซื้อ" });
    order.status = req.body.status; order.updatedAt = new Date().toISOString(); await saveStore(store); res.json(order);
  });
  app.patch("/api/admin/users/:id", auth, admin, async (req, res) => {
    const store = await loadStore(); const user = store.users.find(item => item.id === req.params.id); if (!user) return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    if (req.body.role === "user" || req.body.role === "admin") user.role = req.body.role;
    if (req.body.vipMonths) { const months = Math.max(1, Math.min(24, Number(req.body.vipMonths))); for (let i = 0; i < months; i++) user.vipUntil = addMonth(user.vipUntil); }
    if (req.body.revokeVip) delete user.vipUntil;
    await saveStore(store); res.json(publicUser(user));
  });
  app.patch("/api/admin/games/:id", auth, admin, async (req, res) => {
    const store = await loadStore(); const game = store.games.find(item => item.id === req.params.id); if (!game) return res.status(404).json({ error: "ไม่พบเกม" });
    for (const key of ["name", "description", "category", "status", "imageUrl"] as const) if (typeof req.body[key] === "string") (game as any)[key] = req.body[key].trim();
    for (const key of ["price", "vipPrice"] as const) if (Number.isFinite(Number(req.body[key]))) game[key] = Math.max(0, Number(req.body[key]));
    game.lastUpdated = new Date().toLocaleDateString("th-TH"); await saveStore(store); res.json(game);
  });
  app.post("/api/admin/games", auth, admin, async (req, res) => {
    const name = String(req.body.name || "").trim(); const imageUrl = String(req.body.imageUrl || "").trim(); const packageId = String(req.body.packageId || "").trim();
    if (!name || !imageUrl || !packageId) return res.status(400).json({ error: "กรอกชื่อเกม package ID และ URL ภาพปก" });
    const store = await loadStore(); if (store.games.some(item => item.packageId.toLowerCase() === packageId.toLowerCase())) return res.status(409).json({ error: "package ID นี้มีอยู่แล้ว" });
    const game: Game = { id: `G-NEW-${Date.now()}`, name, officialTitle: name, packageId, category: String(req.body.category || "Other"), description: String(req.body.description || ""), tags: [], price: Math.max(0, Number(req.body.price || 0)), vipPrice: Math.max(0, Number(req.body.vipPrice || 0)), status: "Working", imageUrl, lastUpdated: new Date().toLocaleDateString("th-TH") };
    store.games.unshift(game); await saveStore(store); res.status(201).json(game);
  });
  app.delete("/api/admin/games/:id", auth, admin, async (req, res) => {
    const store = await loadStore(); const before = store.games.length; store.games = store.games.filter(item => item.id !== req.params.id);
    if (store.games.length === before) return res.status(404).json({ error: "ไม่พบเกม" });
    await saveStore(store); res.json({ deleted: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" }); app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist"); app.use(express.static(distPath)); app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" }); });
  app.listen(port, "0.0.0.0", () => console.log(`Nexus Kinetic running on http://localhost:${port} (${useFirestore ? "Firestore" : "local"})`));
}
startServer();
