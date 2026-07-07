import { useEffect, useMemo, useState } from "react";
import { Bell, Check, ChevronRight, Headphones, Home, LayoutGrid, LogOut, Menu, PackageCheck, Search, Settings2, ShieldCheck, ShoppingBag, Sparkles, UserRound, Users, X } from "lucide-react";

type Service = { id: string; name: string; officialTitle?: string; packageId?: string; description: string; price: number; vipPrice?: number; status?: string; tags?: string[]; lastUpdated?: string; icon: string; imageUrl?: string; category?: string };
type User = { id: string; name: string; email: string; role: string; vipUntil?: string };
type Order = { id: string; serviceName: string; status: string; createdAt: string };
type AdminOverview = { users: User[]; orders: (Order & { userId: string; price: number })[]; games: Service[] };
const iconMap: Record<string, any> = {};

async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("nk_token");
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => { api("/api/services").then(setServices); api("/api/me").then(setUser).catch(() => localStorage.removeItem("nk_token")); }, []);
  useEffect(() => { if (user) api("/api/orders").then(setOrders); }, [user]);
  const filtered = useMemo(() => services.filter(s => `${s.name} ${s.description}`.toLowerCase().includes(query.toLowerCase())), [services, query]);

  const createOrder = async (service: Service) => {
    if (!user) return setAuthOpen(true);
    try { const order = await api("/api/orders", { method: "POST", body: JSON.stringify({ serviceId: service.id }) }); setOrders(v => [order, ...v]); setNotice(`รับคำขอ ${service.name} แล้ว`); }
    catch (e: any) { setNotice(e.message); }
  };
  const checkout = async () => {
    if (!user) { setVipOpen(false); return setAuthOpen(true); }
    try { const { checkoutUrl } = await api("/api/checkout/vip", { method: "POST" }); window.location.href = checkoutUrl; }
    catch (e: any) { setNotice(e.message); setVipOpen(false); }
  };
  const logout = () => { localStorage.removeItem("nk_token"); setUser(null); setOrders([]); };

  return <div className="app-shell">
    <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">N</span><span>NEXUS<small>KINETIC</small></span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
      <nav>
        <a className="active" href="#home"><Home />หน้าหลัก</a><a href="#services"><LayoutGrid />เกมทั้งหมด</a><a href="#orders"><ShoppingBag />คำสั่งซื้อของฉัน</a><a href="#vip"><Sparkles />สมาชิก VIP</a>{user?.role === "admin" && <button className="nav-button" onClick={() => setAdminOpen(true)}><Users />แผงผู้ดูแล</button>}<a href="#support"><Headphones />ศูนย์ช่วยเหลือ</a>
      </nav>
      <div className="delivery-note"><PackageCheck /><strong>สถานะโปร่งใส</strong><p>ติดตามทุกคำขอได้จากบัญชีของคุณ ไม่มีการอ้างว่าส่งมอบสิ่งที่ระบบทำไม่ได้</p></div>
      {user && <div className="profile"><div className="avatar">{user.name[0]}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button onClick={logout}><LogOut /></button></div>}
    </aside>

    <main>
      <header><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu /></button><div className="search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อเกม" /></div><button className="icon-button"><Bell /></button>{user ? <button className="account"><UserRound />{user.name}</button> : <button className="account primary" onClick={() => setAuthOpen(true)}>เข้าสู่ระบบ</button>}</header>

      <div className="page" id="home">
        <section className="hero"><div><span className="eyebrow">แคตตาล็อกเกมครบจากฐานเดิม</span><h1>เลือกเกมที่ต้องการ<br/><em>ได้ง่ายกว่าเดิม</em></h1><p>รวมข้อมูลเกม 115 รายการ แยกหมวดชัดเจน พร้อมภาพปกจากหน้าร้าน Google Play และราคาของแต่ละเกม</p><div className="hero-actions"><a href="#services" className="button primary">ดูเกมทั้งหมด<ChevronRight /></a><button className="button secondary" onClick={() => setVipOpen(true)}>ดูสิทธิ์ VIP</button></div><div className="trust-row"><span><ShieldCheck />ภาพปกตรวจจากหน้าร้าน</span><span><Check />ค้นหาเกมได้ทันที</span></div></div><div className="hero-panel"><div className="mini-head"><span>สมาชิก Nexus</span><span className="status-dot">ระบบพร้อมใช้งาน</span></div><div className="metric"><small>แพ็กเกจสมาชิก</small><strong>VIP <b>฿550</b><small>/เดือน</small></strong></div><div className="mini-list"><span><Check />ใช้ราคา VIP ของแต่ละเกม</span><span><Check />ดูประวัติคำสั่งซื้อในบัญชี</span><span><Check />ค้นหาเกมครบทุกหมวด</span></div><button onClick={() => setVipOpen(true)}>ดูรายละเอียดสมาชิก</button></div></section>

        <section className="trust-strip"><div><ShieldCheck /><span><strong>ข้อมูลชัดเจน</strong><small>แจ้งสิ่งที่ทำได้ก่อนสั่งซื้อ</small></span></div><div><PackageCheck /><span><strong>ติดตามสถานะได้</strong><small>ทุกคำขอมีเลขอ้างอิง</small></span></div><div><Headphones /><span><strong>มีทีมงานดูแล</strong><small>ตอบตามเวลาที่ระบุ</small></span></div></section>

        <section id="services" className="section"><div className="section-title"><div><span>ข้อมูลเกมจากฐานเดิม พร้อมภาพปกจาก Google Play</span><h2>เกมทั้งหมด</h2></div><p>{filtered.length} เกม</p></div><div className="service-grid">{filtered.map(service => { const Icon = iconMap[service.icon] || Settings2; return <article className={service.imageUrl ? "service-card game-card" : "service-card"} key={service.id}>{service.imageUrl ? <img className="game-cover" src={service.imageUrl} alt={`ภาพปก ${service.name}`} /> : <div className="service-icon"><Icon /></div>}<div className="service-copy">{service.category && <small>{service.category}</small>}<h3>{service.name}</h3><p>{service.description}</p><span>{service.status === "Working" ? "พร้อมทำรายการ" : service.status}</span></div><div className="service-buy"><strong>฿{service.price.toLocaleString()}</strong>{service.vipPrice && <small>VIP ฿{service.vipPrice.toLocaleString()}</small>}<button onClick={() => createOrder(service)}>ทำรายการ<ChevronRight /></button></div></article>})}</div></section>

        <section id="vip" className="vip"><div><span className="eyebrow">แพ็กเกจเดียว เข้าใจง่าย</span><h2>VIP สำหรับคนที่ต้องการการดูแลต่อเนื่อง</h2><p>ไม่มีระดับแพ็กเกจซับซ้อน จ่ายราคาเดียวและยกเลิกได้ทุกเมื่อ</p></div><div className="vip-price"><strong>฿550</strong><span>/เดือน</span><button onClick={() => setVipOpen(true)}>สมัคร VIP</button></div></section>

        <section id="orders" className="orders section"><div className="section-title"><div><span>อัปเดตจากระบบจริง</span><h2>คำสั่งซื้อล่าสุด</h2></div></div>{!user ? <div className="empty">เข้าสู่ระบบเพื่อดูสถานะคำขอของคุณ<button onClick={() => setAuthOpen(true)}>เข้าสู่ระบบ</button></div> : orders.length === 0 ? <div className="empty">ยังไม่มีคำสั่งซื้อ เลือกเกมด้านบนเพื่อเริ่มต้น</div> : <div className="order-list">{orders.map(o => <div key={o.id}><span className="order-icon"><PackageCheck /></span><div><strong>{o.serviceName}</strong><small>{o.id} · {new Date(o.createdAt).toLocaleDateString("th-TH")}</small></div><b>{o.status}</b></div>)}</div>}</section>
      </div>
      <footer id="support"><div className="brand compact"><span className="brand-mark">N</span><span>NEXUS<small>KINETIC</small></span></div><p>แคตตาล็อกเกม พร้อมระบบสมาชิกและติดตามคำสั่งซื้อ</p><div><a href="#services">เกมทั้งหมด</a><a href="#vip">สมาชิก</a><a href="mailto:support@nexuskinetic.example">ติดต่อเรา</a></div></footer>
    </main>

    {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={(token, nextUser) => { localStorage.setItem("nk_token", token); setUser(nextUser); setAuthOpen(false); }} />}
    {vipOpen && <Modal title="Nexus VIP" onClose={() => setVipOpen(false)}><div className="plan-modal"><div className="plan-price"><strong>฿550</strong><span>ต่อเดือน</span></div><ul><li><Check />ใช้ราคา VIP ของเกมทุกหมวด</li><li><Check />ดูและติดตามประวัติคำสั่งซื้อ</li><li><Check />ค้นหาเกมจากแคตตาล็อกทั้งหมด</li><li><Check />ยกเลิกได้ทุกเมื่อ</li></ul><button className="button primary full" onClick={checkout}>ไปยังหน้าชำระเงินที่ปลอดภัย</button><small>ระบบจะเปิดหน้าชำระเงินของผู้ให้บริการที่ตั้งค่าไว้ ไม่มีการบันทึกข้อมูลบัตรในเว็บไซต์นี้</small></div></Modal>}
    {adminOpen && user?.role === "admin" && <AdminPanel onClose={() => setAdminOpen(false)} onNotice={setNotice} />}
  </div>;
}

function AdminPanel({ onClose, onNotice }: { onClose: () => void; onNotice: (value: string) => void }) {
  const [data, setData] = useState<AdminOverview | null>(null); const [tab, setTab] = useState<"orders" | "users" | "games">("orders"); const [showAdd, setShowAdd] = useState(false);
  const refresh = () => api("/api/admin/overview").then(setData).catch((error: Error) => onNotice(error.message));
  useEffect(() => { refresh(); }, []);
  const mutate = async (path: string, method: string, body?: unknown) => { try { await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); await refresh(); onNotice("บันทึกเรียบร้อย"); } catch (error: any) { onNotice(error.message); } };
  const patch = (path: string, body: unknown) => mutate(path, "PATCH", body);
  const addGame = async (event: any) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); await mutate("/api/admin/games", "POST", values); setShowAdd(false); };
  return <div className="admin-overlay"><div className="admin-panel"><div className="admin-head"><div><span>ระบบหลังบ้าน</span><h2>แผงควบคุมผู้ดูแล</h2></div><button onClick={onClose}><X /></button></div><div className="admin-stats"><div><strong>{data?.games.length || 0}</strong><small>เกม</small></div><div><strong>{data?.orders.length || 0}</strong><small>คำสั่งซื้อ</small></div><div><strong>{data?.users.length || 0}</strong><small>ผู้ใช้</small></div></div><div className="admin-tabs"><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>คำสั่งซื้อ</button><button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>ผู้ใช้และ VIP</button><button className={tab === "games" ? "active" : ""} onClick={() => setTab("games")}>ข้อมูลเกม</button></div><div className="admin-table-wrap">
    {tab === "orders" && <table><thead><tr><th>เลขที่</th><th>เกม</th><th>ราคา</th><th>สถานะ</th></tr></thead><tbody>{data?.orders.map(order => <tr key={order.id}><td>{order.id}</td><td>{order.serviceName}</td><td>฿{order.price}</td><td><select value={order.status} onChange={e => patch(`/api/admin/orders/${order.id}`, { status: e.target.value })}><option>รอรับเรื่อง</option><option>กำลังดำเนินการ</option><option>ส่งมอบแล้ว</option><option>ยกเลิก</option></select></td></tr>)}</tbody></table>}
    {tab === "users" && <table><thead><tr><th>ผู้ใช้</th><th>สิทธิ์</th><th>VIP ถึง</th><th>จัดการ</th></tr></thead><tbody>{data?.users.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.email}</small></td><td>{item.role}</td><td>{item.vipUntil ? new Date(item.vipUntil).toLocaleDateString("th-TH") : "—"}</td><td><button onClick={() => patch(`/api/admin/users/${item.id}`, { vipMonths: 1 })}>+ VIP 1 เดือน</button>{item.vipUntil && <button className="danger" onClick={() => patch(`/api/admin/users/${item.id}`, { revokeVip: true })}>ยกเลิก VIP</button>}<button onClick={() => patch(`/api/admin/users/${item.id}`, { role: item.role === "admin" ? "user" : "admin" })}>{item.role === "admin" ? "เปลี่ยนเป็นผู้ใช้" : "ตั้งเป็นแอดมิน"}</button></td></tr>)}</tbody></table>}
    {tab === "games" && <><div className="admin-actions"><button onClick={() => setShowAdd(!showAdd)}>{showAdd ? "ยกเลิก" : "+ เพิ่มเกม"}</button></div>{showAdd && <form className="add-game-form" onSubmit={addGame}><input name="name" placeholder="ชื่อเกม" required/><input name="packageId" placeholder="Package ID" required/><input name="imageUrl" type="url" placeholder="URL ภาพปก" required/><input name="category" placeholder="หมวด"/><input name="price" type="number" placeholder="ราคาปกติ"/><input name="vipPrice" type="number" placeholder="ราคา VIP"/><input name="description" placeholder="รายละเอียด"/><button>บันทึกเกม</button></form>}<table><thead><tr><th>เกม</th><th>หมวด</th><th>ราคาปกติ</th><th>VIP</th><th>สถานะ</th><th></th></tr></thead><tbody>{data?.games.map(game => <tr key={game.id}><td><div className="game-cell"><img src={game.imageUrl} alt=""/><span><strong>{game.name}</strong><small>{game.packageId}</small></span></div></td><td>{game.category}</td><td><input type="number" defaultValue={game.price} onBlur={e => patch(`/api/admin/games/${game.id}`, { price: e.target.value })}/></td><td><input type="number" defaultValue={game.vipPrice} onBlur={e => patch(`/api/admin/games/${game.id}`, { vipPrice: e.target.value })}/></td><td><select value={game.status} onChange={e => patch(`/api/admin/games/${game.id}`, { status: e.target.value })}><option>Working</option><option>Maintenance</option><option>Unavailable</option></select></td><td><button className="danger" onClick={() => mutate(`/api/admin/games/${game.id}`, "DELETE")}>ลบ</button></td></tr>)}</tbody></table></>}
  </div></div></div>;
}

function Modal({ title, onClose, children }: any) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X /></button></div>{children}</div></div> }
function AuthModal({ onClose, onSuccess }: any) {
  const [register, setRegister] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: any) => { e.preventDefault(); setBusy(true); setError(""); const fd = new FormData(e.currentTarget); try { const body = Object.fromEntries(fd); const data = await api(`/api/auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) }); onSuccess(data.token, data.user); } catch (err: any) { setError(err.message); } finally { setBusy(false); } };
  return <Modal title={register ? "สร้างบัญชี" : "ยินดีต้อนรับกลับ"} onClose={onClose}><form className="auth-form" onSubmit={submit}>{register && <label>ชื่อที่ใช้แสดง<input name="name" required minLength={2} /></label>}<label>อีเมล<input name="email" type="email" required /></label><label>รหัสผ่าน<input name="password" type="password" required minLength={8} /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? "กำลังดำเนินการ…" : register ? "สร้างบัญชี" : "เข้าสู่ระบบ"}</button><button type="button" className="text-button" onClick={() => setRegister(!register)}>{register ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สร้างบัญชี"}</button></form></Modal>
}
