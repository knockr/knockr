import { useState, useEffect, useRef } from "react";

// ══════════════════════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════════════════════
const STREETS = [
  { name: "Elm Street",  y: 20 },
  { name: "Oak Avenue",  y: 40 },
  { name: "Maple Drive", y: 60 },
  { name: "Cedar Blvd",  y: 80 },
];

function generateHouses() {
  const houses = [];
  let id = 1;
  STREETS.forEach((street) => {
    for (let i = 0; i < 10; i++) {
      houses.push({
        id: id++,
        number: 100 + i * 2 + Math.floor(Math.random() * 2),
        street: street.name,
        x: 8 + i * 9,
        y: street.y,
        status: "unvisited",
        leadInfo: null,
      });
    }
  });
  return houses;
}

const STATUS_CONFIG = {
  unvisited:      { color: "#4a5568", label: "Not Visited",    icon: "○" },
  no_answer:      { color: "#f6ad55", label: "No Answer",      icon: "—" },
  not_interested: { color: "#fc8181", label: "Not Interested", icon: "✕" },
  answered:       { color: "#68d391", label: "Answered",       icon: "✓" },
  lead:           { color: "#63b3ed", label: "Lead!",          icon: "★" },
};

// Each rep has their own unique login
const USERS = [
  { id: 1, name: "Jordan K.", email: "jordan@knockr.io", password: "jordan123", role: "rep",     avatar: "JK", color: "#00e5ff" },
  { id: 2, name: "Admin",     email: "admin@knockr.io",  password: "admin",     role: "manager", avatar: "AD", color: "#a78bfa" },
];

const GRADES = {
  A: { color: "#22c55e", bg: "#052e16", desc: "Ready to move" },
  B: { color: "#60a5fa", bg: "#0c1a2e", desc: "Needs follow-up" },
  C: { color: "#fbbf24", bg: "#1c1200", desc: "Worth a callback" },
  D: { color: "#f87171", bg: "#1f0505", desc: "Low priority" },
};

const SERVICES = {
  "Polymeric Sanding": { color: "#a78bfa", bg: "#1e0a4a" },
  "Sealing":           { color: "#34d399", bg: "#022c1a" },
  "Deck Staining":     { color: "#fbbf24", bg: "#1c1200" },
};

// Per-rep historical data
const REP_DATA = {
  "Jordan K.": {
    lifetime: { sessions: 89, doors: 4231, answered: 2318, leads: 312, duration: "134h 22m" },
    monthly: [
      { month: "Jan", doors: 980,  leads: 71  },
      { month: "Feb", doors: 1120, leads: 89  },
      { month: "Mar", doors: 1340, leads: 104 },
      { month: "Apr", doors: 791,  leads: 48  },
    ],
    recentSessions: [
      { date: "Apr 14", neighborhood: "The Annex",  doors: 47, answered: 31, leads: 2, duration: "1h 22m" },
      { date: "Apr 13", neighborhood: "Davisville", doors: 52, answered: 34, leads: 1, duration: "1h 41m" },
      { date: "Apr 12", neighborhood: "Midtown",    doors: 38, answered: 21, leads: 1, duration: "1h 08m" },
    ],
    leads: [
      { id: 1,  name: "Sandra T.",  address: "88 Bloor St W",    phone: "(416) 882-1234", date: "Apr 14", neighborhood: "The Annex",  grade: "A", service: "Polymeric Sanding" },
      { id: 2,  name: "Marcus L.",  address: "14 Bernard Ave",   phone: "(416) 553-9901", date: "Apr 14", neighborhood: "The Annex",  grade: "B", service: "Polymeric Sanding" },
      { id: 3,  name: "Priya M.",   address: "231 Davenport Rd", phone: "(416) 771-3345", date: "Apr 13", neighborhood: "Davisville", grade: "A", service: "Sealing" },
      { id: 4,  name: "Kevin W.",   address: "55 Rosehill Ave",  phone: "(416) 221-7788", date: "Apr 12", neighborhood: "Midtown",    grade: "B", service: "Polymeric Sanding" },
      { id: 5,  name: "Diana C.",   address: "19 Admiral Rd",    phone: "(416) 334-5566", date: "Apr 11", neighborhood: "The Annex",  grade: "C", service: "Deck Staining" },
      { id: 6,  name: "Neil F.",    address: "402 Spadina Ave",  phone: "(416) 887-2211", date: "Apr 10", neighborhood: "The Annex",  grade: "D", service: "Polymeric Sanding" },
      { id: 7,  name: "Rachel O.",  address: "77 Walmer Rd",     phone: "(416) 229-8833", date: "Apr 9",  neighborhood: "The Annex",  grade: "A", service: "Sealing" },
    ],
  },
  "Taylor M.": {
    lifetime: { sessions: 61, doors: 2876, answered: 1438, leads: 198, duration: "89h 14m" },
    monthly: [
      { month: "Feb", doors: 712, leads: 48 },
      { month: "Mar", doors: 891, leads: 67 },
      { month: "Apr", doors: 543, leads: 35 },
    ],
    recentSessions: [
      { date: "Apr 14", neighborhood: "The Annex",  doors: 31, answered: 14, leads: 2, duration: "58m" },
      { date: "Apr 13", neighborhood: "Leaside",    doors: 39, answered: 19, leads: 3, duration: "1h 08m" },
      { date: "Apr 12", neighborhood: "Davisville", doors: 44, answered: 22, leads: 2, duration: "1h 19m" },
    ],
    leads: [
      { id: 8,  name: "Ahmed F.",  address: "401 Dupont St",  phone: "(416) 992-4411", date: "Apr 14", neighborhood: "The Annex",  grade: "B", service: "Polymeric Sanding" },
      { id: 9,  name: "Lisa R.",   address: "72 Glebe Rd",    phone: "(416) 667-2233", date: "Apr 13", neighborhood: "Leaside",    grade: "A", service: "Deck Staining" },
      { id: 10, name: "Tom B.",    address: "118 Manor Rd",   phone: "(416) 445-9900", date: "Apr 12", neighborhood: "Davisville", grade: "C", service: "Polymeric Sanding" },
      { id: 11, name: "Grace H.",  address: "85 Millwood Rd", phone: "(416) 552-6677", date: "Apr 11", neighborhood: "Leaside",    grade: "B", service: "Sealing" },
      { id: 12, name: "Yusuf A.",  address: "200 Laird Dr",   phone: "(416) 331-2244", date: "Apr 10", neighborhood: "Leaside",    grade: "D", service: "Polymeric Sanding" },
    ],
  },
  "Casey R.": {
    lifetime: { sessions: 28, doors: 1102, answered: 529, leads: 64, duration: "38h 55m" },
    monthly: [
      { month: "Mar", doors: 621, leads: 38 },
      { month: "Apr", doors: 481, leads: 26 },
    ],
    recentSessions: [
      { date: "Apr 14", neighborhood: "York", doors: 36, answered: 17, leads: 2, duration: "1h 02m" },
      { date: "Apr 13", neighborhood: "York", doors: 41, answered: 20, leads: 1, duration: "1h 14m" },
    ],
    leads: [
      { id: 13, name: "Nadia P.", address: "89 Wychwood Ave", phone: "(416) 553-8821", date: "Apr 14", neighborhood: "York", grade: "B", service: "Sealing" },
      { id: 14, name: "Rob S.",   address: "44 Dufferin St",  phone: "(416) 229-7765", date: "Apr 13", neighborhood: "York", grade: "C", service: "Polymeric Sanding" },
      { id: 15, name: "Iman K.",  address: "310 Keele St",    phone: "(416) 771-0098", date: "Apr 12", neighborhood: "York", grade: "A", service: "Deck Staining" },
    ],
  },
};

function formatDuration(s) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function KnockrApp() {
  const [screen, setScreen] = useState("login"); // login | rep | summary | manager
  const [user,   setUser]   = useState(null);
  const [houses, setHouses] = useState(generateHouses);
  const [session,setSession]= useState(null);
  const [elapsed,setElapsed]= useState(0);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [gpsDot, setGpsDot] = useState({ x: 50, y: 50 });
  const [loginError, setLoginError] = useState("");
  const [repTab, setRepTab] = useState("stats"); // knock | stats
  const timerRef = useRef(null);

  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => {
      setGpsDot(p => ({ x: Math.min(95,Math.max(5,p.x+(Math.random()-0.5)*3)), y: Math.min(95,Math.max(5,p.y+(Math.random()-0.5)*3)) }));
    }, 2000);
    return () => clearInterval(iv);
  }, [session]);

  useEffect(() => {
    if (session && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed(e => e+1), 1000);
    } else if (!session) {
      clearInterval(timerRef.current); timerRef.current = null; setElapsed(0);
    }
  }, [session]);

  const handleLogin = (email, password) => {
    const found = USERS.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found);
      setScreen(found.role === "manager" ? "manager" : "rep");
      setLoginError("");
    } else {
      setLoginError("Incorrect email or password.");
    }
  };

  const logout = () => { setUser(null); setSession(null); setScreen("login"); setRepTab("knock"); };

  const metrics = {
    knocked:      houses.filter(h => h.status !== "unvisited").length,
    answered:     houses.filter(h => h.status === "answered" || h.status === "lead").length,
    notInterested:houses.filter(h => h.status === "not_interested").length,
    noAnswer:     houses.filter(h => h.status === "no_answer").length,
    leads:        houses.filter(h => h.status === "lead").length,
  };

  if (screen === "login")   return <LoginScreen onLogin={handleLogin} error={loginError} />;
  if (screen === "manager") return <AdminDashboard user={user} onLogout={logout} />;
  if (screen === "summary") return (
    <SummaryScreen metrics={metrics} elapsed={elapsed+3723} user={user}
      onDone={() => { setHouses(generateHouses()); setScreen("rep"); setRepTab("knock"); }}
      onLogout={logout} />
  );

  // Rep two-tab shell
  return (
    <div style={{ fontFamily:"'Courier New',monospace" }} className="min-h-screen bg-gray-950 flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{ background: user.color+"22", color: user.color, border:`1px solid ${user.color}44` }}>
            {user.avatar}
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">{user.name}</div>
            {session && <div className="text-cyan-300 text-xs font-mono">● {formatDuration(elapsed)}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <KnockrLogo size="sm"/>
          <button onClick={logout}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all"
            style={{borderColor:"#2a6a6a", color:"#6b9e9e", fontFamily:"'Courier New',monospace"}}>
            Logout
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-800 bg-gray-900">
        {[["stats","📊","My Stats"],["knock","🚪","Knock"]].map(([id,icon,label]) => (
          <button key={id} onClick={() => setRepTab(id)}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            style={repTab===id ? { color:user.color, borderBottom:`2px solid ${user.color}` } : { color:"#374151", borderBottom:"2px solid transparent" }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {repTab === "knock" && (
        <KnockTab
          user={user} houses={houses} session={session} gpsDot={gpsDot} metrics={metrics}
          selectedHouse={selectedHouse} onSelectHouse={setSelectedHouse}
          onStartSession={() => { setSession({ startTime: Date.now(), neighborhood:"Annex, Toronto" }); setHouses(generateHouses()); }}
          onEndSession={() => { setSession(null); setScreen("summary"); }}
          onUpdateHouse={(id, updates) => { setHouses(prev => prev.map(h => h.id===id ? {...h,...updates} : h)); setSelectedHouse(null); }}
        />
      )}
      {repTab === "stats" && <StatsTab user={user} />}
    </div>
  );
}

// ── Brand colour from logo ────────────────────────────────────────────────────
const BRAND      = "#2a7d8c";
const BRAND_DARK = "#1d5f6e";
const BRAND_TEXT = "#1a3a4a";

// ── Logo component ────────────────────────────────────────────────────────────
function KnockrLogo({ size = "md" }) {
  const iconSize = size === "lg" ? 56 : size === "md" ? 38 : 26;
  const textSize = size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      {/* Location pin with house — matches uploaded logo */}
      <svg width={iconSize} height={iconSize} viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 3C17.5 3 9 11.5 9 22c0 13.5 19 38 19 38s19-24.5 19-38C47 11.5 38.5 3 28 3z"
          fill="none" stroke={BRAND} strokeWidth="3" strokeLinejoin="round"/>
        <path d="M17 26l11-10 11 10" fill="none" stroke={BRAND} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round"/>
        <rect x="19" y="26" width="18" height="12" rx="0.5" fill="none" stroke={BRAND} strokeWidth="2.5"/>
        <rect x="24.5" y="30" width="7" height="8" rx="0.5" fill="none" stroke={BRAND} strokeWidth="2"/>
      </svg>
      <div>
        <div className={`font-black tracking-tight leading-none ${textSize}`}
          style={{ color: BRAND_TEXT, fontFamily:"'Helvetica Neue', Arial, sans-serif", letterSpacing:"-0.5px" }}>
          Knockr
        </div>
        {size === "lg" && (
          <div className="text-xs mt-0.5" style={{ color:"#6b9aaa", letterSpacing:"0.03em", fontFamily:"'Helvetica Neue', Arial, sans-serif" }}>
            Smart Canvassing. Local Sales Success.
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, error }) {
  const [email, setEmail] = useState("");
  const [pw,    setPw]    = useState("");
  return (
    <div style={{ fontFamily:"'Courier New', monospace" }} className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div className="text-5xl font-black tracking-tighter mb-1" style={{ color:"#00e5ff", letterSpacing:"-2px" }}>KNOCKR</div>
        <div className="text-gray-500 text-xs tracking-widest uppercase">Field Sales Tracker</div>
      </div>
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <label className="block text-gray-400 text-xs tracking-widest uppercase mb-2">Email</label>
            <input className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="you@knockr.io" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin(email,pw)}/>
          </div>
          <div className="mb-6">
            <label className="block text-gray-400 text-xs tracking-widest uppercase mb-2">Password</label>
            <input type="password" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onLogin(email,pw)}/>
          </div>
          {error && <div className="mb-4 text-red-400 text-xs text-center">{error}</div>}
          <button onClick={()=>onLogin(email,pw)}
            className="w-full py-3 rounded-lg text-sm font-bold tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
            style={{ background:"linear-gradient(135deg,#00e5ff,#0070ff)", color:"#000" }}>
            Sign In
          </button>
        </div>
        <div className="mt-5 text-center text-gray-700 text-xs space-y-0.5">
          <div>jordan@knockr.io · jordan123</div>
          <div>admin@knockr.io · admin</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOCK TAB
// ══════════════════════════════════════════════════════════════════════════════
function KnockTab({ user, houses, session, gpsDot, metrics, selectedHouse, onSelectHouse, onStartSession, onEndSession, onUpdateHouse }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Map */}
      <div className="relative flex-1 overflow-hidden" style={{ background:"#0d1117", minHeight:340 }}>
        {[{ name:"Elm Street",y:20},{name:"Oak Avenue",y:40},{name:"Maple Drive",y:60},{name:"Cedar Blvd",y:80}].map(s => (
          <div key={s.name} className="absolute w-full" style={{ top:`${s.y}%`, transform:"translateY(-50%)" }}>
            <div className="absolute w-full h-px" style={{ background:"rgba(255,255,255,0.06)" }}/>
            <span className="absolute text-gray-700 ml-1" style={{ fontSize:9, top:-10 }}>{s.name}</span>
          </div>
        ))}
        {[20,40,60,80].map(x => <div key={x} className="absolute h-full w-px" style={{ left:`${x}%`, background:"rgba(255,255,255,0.03)" }}/>)}

        {houses.map(house => {
          const cfg = STATUS_CONFIG[house.status];
          return (
            <button key={house.id} onClick={()=>session&&onSelectHouse(house)}
              className="absolute flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
              style={{ left:`${house.x}%`, top:`${house.y}%`, transform:"translate(-50%,-50%)", cursor:session?"pointer":"default", zIndex:10 }}>
              <div className="rounded-sm flex items-center justify-center font-bold shadow-lg"
                style={{ width:22, height:22, background:cfg.color, color:house.status==="unvisited"?"#666":"#000", fontSize:10,
                  border:selectedHouse?.id===house.id?"2px solid white":"2px solid transparent",
                  boxShadow:house.status!=="unvisited"?`0 0 8px ${cfg.color}88`:"none" }}>
                {cfg.icon}
              </div>
            </button>
          );
        })}

        {session && (
          <div className="absolute z-20" style={{ left:`${gpsDot.x}%`, top:`${gpsDot.y}%`, transform:"translate(-50%,-50%)" }}>
            <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white" style={{ boxShadow:"0 0 12px #00e5ff" }}/>
            <div className="absolute inset-0 w-4 h-4 rounded-full bg-cyan-400 opacity-30 animate-ping"/>
          </div>
        )}

        {!session && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background:"rgba(0,0,0,0.5)" }}>
            <div className="text-center">
              <div className="text-gray-300 text-base font-bold mb-1">Ready to knock?</div>
              <div className="text-gray-600 text-xs">Hit Start Session below</div>
            </div>
          </div>
        )}
      </div>

      {/* Live stats */}
      {session && (
        <div className="grid grid-cols-4 bg-gray-900 border-t border-gray-800 text-center text-xs py-2">
          {[["Knocked",metrics.knocked,"text-white"],["Answered",metrics.answered,"text-green-400"],["Leads",metrics.leads,"text-blue-400"],["No Ans.",metrics.noAnswer,"text-amber-400"]].map(([l,v,c])=>(
            <div key={l}><div className={`font-bold text-lg ${c}`}>{v}</div><div className="text-gray-500">{l}</div></div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2 bg-gray-900 border-t border-gray-800">
        {Object.entries(STATUS_CONFIG).map(([key,cfg]) => (
          <div key={key} className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-sm" style={{ background:cfg.color }}/>{cfg.label}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        {!session ? (
          <button onClick={onStartSession} className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
            style={{ background:"linear-gradient(135deg,#00e5ff,#0070ff)", color:"#000" }}>
            ▶ START SESSION
          </button>
        ) : (
          <button onClick={onEndSession} className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase border border-red-600 text-red-400 hover:bg-red-900 transition-all active:scale-95">
            ■ END SESSION
          </button>
        )}
      </div>

      {selectedHouse && <HouseModal house={selectedHouse} onUpdate={onUpdateHouse} onClose={()=>onSelectHouse(null)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOUSE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function HouseModal({ house, onUpdate, onClose }) {
  const [status, setStatus] = useState(house.status);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadInfo, setLeadInfo] = useState({ name:"", phone:"", email:"", service:"", grade:"", note:"" });

  const statusButtons = [
    { key:"no_answer",      label:"No Answer",      bg:"#78350f", text:"#f6ad55" },
    { key:"not_interested", label:"Not Interested", bg:"#7f1d1d", text:"#fc8181" },
    { key:"answered",       label:"Answered",       bg:"#14532d", text:"#68d391" },
    { key:"lead",           label:"Got a Lead! ★",  bg:"#1e3a5f", text:"#63b3ed" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="bg-gray-900 rounded-t-3xl p-6 max-h-screen overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-white font-bold text-lg">{house.number} {house.street}</div>
            <div className="text-gray-500 text-xs">Select an outcome</div>
          </div>
          <button onClick={onClose} className="text-gray-500 text-2xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {statusButtons.map(btn => (
            <button key={btn.key} onClick={() => { setStatus(btn.key); setShowLeadForm(btn.key==="lead"); }}
              className="py-3 rounded-xl text-sm font-bold transition-all border-2"
              style={{ background:btn.bg, color:btn.text, borderColor:status===btn.key?btn.text:"transparent" }}>
              {btn.label}
            </button>
          ))}
        </div>

        {showLeadForm && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-blue-900">
            <div className="text-blue-300 text-xs font-bold tracking-widest uppercase mb-3">Lead Info</div>
            {[{label:"Name",key:"name",ph:"Full name"},{label:"Phone",key:"phone",ph:"(416) 000-0000"},{label:"Email",key:"email",ph:"email@example.com"}].map(f => (
              <div key={f.key} className="mb-3">
                <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">{f.label}</label>
                <input className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder={f.ph} value={leadInfo[f.key]} onChange={e=>setLeadInfo({...leadInfo,[f.key]:e.target.value})}/>
              </div>
            ))}

            {/* Grade picker */}
            <div className="mb-3">
              <label className="block text-gray-400 text-xs mb-2 uppercase tracking-wider">Lead Grade</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(GRADES).map(([g,cfg])=>(
                  <button key={g} onClick={()=>setLeadInfo({...leadInfo,grade:g})}
                    className="py-2.5 rounded-xl font-black text-lg transition-all border-2"
                    style={leadInfo.grade===g
                      ? {background:cfg.bg, color:cfg.color, borderColor:cfg.color, boxShadow:`0 0 10px ${cfg.color}44`}
                      : {background:"#1f2937", color:"#4b5563", borderColor:"transparent"}}>
                    {g}
                  </button>
                ))}
              </div>
              {leadInfo.grade && (
                <div className="mt-1.5 text-xs" style={{color:GRADES[leadInfo.grade].color}}>
                  {leadInfo.grade === "A" && "Ready to move forward"}
                  {leadInfo.grade === "B" && "Interested, needs follow-up"}
                  {leadInfo.grade === "C" && "Lukewarm, worth a callback"}
                  {leadInfo.grade === "D" && "Low interest, low priority"}
                </div>
              )}
            </div>

            {/* Service picker */}
            <div className="mb-3">
              <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">Service</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SERVICES).map(([s,cfg]) => (
                  <button key={s} onClick={()=>setLeadInfo({...leadInfo,service:s})}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                    style={leadInfo.service===s?{background:cfg.bg,color:cfg.color,borderColor:cfg.color}:{color:"#4b5563",borderColor:"#374151"}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">Note</label>
              <textarea className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                rows={2} placeholder="Any details..." value={leadInfo.note} onChange={e=>setLeadInfo({...leadInfo,note:e.target.value})}/>
            </div>
          </div>
        )}

        <button onClick={()=>onUpdate(house.id,{status,leadInfo:status==="lead"?leadInfo:null})}
          disabled={status==="unvisited"}
          className="w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
          style={{ background:"linear-gradient(135deg,#00e5ff,#0070ff)", color:"#000" }}>
          LOG OUTCOME
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS TAB — only this rep's data
// ══════════════════════════════════════════════════════════════════════════════
function StatsTab({ user }) {
  const data = REP_DATA[user.name];
  if (!data) return <div className="p-6 text-gray-500 text-sm">No stats available.</div>;

  const { lifetime, monthly, recentSessions, leads } = data;
  const respRate    = Math.round((lifetime.answered / lifetime.doors) * 100);
  const leadRate    = Math.round((lifetime.leads    / lifetime.answered) * 100);
  const dpl         = Math.round(lifetime.doors / lifetime.leads);
  const maxDoors    = Math.max(...monthly.map(m => m.doors));
  const gradeCounts = Object.fromEntries(Object.keys(GRADES).map(g => [g, leads.filter(l => l.grade===g).length]));
  const [section, setSection] = useState("overview"); // overview | leads | sessions

  return (
    <div className="flex-1 overflow-y-auto pb-12">
      {/* Sub-nav */}
      <div className="flex gap-1 p-3 bg-gray-900 border-b border-gray-800">
        {[["overview","Overview"],["leads","My Leads"],["sessions","Sessions"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSection(k)}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={section===k?{background:user.color+"22",color:user.color}:{color:"#4b5563"}}>
            {l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* ── OVERVIEW ── */}
        {section === "overview" && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Doors Knocked", lifetime.doors.toLocaleString(), "#e5e7eb",   "All time"],
                ["Total Leads",   lifetime.leads,                  user.color,  "All time"],
                ["Response Rate", `${respRate}%`,                  "#34d399",   "Answered ÷ knocked"],
                ["Lead Conv.",    `${leadRate}%`,                  "#f97316",   "Leads ÷ answered"],
                ["Doors / Lead",  dpl,                             "#fbbf24",   "Efficiency ratio"],
                ["Hours in Field",lifetime.duration,               "#a78bfa",   `${lifetime.sessions} sessions`],
              ].map(([label,value,color,sub])=>(
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-gray-500 text-xs tracking-widest uppercase mb-1">{label}</div>
                  <div className="font-black text-2xl" style={{color,fontFamily:"monospace"}}>{value}</div>
                  <div className="text-gray-600 text-xs mt-1">{sub}</div>
                </div>
              ))}
            </div>

            {/* Monthly bars */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="text-white font-bold text-sm mb-4">Monthly Activity</div>
              <div className="space-y-3">
                {monthly.map(m => (
                  <div key={m.month}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-300 font-bold">{m.month} 2026</span>
                      <span className="text-gray-400">{m.doors} doors · <span style={{color:user.color}} className="font-bold">{m.leads} leads</span></span>
                    </div>
                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${(m.doors/maxDoors)*100}%`,background:`linear-gradient(90deg,${user.color}88,${user.color})`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grade breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <span className="text-white font-bold text-sm">Lead Grade Breakdown</span>
              </div>
              {Object.entries(GRADES).map(([g,cfg],i,arr)=>{
                const count=gradeCounts[g];
                const pct=leads.length>0?Math.round((count/leads.length)*100):0;
                return(
                  <div key={g} className={`px-5 py-3.5 flex items-center gap-4 ${i<arr.length-1?"border-b border-gray-800":""}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                      style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}44`}}>{g}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-300">{cfg.desc}</span>
                        <span className="font-bold" style={{color:cfg.color}}>{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${leads.length>0?(count/leads.length)*100:0}%`,background:cfg.color}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Service breakdown */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <span className="text-white font-bold text-sm">Service Breakdown</span>
              </div>
              {Object.entries(SERVICES).map(([s,cfg],i,arr)=>{
                const serviceLeads=leads.filter(l=>l.service===s);
                const count=serviceLeads.length;
                const pct=leads.length>0?Math.round((count/leads.length)*100):0;
                return(
                  <div key={s} className={`px-5 py-4 ${i<arr.length-1?"border-b border-gray-800":""}`}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}44`}}>
                        {s==="Polymeric Sanding"?"⬡":s==="Sealing"?"◈":"◎"}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-300 font-medium">{s}</span>
                          <span className="font-bold" style={{color:cfg.color}}>{count} leads · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${leads.length>0?(count/leads.length)*100:0}%`,background:cfg.color}}/>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 ml-13">
                      {Object.entries(GRADES).map(([g,gcfg])=>{
                        const gc=serviceLeads.filter(l=>l.grade===g).length;
                        const gp=count>0?Math.round((gc/count)*100):0;
                        return(
                          <div key={g} className="rounded-lg p-2 text-center" style={{background:gcfg.bg+"88",border:`1px solid ${gcfg.color}22`}}>
                            <div className="font-black text-base" style={{color:gcfg.color,fontFamily:"monospace"}}>{gc}</div>
                            <div className="text-xs font-bold" style={{color:gcfg.color}}>Grade {g}</div>
                            <div className="text-gray-600 text-xs mt-0.5">{gp}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── MY LEADS ── */}
        {section === "leads" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
              <span className="text-white font-bold text-sm">My Leads</span>
              <span className="text-gray-500 text-xs">{leads.length} total</span>
            </div>
            <div className="divide-y divide-gray-800">
              {leads.map(lead => {
                const gcfg = GRADES[lead.grade];
                const scfg = SERVICES[lead.service];
                return(
                  <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                      style={{background:gcfg.bg,color:gcfg.color,border:`1px solid ${gcfg.color}44`}}>{lead.grade}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-white font-bold text-sm">{lead.name}</span>
                        {scfg && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold"
                          style={{background:scfg.bg,color:scfg.color,border:`1px solid ${scfg.color}33`}}>{lead.service}</span>}
                      </div>
                      <div className="text-gray-400 text-xs">{lead.address}</div>
                      <div className="text-gray-500 text-xs">{lead.phone} · {lead.neighborhood}</div>
                    </div>
                    <div className="text-gray-600 text-xs flex-shrink-0 pt-0.5">{lead.date}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {section === "sessions" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <span className="text-white font-bold text-sm">Recent Sessions</span>
            </div>
            <div className="divide-y divide-gray-800">
              {recentSessions.map((s,i)=>{
                const sr=Math.round((s.answered/s.doors)*100);
                const lr=s.leads>0?Math.round((s.leads/s.answered)*100):0;
                return(
                  <div key={i} className="px-5 py-4">
                    <div className="flex justify-between mb-3">
                      <div>
                        <div className="text-white font-bold text-sm">{s.neighborhood}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{s.date} · {s.duration}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg" style={{color:user.color}}>{s.leads}</div>
                        <div className="text-gray-600 text-xs">leads</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[["Knocked",s.doors,"#e5e7eb"],["Response",`${sr}%`,"#34d399"],["Lead Rate",`${lr}%`,"#fb923c"]].map(([l,v,c])=>(
                        <div key={l} className="bg-gray-800 rounded-lg p-2 text-center">
                          <div className="font-bold" style={{color:c}}>{v}</div>
                          <div className="text-gray-600">{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SummaryScreen({ metrics, elapsed, user, onDone, onLogout }) {
  const answerRate = metrics.knocked>0 ? Math.round((metrics.answered/metrics.knocked)*100) : 0;
  const leadRate   = metrics.answered>0 ? Math.round((metrics.leads/metrics.answered)*100) : 0;
  const rows = [
    ["Doors Knocked",   metrics.knocked,       "text-white"],
    ["Doors Answered",  metrics.answered,      "text-green-400"],
    ["Not Interested",  metrics.notInterested, "text-red-400"],
    ["No Answer",       metrics.noAnswer,      "text-amber-400"],
    ["Leads Captured",  metrics.leads,         "text-blue-400"],
    ["Answer Rate",     `${answerRate}%`,      "text-green-300"],
    ["Lead Conversion", `${leadRate}%`,        "text-blue-300"],
    ["Duration",        formatDuration(elapsed),"text-cyan-300"],
  ];
  return (
    <div style={{ fontFamily:"'Courier New',monospace" }} className="min-h-screen bg-gray-950 flex flex-col text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-cyan-400 font-black text-2xl tracking-tighter">SESSION COMPLETE</div>
          <div className="text-gray-500 text-xs mt-1">{user?.name} · Annex, Toronto</div>
        </div>
        <button onClick={onLogout} className="text-gray-600 hover:text-gray-400 text-xs">Logout</button>
      </div>
      <div className="text-center mb-8 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-7xl font-black" style={{ color:user?.color||"#00e5ff" }}>{metrics.leads}</div>
        <div className="text-gray-400 text-sm tracking-widest uppercase mt-1">Leads This Session</div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        {rows.map(([label,value,color],i)=>(
          <div key={label} className={`flex justify-between items-center px-5 py-3 ${i<rows.length-1?"border-b border-gray-800":""}`}>
            <span className="text-gray-400 text-sm">{label}</span>
            <span className={`font-bold text-sm ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      <button onClick={onDone} className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
        style={{ background:"linear-gradient(135deg,#00e5ff,#0070ff)", color:"#000" }}>
        BACK TO APP
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DATA
// ══════════════════════════════════════════════════════════════════════════════
const NEIGHBORHOODS = [
  { id:"annex",      name:"The Annex",     responseRate:68, leadRate:22, sessions:14, doors:312 },
  { id:"midtown",    name:"Midtown",        responseRate:54, leadRate:14, sessions:9,  doors:198 },
  { id:"rosedale",   name:"Rosedale",       responseRate:41, leadRate:31, sessions:6,  doors:124 },
  { id:"foresthill", name:"Forest Hill",    responseRate:38, leadRate:28, sessions:5,  doors:108 },
  { id:"yorkdale",   name:"Yorkdale",       responseRate:71, leadRate:18, sessions:11, doors:247 },
  { id:"leaside",    name:"Leaside",        responseRate:62, leadRate:20, sessions:8,  doors:176 },
  { id:"eastyork",   name:"East York",      responseRate:49, leadRate:12, sessions:7,  doors:163 },
  { id:"downsview",  name:"Downsview",      responseRate:33, leadRate:8,  sessions:4,  doors:89  },
  { id:"weston",     name:"Weston",         responseRate:44, leadRate:11, sessions:5,  doors:112 },
  { id:"york",       name:"York",           responseRate:57, leadRate:16, sessions:10, doors:218 },
  { id:"eglinton",   name:"Eglinton West",  responseRate:60, leadRate:19, sessions:8,  doors:187 },
  { id:"davisville", name:"Davisville",     responseRate:65, leadRate:24, sessions:12, doors:276 },
];

const HOOD_PATHS = {
  yorkdale:   "M 155,20  L 205,20  L 218,55  L 192,72  L 155,68  Z",
  downsview:  "M 80,15   L 152,15  L 155,68  L 118,75  L 80,60   Z",
  weston:     "M 48,62   L 118,75  L 118,108 L 68,115  L 48,92   Z",
  york:       "M 118,75  L 192,72  L 210,115 L 155,122 L 118,108 Z",
  eglinton:   "M 118,108 L 210,115 L 218,158 L 148,162 L 118,142 Z",
  foresthill: "M 210,115 L 270,108 L 285,152 L 218,158 Z",
  annex:      "M 270,108 L 332,102 L 345,155 L 285,152 Z",
  davisville: "M 332,102 L 398,98  L 412,158 L 345,155 Z",
  midtown:    "M 285,152 L 412,158 L 418,210 L 290,215 Z",
  leaside:    "M 398,98  L 458,95  L 472,155 L 412,158 Z",
  rosedale:   "M 345,155 L 412,158 L 418,210 L 355,215 Z",
  eastyork:   "M 412,158 L 472,155 L 480,218 L 418,210 Z",
};

function getCentroid(d) {
  const coords = [...d.matchAll(/[\d.]+,[\d.]+/g)].map(m => m[0].split(",").map(Number));
  if (!coords.length) return [0,0];
  return [coords.reduce((s,c)=>s+c[0],0)/coords.length, coords.reduce((s,c)=>s+c[1],0)/coords.length];
}

function responseColor(r){ const t=r/100; return `rgb(${10},${Math.round(60+t*160)},${Math.round(90+t*110)})`; }
function leadColor(r){ const t=Math.min(r/35,1); return `rgb(${Math.round(30+t*215)},${Math.round(25+t*105)},10)`; }

const ALL_LEADS = [
  { id:1,  rep:"Jordan K.", name:"Sandra T.",  address:"88 Bloor St W",    phone:"(416) 882-1234", date:"Apr 14", neighborhood:"The Annex",  grade:"A", service:"Polymeric Sanding" },
  { id:2,  rep:"Jordan K.", name:"Marcus L.",  address:"14 Bernard Ave",   phone:"(416) 553-9901", date:"Apr 14", neighborhood:"The Annex",  grade:"B", service:"Polymeric Sanding" },
  { id:3,  rep:"Jordan K.", name:"Priya M.",   address:"231 Davenport Rd", phone:"(416) 771-3345", date:"Apr 13", neighborhood:"Davisville", grade:"A", service:"Sealing" },
  { id:4,  rep:"Jordan K.", name:"Kevin W.",   address:"55 Rosehill Ave",  phone:"(416) 221-7788", date:"Apr 12", neighborhood:"Midtown",    grade:"B", service:"Polymeric Sanding" },
  { id:5,  rep:"Jordan K.", name:"Diana C.",   address:"19 Admiral Rd",    phone:"(416) 334-5566", date:"Apr 11", neighborhood:"The Annex",  grade:"C", service:"Deck Staining" },
  { id:6,  rep:"Jordan K.", name:"Neil F.",    address:"402 Spadina Ave",  phone:"(416) 887-2211", date:"Apr 10", neighborhood:"The Annex",  grade:"D", service:"Polymeric Sanding" },
  { id:7,  rep:"Jordan K.", name:"Rachel O.",  address:"77 Walmer Rd",     phone:"(416) 229-8833", date:"Apr 9",  neighborhood:"The Annex",  grade:"A", service:"Sealing" },
  { id:8,  rep:"Taylor M.", name:"Ahmed F.",   address:"401 Dupont St",    phone:"(416) 992-4411", date:"Apr 14", neighborhood:"The Annex",  grade:"B", service:"Polymeric Sanding" },
  { id:9,  rep:"Taylor M.", name:"Lisa R.",    address:"72 Glebe Rd",      phone:"(416) 667-2233", date:"Apr 13", neighborhood:"Leaside",    grade:"A", service:"Deck Staining" },
  { id:10, rep:"Taylor M.", name:"Tom B.",     address:"118 Manor Rd",     phone:"(416) 445-9900", date:"Apr 12", neighborhood:"Davisville", grade:"C", service:"Polymeric Sanding" },
  { id:11, rep:"Taylor M.", name:"Grace H.",   address:"85 Millwood Rd",   phone:"(416) 552-6677", date:"Apr 11", neighborhood:"Leaside",    grade:"B", service:"Sealing" },
  { id:12, rep:"Taylor M.", name:"Yusuf A.",   address:"200 Laird Dr",     phone:"(416) 331-2244", date:"Apr 10", neighborhood:"Leaside",    grade:"D", service:"Polymeric Sanding" },
  { id:13, rep:"Casey R.",  name:"Nadia P.",   address:"89 Wychwood Ave",  phone:"(416) 553-8821", date:"Apr 14", neighborhood:"York",       grade:"B", service:"Sealing" },
  { id:14, rep:"Casey R.",  name:"Rob S.",     address:"44 Dufferin St",   phone:"(416) 229-7765", date:"Apr 13", neighborhood:"York",       grade:"C", service:"Polymeric Sanding" },
  { id:15, rep:"Casey R.",  name:"Iman K.",    address:"310 Keele St",     phone:"(416) 771-0098", date:"Apr 12", neighborhood:"York",       grade:"A", service:"Deck Staining" },
];

const ADMIN_REPS = [
  {
    id:1, name:"Jordan K.", avatar:"JK", color:"#00e5ff", joinDate:"Jan 2026",
    lifetime:{ sessions:89, doors:4231, answered:2318, leads:312, duration:"134h 22m" },
    monthly:[{month:"Jan",doors:980,leads:71},{month:"Feb",doors:1120,leads:89},{month:"Mar",doors:1340,leads:104},{month:"Apr",doors:791,leads:48}],
    sessions:[
      {date:"Apr 14",neighborhood:"The Annex",  doors:47,answered:31,leads:4,duration:"1h 22m"},
      {date:"Apr 13",neighborhood:"Davisville", doors:52,answered:34,leads:6,duration:"1h 41m"},
      {date:"Apr 12",neighborhood:"Midtown",    doors:38,answered:21,leads:3,duration:"1h 08m"},
    ],
  },
  {
    id:2, name:"Taylor M.", avatar:"TM", color:"#f472b6", joinDate:"Feb 2026",
    lifetime:{ sessions:61, doors:2876, answered:1438, leads:198, duration:"89h 14m" },
    monthly:[{month:"Feb",doors:712,leads:48},{month:"Mar",doors:891,leads:67},{month:"Apr",doors:543,leads:35}],
    sessions:[
      {date:"Apr 14",neighborhood:"The Annex",  doors:31,answered:14,leads:2,duration:"58m"},
      {date:"Apr 13",neighborhood:"Leaside",    doors:39,answered:19,leads:3,duration:"1h 08m"},
      {date:"Apr 12",neighborhood:"Davisville", doors:44,answered:22,leads:4,duration:"1h 19m"},
    ],
  },
  {
    id:3, name:"Casey R.", avatar:"CR", color:"#34d399", joinDate:"Mar 2026",
    lifetime:{ sessions:28, doors:1102, answered:529, leads:64, duration:"38h 55m" },
    monthly:[{month:"Mar",doors:621,leads:38},{month:"Apr",doors:481,leads:26}],
    sessions:[
      {date:"Apr 14",neighborhood:"York",doors:36,answered:17,leads:2,duration:"1h 02m"},
      {date:"Apr 13",neighborhood:"York",doors:41,answered:20,leads:3,duration:"1h 14m"},
    ],
  },
];

// ── shared admin atoms ────────────────────────────────────────────────────────
function KPI({label,value,sub,color="#00e5ff"}){
  return(
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-500 text-xs tracking-widest uppercase mb-1">{label}</div>
      <div className="font-black text-2xl" style={{color,fontFamily:"monospace"}}>{value}</div>
      {sub&&<div className="text-gray-600 text-xs mt-1">{sub}</div>}
    </div>
  );
}
function AdminGradeBadge({grade}){
  const g=GRADES[grade];
  return <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0" style={{background:g.bg,color:g.color,border:`1px solid ${g.color}44`}}>{g.label||grade}</div>;
}
function Bar({value,max,color}){
  return(
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{width:`${Math.min(100,(value/max)*100)}%`,background:color}}/>
    </div>
  );
}
function ServiceTag({service}){
  const cfg=SERVICES[service]; if(!cfg) return null;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}33`}}>{service}</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("heatmap");
  const aLeads = ALL_LEADS.filter(l=>l.grade==="A").length;
  const tabs = [
    {id:"heatmap",icon:"⬡",label:"Heatmap"},
    {id:"leads",  icon:"★",label:"Leads"  },
    {id:"totals", icon:"◈",label:"Totals" },
    {id:"reps",   icon:"◎",label:"Reps"   },
    {id:"team",   icon:"＋",label:"Team"   },
  ];

  return (
    <div style={{fontFamily:"'Courier New',monospace",background:"#080c12"}} className="min-h-screen text-white">
      <div className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KnockrLogo size="sm"/>
          <span className="h-4 w-px bg-gray-700"/>
          <span className="text-gray-500 text-xs uppercase tracking-widest" style={{fontFamily:"'Courier New',monospace"}}>Admin</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600">{ALL_LEADS.length} leads</span>
          <span className="text-green-400 font-bold">{aLeads} Grade A</span>
          <span className="flex items-center gap-1 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse"/>3 active</span>
          <button onClick={onLogout} className="ml-1 text-gray-600 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded-lg transition-colors">Logout</button>
        </div>
      </div>
      <div className="flex border-b border-gray-800 bg-gray-950 sticky top-12 z-30 overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all whitespace-nowrap px-2"
            style={tab===t.id?{color:"#00e5ff",borderBottom:"2px solid #00e5ff"}:{color:"#374151",borderBottom:"2px solid transparent"}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-12">
        {tab==="heatmap"&&<HeatmapTab/>}
        {tab==="leads"  &&<LeadsTab/>}
        {tab==="totals" &&<TotalsTab/>}
        {tab==="reps"   &&<AdminRepsTab/>}
        {tab==="team"   &&<TeamTab/>}
      </div>
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
const REP_COLORS = ["#00e5ff","#f472b6","#34d399","#a78bfa","#fb923c","#f87171","#fbbf24","#60a5fa"];

function TeamTab(){
  const [reps, setReps] = useState([
    { id:1, name:"Jordan K.", email:"jordan@knockr.io", password:"jordan123", color:"#00e5ff", joinDate:"Jan 2026", status:"active" },
    { id:2, name:"Taylor M.", email:"taylor@knockr.io", password:"taylor123", color:"#f472b6", joinDate:"Feb 2026", status:"active" },
    { id:3, name:"Casey R.",  email:"casey@knockr.io",  password:"casey123",  color:"#34d399", joinDate:"Mar 2026", status:"active" },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", color:REP_COLORS[3] });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = "Name is required";
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.password.length < 6)  e.password = "Min 6 characters";
    if (reps.find(r => r.email === form.email)) e.email = "Email already exists";
    return e;
  };

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const initials = form.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newRep = {
      id: Date.now(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      color: form.color,
      initials,
      joinDate: new Date().toLocaleDateString("en-US",{month:"short",year:"numeric"}),
      status: "active",
    };
    setReps(prev => [...prev, newRep]);
    setForm({ name:"", email:"", password:"", color:REP_COLORS[reps.length % REP_COLORS.length] });
    setErrors({});
    setShowForm(false);
    setSuccessMsg(`${newRep.name} has been added to the team.`);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const toggleStatus = (id) => {
    setReps(prev => prev.map(r => r.id===id ? {...r, status: r.status==="active"?"inactive":"active"} : r));
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">Team Management</div>
          <div className="text-gray-500 text-xs mt-0.5">{reps.filter(r=>r.status==="active").length} active · {reps.length} total</div>
        </div>
        <button onClick={()=>{setShowForm(true);setErrors({});}}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-95"
          style={{background:"linear-gradient(135deg,#00e5ff,#0070ff)",color:"#000"}}>
          ＋ Add Rep
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-3 text-green-300 text-sm flex items-center gap-2">
          <span>✓</span>{successMsg}
        </div>
      )}

      {/* New rep form */}
      {showForm && (
        <div className="bg-gray-900 border border-cyan-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-white font-bold text-sm">New Rep Profile</div>
            <button onClick={()=>setShowForm(false)} className="text-gray-500 hover:text-white text-lg leading-none transition-colors">×</button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Full Name</label>
            <input className="w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
              style={{borderColor:errors.name?"#f87171":"#374151"}}
              placeholder="e.g. Alex Johnson"
              value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
            {errors.name && <div className="text-red-400 text-xs mt-1">{errors.name}</div>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Email</label>
            <input className="w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
              style={{borderColor:errors.email?"#f87171":"#374151"}}
              placeholder="alex@knockr.io"
              value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
            {errors.email && <div className="text-red-400 text-xs mt-1">{errors.email}</div>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw?"text":"password"}
                className="w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors pr-12"
                style={{borderColor:errors.password?"#f87171":"#374151"}}
                placeholder="Min 6 characters"
                value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
              <button onClick={()=>setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors">
                {showPw?"Hide":"Show"}
              </button>
            </div>
            {errors.password && <div className="text-red-400 text-xs mt-1">{errors.password}</div>}
          </div>

          {/* Colour picker */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Profile Colour</label>
            <div className="flex gap-2 flex-wrap">
              {REP_COLORS.map(c=>(
                <button key={c} onClick={()=>setForm({...form,color:c})}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{background:c, border: form.color===c?"2px solid white":"2px solid transparent", boxShadow:form.color===c?`0 0 8px ${c}`:"none"}}/>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
              style={{background:form.color+"22",color:form.color,border:`1px solid ${form.color}44`}}>
              {form.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"??"}
            </div>
            <div>
              <div className="text-white text-sm font-bold">{form.name||"Rep Name"}</div>
              <div className="text-gray-500 text-xs">{form.email||"email@knockr.io"}</div>
            </div>
          </div>

          <button onClick={handleCreate}
            className="w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
            style={{background:"linear-gradient(135deg,#00e5ff,#0070ff)",color:"#000"}}>
            Create Rep Profile
          </button>
        </div>
      )}

      {/* Rep list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <span className="text-white font-bold text-sm">All Reps</span>
        </div>
        <div className="divide-y divide-gray-800">
          {reps.map(rep=>{
            const initials = rep.initials || rep.name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
            return(
              <div key={rep.id} className="px-5 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{background:rep.color+"22",color:rep.color,border:`1px solid ${rep.color}44`,opacity:rep.status==="inactive"?0.4:1}}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm">{rep.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={rep.status==="active"
                        ? {background:"#052e16",color:"#22c55e",border:"1px solid #166534"}
                        : {background:"#1f2937",color:"#6b7280",border:"1px solid #374151"}}>
                      {rep.status}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">{rep.email}</div>
                  <div className="text-gray-700 text-xs">Joined {rep.joinDate}</div>
                </div>
                <button onClick={()=>toggleStatus(rep.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold border transition-all hover:border-gray-500"
                  style={{borderColor:"#374151",color:"#6b7280"}}>
                  {rep.status==="active"?"Deactivate":"Activate"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeatmapTab(){
  const [mode,setMode]=useState("response");
  const [hov,setHov]=useState(null);
  const hoodData=Object.fromEntries(NEIGHBORHOODS.map(n=>[n.id,n]));
  const colorFn=mode==="response"?responseColor:leadColor;
  const metricKey=mode==="response"?"responseRate":"leadRate";
  return(
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div><div className="text-white font-bold">Neighbourhood Heatmap</div><div className="text-gray-500 text-xs mt-0.5">Toronto · Apr 1–15, 2026</div></div>
          <div className="flex gap-2">
            {[["response","Response %","#60a5fa","#0070ff"],["lead","Lead %","#fb923c","#f97316"]].map(([m,l,c,b])=>(
              <button key={m} onClick={()=>setMode(m)} className="text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all"
                style={mode===m?{background:b+"22",color:c,border:`1px solid ${b}`}:{color:"#4b5563",border:"1px solid #374151"}}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row">
          <div className="relative flex-1 p-3" style={{background:"#0a0f1a",minHeight:260}}>
            <svg viewBox="0 0 540 238" className="w-full" style={{maxHeight:290}}>
              {[0,1,2,3,4].map(i=><line key={`h${i}`} x1="0" y1={i*60} x2="540" y2={i*60} stroke="#ffffff07" strokeWidth="0.5"/>)}
              {[0,1,2,3,4,5,6,7,8,9].map(i=><line key={`v${i}`} x1={i*60} y1="0" x2={i*60} y2="238" stroke="#ffffff07" strokeWidth="0.5"/>)}
              {Object.entries(HOOD_PATHS).map(([id,d])=>{
                const data=hoodData[id]; if(!data)return null;
                const val=data[metricKey]; const fill=colorFn(val); const isHov=hov===id;
                const[cx,cy]=getCentroid(d);
                return(
                  <g key={id} onMouseEnter={()=>setHov(id)} onMouseLeave={()=>setHov(null)} style={{cursor:"pointer"}}>
                    <path d={d} fill={fill} fillOpacity={isHov?1:0.85} stroke={isHov?"#fff":"#060a14"} strokeWidth={isHov?1.5:0.8}
                      style={{filter:isHov?`drop-shadow(0 0 6px ${fill})`:"none",transition:"all 0.12s"}}/>
                    <text x={cx} y={cy-2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.95)" fontSize="8" fontWeight="700" style={{pointerEvents:"none",fontFamily:"monospace"}}>{data[metricKey]}%</text>
                    <text x={cx} y={cy+9} textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="5.5" style={{pointerEvents:"none"}}>{data.name.split(" ")[0]}</text>
                  </g>
                );
              })}
            </svg>
            {hov&&hoodData[hov]&&(
              <div className="absolute top-3 left-3 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl text-xs" style={{minWidth:160,zIndex:10}}>
                <div className="text-white font-bold mb-2">{hoodData[hov].name}</div>
                {[["Response Rate",hoodData[hov].responseRate+"%","#34d399"],["Lead Rate",hoodData[hov].leadRate+"%","#fb923c"],["Sessions",hoodData[hov].sessions,"#e5e7eb"],["Doors",hoodData[hov].doors,"#9ca3af"]].map(([l,v,c])=>(
                  <div key={l} className="flex justify-between gap-3 mb-1"><span className="text-gray-500">{l}</span><span className="font-bold" style={{color:c}}>{v}</span></div>
                ))}
              </div>
            )}
          </div>
          <div className="flex lg:flex-col gap-5 p-5 border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-950 justify-around lg:justify-start">
            <div>
              <div className="text-xs text-cyan-400 font-bold tracking-widest uppercase mb-3">Response Rate</div>
              {[[80,"70%+"],[60,"60–70%"],[40,"40–60%"],[20,"20–40%"],[5,"< 20%"]].map(([v,l])=>(
                <div key={v} className="flex items-center gap-2 mb-1.5"><div className="w-5 h-3.5 rounded-sm flex-shrink-0" style={{background:responseColor(v)}}/><span className="text-gray-400 text-xs">{l}</span></div>
              ))}
            </div>
            <div className="hidden lg:block h-px bg-gray-800"/>
            <div>
              <div className="text-xs text-orange-400 font-bold tracking-widest uppercase mb-3">Lead Rate</div>
              {[[35,"30%+"],[25,"20–30%"],[15,"10–20%"],[8,"5–10%"],[2,"< 5%"]].map(([v,l])=>(
                <div key={v} className="flex items-center gap-2 mb-1.5"><div className="w-5 h-3.5 rounded-sm flex-shrink-0" style={{background:leadColor(v)}}/><span className="text-gray-400 text-xs">{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex justify-between"><span className="text-white font-bold text-sm">All Neighbourhoods</span><span className="text-gray-500 text-xs">by lead rate ↓</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-800 text-gray-600 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Area</th><th className="text-right px-3 py-2.5">Doors</th><th className="text-right px-3 py-2.5">Sessions</th><th className="text-right px-3 py-2.5">Response</th><th className="text-right px-5 py-2.5">Lead Rate</th>
            </tr></thead>
            <tbody>
              {[...NEIGHBORHOODS].sort((a,b)=>b.leadRate-a.leadRate).map((n,i,arr)=>(
                <tr key={n.id} className={i<arr.length-1?"border-b border-gray-800":""}>
                  <td className="px-5 py-2.5 text-white font-medium">{n.name}</td>
                  <td className="px-3 py-2.5 text-gray-300 text-right">{n.doors}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-right">{n.sessions}</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{color:n.responseRate>60?"#34d399":n.responseRate>40?"#fbbf24":"#f87171"}}>{n.responseRate}%</td>
                  <td className="px-5 py-2.5 text-right font-bold text-orange-300">{n.leadRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeadsTab(){
  const [filterGrade,setFilterGrade]=useState("ALL");
  const [filterRep,setFilterRep]=useState("ALL");
  const [filterService,setFilterService]=useState("ALL");
  const reps=["ALL",...new Set(ALL_LEADS.map(l=>l.rep))];
  const filtered=ALL_LEADS.filter(l=>(filterGrade==="ALL"||l.grade===filterGrade)&&(filterRep==="ALL"||l.rep===filterRep)&&(filterService==="ALL"||l.service===filterService));
  const counts=Object.fromEntries(Object.keys(GRADES).map(g=>[g,ALL_LEADS.filter(l=>l.grade===g).length]));
  const serviceCounts=Object.fromEntries(Object.keys(SERVICES).map(s=>[s,ALL_LEADS.filter(l=>l.service===s).length]));
  return(
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(GRADES).map(([g,cfg])=>(
          <div key={g} onClick={()=>setFilterGrade(filterGrade===g?"ALL":g)} className="bg-gray-900 border rounded-xl p-3 text-center cursor-pointer transition-all" style={{borderColor:filterGrade===g?cfg.color:"#1f2937"}}>
            <div className="font-black text-2xl" style={{color:cfg.color,fontFamily:"monospace"}}>{counts[g]}</div>
            <div className="text-white text-xs font-bold mt-0.5">Grade {g}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(SERVICES).map(([s,cfg])=>(
          <div key={s} onClick={()=>setFilterService(filterService===s?"ALL":s)} className="bg-gray-900 border rounded-xl p-3 text-center cursor-pointer transition-all" style={{borderColor:filterService===s?cfg.color:"#1f2937"}}>
            <div className="font-black text-2xl" style={{color:cfg.color,fontFamily:"monospace"}}>{serviceCounts[s]}</div>
            <div className="text-xs font-bold mt-0.5" style={{color:cfg.color}}>{s}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {["ALL","A","B","C","D"].map(g=>{const cfg=g==="ALL"?null:GRADES[g];return <button key={g} onClick={()=>setFilterGrade(g)} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all" style={filterGrade===g?{background:cfg?cfg.bg:"#1f2937",color:cfg?cfg.color:"#fff"}:{color:"#4b5563"}}>{g}</button>;})}
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
          {["ALL",...Object.keys(SERVICES)].map(s=>{const cfg=s==="ALL"?null:SERVICES[s];const short=s==="ALL"?"All":s==="Polymeric Sanding"?"Poly Sand":s;return <button key={s} onClick={()=>setFilterService(s)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={filterService===s?{background:cfg?cfg.bg:"#1f2937",color:cfg?cfg.color:"#fff"}:{color:"#4b5563"}}>{short}</button>;})}
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
          {reps.map(r=><button key={r} onClick={()=>setFilterRep(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={filterRep===r?{background:"#1f2937",color:"#fff"}:{color:"#4b5563"}}>{r==="ALL"?"All Reps":r}</button>)}
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex justify-between"><span className="text-white font-bold text-sm">All Leads</span><span className="text-gray-500 text-xs">{filtered.length} results</span></div>
        <div className="divide-y divide-gray-800">
          {filtered.map(lead=>(
            <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
              <AdminGradeBadge grade={lead.grade}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1"><span className="text-white font-bold text-sm">{lead.name}</span><ServiceTag service={lead.service}/></div>
                <div className="text-gray-400 text-xs">{lead.address} · {lead.phone}</div>
                <div className="text-xs mt-0.5 flex gap-2"><span className="text-gray-600">{lead.neighborhood}</span><span className="text-gray-700">·</span><span style={{color:ADMIN_REPS.find(r=>r.name===lead.rep)?.color||"#9ca3af"}}>{lead.rep}</span></div>
              </div>
              <div className="text-gray-600 text-xs flex-shrink-0">{lead.date}</div>
            </div>
          ))}
          {filtered.length===0&&<div className="px-5 py-10 text-center text-gray-600 text-sm">No leads match this filter.</div>}
        </div>
      </div>
    </div>
  );
}

function TotalsTab(){
  const totalDoors=ADMIN_REPS.reduce((s,r)=>s+r.lifetime.doors,0);
  const totalAnswered=ADMIN_REPS.reduce((s,r)=>s+r.lifetime.answered,0);
  const totalLeads=ADMIN_REPS.reduce((s,r)=>s+r.lifetime.leads,0);
  const totalSessions=ADMIN_REPS.reduce((s,r)=>s+r.lifetime.sessions,0);
  const respRate=Math.round((totalAnswered/totalDoors)*100);
  const lRate=Math.round((totalLeads/totalAnswered)*100);
  const dpl=Math.round(totalDoors/totalLeads);
  const bestHood=[...NEIGHBORHOODS].sort((a,b)=>b.leadRate-a.leadRate)[0];
  const gradeCounts=Object.fromEntries(Object.keys(GRADES).map(g=>[g,ALL_LEADS.filter(l=>l.grade===g).length]));
  return(
    <div className="space-y-5">
      <div><div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">All-Time Totals</div>
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Total Doors"    value={totalDoors.toLocaleString()} sub={`${totalSessions} sessions`}/>
          <KPI label="Total Leads"    value={totalLeads.toLocaleString()} color="#63b3ed"/>
          <KPI label="Total Answered" value={totalAnswered.toLocaleString()} color="#34d399"/>
          <KPI label="Active Reps"    value={ADMIN_REPS.length} color="#a78bfa"/>
        </div>
      </div>
      <div><div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Overall Rates</div>
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Response Rate"   value={`${respRate}%`} color="#34d399" sub="Answered ÷ knocked"/>
          <KPI label="Lead Conv. Rate" value={`${lRate}%`}    color="#f97316" sub="Leads ÷ answered"/>
          <KPI label="Doors Per Lead"  value={dpl}            color="#fbbf24" sub="Efficiency"/>
          <KPI label="Best Area"       value={bestHood.name}  color="#f472b6" sub={`${bestHood.leadRate}% lead rate`}/>
        </div>
      </div>
      <div><div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Lead Grade Breakdown</div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {Object.entries(GRADES).map(([g,cfg],i,arr)=>{
            const count=gradeCounts[g]; const pct=Math.round((count/ALL_LEADS.length)*100);
            return(<div key={g} className={`px-5 py-4 flex items-center gap-4 ${i<arr.length-1?"border-b border-gray-800":""}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}44`}}>{g}</div>
              <div className="flex-1"><div className="flex justify-between text-xs mb-1.5"><span className="text-gray-300">{cfg.desc}</span><span className="font-bold" style={{color:cfg.color}}>{count} · {pct}%</span></div><Bar value={count} max={ALL_LEADS.length} color={cfg.color}/></div>
            </div>);
          })}
        </div>
      </div>
      <div><div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Service Breakdown</div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {Object.entries(SERVICES).map(([s,cfg],i,arr)=>{
            const sl=ALL_LEADS.filter(l=>l.service===s); const count=sl.length; const pct=Math.round((count/ALL_LEADS.length)*100);
            return(<div key={s} className={`px-5 py-4 ${i<arr.length-1?"border-b border-gray-800":""}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}44`}}>{s==="Polymeric Sanding"?"⬡":s==="Sealing"?"◈":"◎"}</div>
                <div className="flex-1"><div className="flex justify-between text-xs mb-1.5"><span className="text-gray-300 font-medium">{s}</span><span className="font-bold" style={{color:cfg.color}}>{count} leads · {pct}%</span></div><Bar value={count} max={ALL_LEADS.length} color={cfg.color}/></div>
              </div>
              <div className="grid grid-cols-4 gap-2 ml-14">
                {Object.entries(GRADES).map(([g,gcfg])=>{const gc=sl.filter(l=>l.grade===g).length; const gp=count>0?Math.round((gc/count)*100):0;
                  return(<div key={g} className="rounded-lg p-2 text-center" style={{background:gcfg.bg+"88",border:`1px solid ${gcfg.color}22`}}>
                    <div className="font-black text-base" style={{color:gcfg.color,fontFamily:"monospace"}}>{gc}</div>
                    <div className="text-xs font-bold" style={{color:gcfg.color}}>Grade {g}</div>
                    <div className="text-gray-600 text-xs mt-0.5">{gp}%</div>
                  </div>);
                })}
              </div>
            </div>);
          })}
        </div>
      </div>
      <div><div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Rep Comparison</div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-800 text-gray-600 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Rep</th><th className="text-right px-3 py-2.5">Doors</th><th className="text-right px-3 py-2.5">Leads</th><th className="text-right px-3 py-2.5">Response</th><th className="text-right px-5 py-2.5">Lead Rate</th>
            </tr></thead>
            <tbody>{ADMIN_REPS.map((r,i)=>{
              const rr=Math.round((r.lifetime.answered/r.lifetime.doors)*100); const lr=Math.round((r.lifetime.leads/r.lifetime.answered)*100);
              return(<tr key={r.id} className={i<ADMIN_REPS.length-1?"border-b border-gray-800":""}>
                <td className="px-5 py-3 flex items-center gap-2"><div className="w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center" style={{background:r.color+"22",color:r.color}}>{r.avatar}</div><span className="text-white font-medium">{r.name}</span></td>
                <td className="px-3 py-3 text-gray-300 text-right">{r.lifetime.doors.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:r.color}}>{r.lifetime.leads}</td>
                <td className="px-3 py-3 text-right font-bold" style={{color:rr>60?"#34d399":rr>40?"#fbbf24":"#f87171"}}>{rr}%</td>
                <td className="px-5 py-3 text-right font-bold text-orange-300">{lr}%</td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminRepsTab(){
  const [sel,setSel]=useState(null);
  const [sub,setSub]=useState("overview");
  if(sel) return <AdminRepDetail rep={sel} sub={sub} setSub={setSub} onBack={()=>{setSel(null);setSub("overview");}}/>;
  return(
    <div className="space-y-3">
      <div className="text-gray-500 text-xs tracking-widest uppercase font-bold">Rep Profiles</div>
      {ADMIN_REPS.map(r=>{
        const rr=Math.round((r.lifetime.answered/r.lifetime.doors)*100); const lr=Math.round((r.lifetime.leads/r.lifetime.answered)*100);
        const repLeads=ALL_LEADS.filter(l=>l.rep===r.name);
        return(
          <div key={r.id} onClick={()=>setSel(r)} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-600 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl font-black text-lg flex items-center justify-center flex-shrink-0" style={{background:r.color+"22",color:r.color,border:`1px solid ${r.color}44`}}>{r.avatar}</div>
              <div className="flex-1"><div className="text-white font-bold">{r.name}</div><div className="text-gray-500 text-xs">Since {r.joinDate} · {r.lifetime.sessions} sessions</div></div>
              <span className="text-gray-600 group-hover:text-white transition-colors text-xl">›</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
              {[["Doors",r.lifetime.doors.toLocaleString(),"#e5e7eb"],["Leads",r.lifetime.leads,r.color],["Resp.",`${rr}%`,"#34d399"],["Conv.",`${lr}%`,"#fb923c"]].map(([l,v,c])=>(
                <div key={l} className="bg-gray-800 rounded-lg p-2 text-center"><div className="font-bold" style={{color:c}}>{v}</div><div className="text-gray-600 mt-0.5">{l}</div></div>
              ))}
            </div>
            <div className="flex gap-2">
              {Object.entries(GRADES).map(([g,cfg])=>{const cnt=repLeads.filter(l=>l.grade===g).length;return(
                <div key={g} className="flex items-center gap-1 text-xs"><div className="w-5 h-5 rounded-md flex items-center justify-center font-black text-xs" style={{background:cfg.bg,color:cfg.color}}>{g}</div><span className="text-gray-400">{cnt}</span></div>
              );})}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminSessionsList({rep,repLeads}){
  const [openIdx,setOpenIdx]=useState(null);
  return(
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex justify-between"><span className="text-white font-bold text-sm">Recent Sessions</span><span className="text-gray-500 text-xs">tap to see leads</span></div>
      <div className="divide-y divide-gray-800">
        {rep.sessions.map((s,i)=>{
          const sr=Math.round((s.answered/s.doors)*100);
          const isOpen=openIdx===i;
          const sessionLeads=repLeads.filter(l=>l.neighborhood===s.neighborhood&&l.date===s.date);
          const slr=sessionLeads.length>0?Math.round((sessionLeads.length/s.answered)*100):0;
          return(
            <div key={i}>
              <div onClick={()=>setOpenIdx(isOpen?null:i)} className="px-5 py-4 cursor-pointer transition-colors" style={{background:isOpen?"#0d1520":"transparent"}}>
                <div className="flex justify-between items-start mb-3">
                  <div><div className="text-white font-bold text-sm">{s.neighborhood}</div><div className="text-gray-500 text-xs mt-0.5">{s.date} · {s.duration}</div></div>
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400 font-black text-base">{sessionLeads.length} lead{sessionLeads.length!==1?"s":""}</div>
                    <div className="text-gray-500 text-xs" style={{transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▾</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[["Knocked",s.doors,"#e5e7eb"],["Response",`${sr}%`,"#34d399"],["Lead Rate",`${slr}%`,"#fb923c"]].map(([l,v,c])=>(
                    <div key={l} className="bg-gray-800 rounded-lg p-2 text-center"><div className="font-bold" style={{color:c}}>{v}</div><div className="text-gray-600">{l}</div></div>
                  ))}
                </div>
              </div>
              {isOpen&&(
                <div style={{background:"#060b11",borderTop:"1px solid #1a2535"}}>
                  <div className="px-5 py-2 flex items-center gap-2 border-b border-gray-800">
                    <div className="w-1 h-3 rounded-full" style={{background:rep.color}}/>
                    <span className="text-xs font-bold tracking-widest uppercase" style={{color:rep.color}}>{sessionLeads.length} lead{sessionLeads.length!==1?"s":""} from this session</span>
                  </div>
                  {sessionLeads.length===0?<div className="px-5 py-4 text-gray-600 text-xs italic">No leads for this session.</div>:(
                    <div className="divide-y divide-gray-800">
                      {sessionLeads.map(lead=>(
                        <div key={lead.id} className="px-5 py-3.5 flex items-center gap-3">
                          <AdminGradeBadge grade={lead.grade}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5"><span className="text-white font-bold text-sm">{lead.name}</span><ServiceTag service={lead.service}/></div>
                            <div className="text-gray-400 text-xs mt-0.5">{lead.address}</div>
                            <div className="text-gray-500 text-xs">{lead.phone}</div>
                          </div>
                          <div className="text-gray-600 text-xs flex-shrink-0 text-right"><div>{lead.date}</div><div className="mt-0.5">{lead.neighborhood}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminRepDetail({rep,sub,setSub,onBack}){
  const rr=Math.round((rep.lifetime.answered/rep.lifetime.doors)*100);
  const lr=Math.round((rep.lifetime.leads/rep.lifetime.answered)*100);
  const dpl=Math.round(rep.lifetime.doors/rep.lifetime.leads);
  const repLeads=ALL_LEADS.filter(l=>l.rep===rep.name);
  const maxDoors=Math.max(...rep.monthly.map(m=>m.doors));
  return(
    <div className="space-y-4">
      <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition-colors">← All Reps</button>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl font-black text-2xl flex items-center justify-center flex-shrink-0" style={{background:rep.color+"22",color:rep.color,border:`2px solid ${rep.color}55`}}>{rep.avatar}</div>
          <div>
            <div className="text-white font-black text-xl">{rep.name}</div>
            <div className="text-gray-400 text-xs">Field Rep · Since {rep.joinDate}</div>
            <div className="flex items-center gap-2 mt-1.5"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/><span className="text-green-400 text-xs font-bold uppercase tracking-wider">Active</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["Doors",rep.lifetime.doors.toLocaleString(),"#e5e7eb"],["Leads",rep.lifetime.leads,rep.color],["Sessions",rep.lifetime.sessions,"#a78bfa"]].map(([l,v,c])=>(
            <div key={l} className="bg-gray-800 rounded-xl p-3 text-center"><div className="font-black text-xl" style={{color:c,fontFamily:"monospace"}}>{v}</div><div className="text-gray-500 text-xs mt-0.5">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {[["overview","Overview"],["leads","Leads"],["sessions","Sessions"],["monthly","Monthly"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)} className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all" style={sub===k?{background:rep.color+"22",color:rep.color}:{color:"#4b5563"}}>{l}</button>
        ))}
      </div>
      {sub==="overview"&&<div className="grid grid-cols-2 gap-3">
        <KPI label="Response Rate" value={`${rr}%`} color="#34d399" sub="Doors answered"/>
        <KPI label="Lead Conv."    value={`${lr}%`} color="#f97316" sub="Answered → lead"/>
        <KPI label="Doors / Lead"  value={dpl}      color="#fbbf24" sub="Efficiency"/>
        <KPI label="Total Hours"   value={rep.lifetime.duration} color={rep.color} sub="In field"/>
      </div>}
      {sub==="leads"&&(
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex justify-between"><span className="text-white font-bold text-sm">Leads — {rep.name}</span><span className="text-gray-500 text-xs">{repLeads.length} total</span></div>
          <div className="divide-y divide-gray-800">
            {repLeads.map(lead=>(
              <div key={lead.id} className="px-5 py-3.5 flex items-center gap-3">
                <AdminGradeBadge grade={lead.grade}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5"><span className="text-white font-bold text-sm">{lead.name}</span><ServiceTag service={lead.service}/></div>
                  <div className="text-gray-400 text-xs">{lead.address} · {lead.phone}</div>
                </div>
                <div className="text-right text-xs flex-shrink-0"><div className="text-gray-400">{lead.date}</div><div className="text-gray-600">{lead.neighborhood}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {sub==="sessions"&&<AdminSessionsList rep={rep} repLeads={repLeads}/>}
      {sub==="monthly"&&(
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="text-white font-bold text-sm">Monthly Breakdown</div>
          {rep.monthly.map(m=>(
            <div key={m.month}>
              <div className="flex justify-between text-xs mb-1.5"><span className="text-gray-300 font-bold">{m.month} 2026</span><span className="text-gray-400">{m.doors} doors · <span style={{color:rep.color}} className="font-bold">{m.leads} leads</span></span></div>
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${(m.doors/maxDoors)*100}%`,background:`linear-gradient(90deg,${rep.color}88,${rep.color})`}}/></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
