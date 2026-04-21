import { useState, useEffect, useRef } from "react";
import { supabase } from "./src/supabase.js";
import { useJsApiLoader, GoogleMap, OverlayView, Circle } from "@react-google-maps/api";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
// Haversine distance in metres between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Reverse geocode a tap point → { number, street, neighbourhood, lat, lng }
function reverseGeocode(lat, lng) {
  return new Promise(resolve => {
    try {
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const comps  = results[0].address_components;
          const loc    = results[0].geometry.location;
          const num    = comps.find(c => c.types.includes("street_number"))?.long_name || "";
          const street = comps.find(c => c.types.includes("route"))?.long_name        || "Unknown St";
          const neighbourhood =
            comps.find(c => c.types.includes("neighborhood") || c.types.includes("sublocality_level_1") || c.types.includes("sublocality"))?.long_name ||
            comps.find(c => c.types.includes("locality"))?.long_name ||
            "Toronto";
          resolve({ number: parseInt(num) || 0, street, neighbourhood, lat: loc.lat(), lng: loc.lng() });
        } else {
          console.error("[reverseGeocode] status:", status);
          resolve({ number: 0, street: "Unknown St", neighbourhood: "Toronto", lat: null, lng: null });
        }
      });
    } catch (err) {
      console.error("[reverseGeocode] exception:", err);
      resolve({ number: 0, street: "Unknown St", neighbourhood: "Toronto", lat: null, lng: null });
    }
  });
}

// Forward geocode a street address → precise { lat, lng } of that house
function forwardGeocode(number, street) {
  return new Promise(resolve => {
    try {
      const address = `${number} ${street}, Toronto, ON`;
      new window.google.maps.Geocoder().geocode({ address }, (results, status) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          console.error("[forwardGeocode] status:", status, `for "${address}"`);
          resolve(null);
        }
      });
    } catch (err) {
      console.error("[forwardGeocode] exception:", err);
      resolve(null);
    }
  });
}

const STATUS_CONFIG = {
  unvisited:      { color: "#4a5568", label: "Not Visited",    icon: "○", textColor: "#fff" },
  no_answer:      { color: "#f6ad55", label: "No Answer",      icon: "—", textColor: "#fff" },
  not_interested: { color: "#fc8181", label: "Not Interested", icon: "✕", textColor: "#fff" },
  answered:       { color: "#68d391", label: "Answered",       icon: "✓", textColor: "#fff" },
  lead:           { color: "#63b3ed", label: "Lead!",          icon: "★", textColor: "#fff" },
  avoid:          { color: "#ef4444", label: "Avoid",          icon: "⛔", textColor: "#fff", stripe: true },
  sale:           { color: "#FFD700", label: "Sale",           icon: "💰", textColor: "#000" },
};

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

const MAP_DARK_STYLE = [
  { elementType: "geometry",            stylers: [{ color: "#0d1117" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0d1117" }] },
  { featureType: "road",   elementType: "geometry",        stylers: [{ color: "#1f2937" }] },
  { featureType: "road",   elementType: "geometry.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "water",  elementType: "geometry",        stylers: [{ color: "#0a0f1a" }] },
  { featureType: "poi",    stylers: [{ visibility: "off" }] },
  { featureType: "transit",stylers: [{ visibility: "off" }] },
];

// Real Toronto lat/lng for each neighbourhood slug
const HOOD_LATLNG = {
  annex:       { lat: 43.672, lng: -79.406 },
  midtown:     { lat: 43.688, lng: -79.389 },
  rosedale:    { lat: 43.680, lng: -79.376 },
  foresthill:  { lat: 43.697, lng: -79.420 },
  yorkdale:    { lat: 43.724, lng: -79.447 },
  leaside:     { lat: 43.707, lng: -79.363 },
  eastyork:    { lat: 43.692, lng: -79.337 },
  downsview:   { lat: 43.745, lng: -79.477 },
  weston:      { lat: 43.706, lng: -79.511 },
  york:        { lat: 43.716, lng: -79.462 },
  eglinton:    { lat: 43.700, lng: -79.448 },
  davisville:  { lat: 43.697, lng: -79.390 },
};


function formatDuration(s) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatHM(ms) {
  if (!ms || ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function KnockrApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authError,   setAuthError]   = useState(null);
  const [user,        setUser]        = useState(null);
  const [screen,      setScreen]      = useState("rep");
  const [houses,      setHouses]      = useState([]);
  const [session,     setSession]     = useState(null);
  const [elapsed,     setElapsed]     = useState(0);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [repTab,                  setRepTab]                  = useState("stats");
  const [sessLoading,             setSessLoading]             = useState(false);
  const [statsRefreshKey,         setStatsRefreshKey]         = useState(0);
  const [lastSessionNeighborhood, setLastSessionNeighborhood] = useState(null);
  const [pastHousesRefreshKey,    setPastHousesRefreshKey]    = useState(0);

  // ── Auth bootstrap — onAuthStateChange fires INITIAL_SESSION on mount ───────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) loadProfile(s.user.id);
      else { setUser(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(uid) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (error) { console.error("loadProfile:", error); setAuthError(error.message); }
    else setAuthError(null);
    setUser(data || null);
    setAuthLoading(false);
  }

  // ── Timer — restarts from 0 each session, stays at final value for summary ──
  useEffect(() => {
    if (!session) return;
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  const metrics = {
    attempted:     houses.filter(h => h.status !== "unvisited").length,
    knocked:       houses.filter(h => ["no_answer", "not_interested", "answered", "lead", "sale"].includes(h.status)).length,
    answered:      houses.filter(h => ["answered", "lead", "sale"].includes(h.status)).length,
    notInterested: houses.filter(h => h.status === "not_interested").length,
    noAnswer:      houses.filter(h => h.status === "no_answer").length,
    leads:         houses.filter(h => h.status === "lead").length,
    sales:         houses.filter(h => h.status === "sale").length,
    avoided:       houses.filter(h => h.status === "avoid").length,
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null); setHouses([]); setRepTab("stats");
  };

  const handleStartSession = async () => {
    setSessLoading(true);
    const { data: sess, error } = await supabase
      .from("sessions")
      .insert({ rep_id: user.id, neighborhood: "Current Location", started_at: new Date().toISOString() })
      .select().single();
    if (error) { console.error(error); setSessLoading(false); return; }
    setHouses([]);
    setSession({ id: sess.id, startTime: Date.now(), neighborhood: "Current Location" });
    setSessLoading(false);
  };

  const handleAddHouse = (house) => {
    setHouses(prev => [...prev, house]);
  };

  const handleUpdateSession = (updates) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  const handleEndSession = async () => {
    if (session?.id) {
      await supabase.from("sessions").update({
        ended_at:      new Date().toISOString(),
        doors_knocked: metrics.knocked,
        doors_answered: metrics.answered,
        leads_count:   metrics.leads,
      }).eq("id", session.id);
    }
    setLastSessionNeighborhood(session?.neighborhood || null);
    setStatsRefreshKey(k => k + 1);
    setSession(null);
    setScreen("summary");
  };

  const handleUpdateHouse = async (id, updates) => {
    const house = houses.find(h => h.id === id);
    if (!house?.dbId) {
      setHouses(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
      setSelectedHouse(null);
      return;
    }

    const { error: knockErr } = await supabase.from("knocks").insert({
      house_id:   house.dbId,
      rep_id:     user.id,
      session_id: session.id,
      status:     updates.status,
      notes:      updates.notes || "",
    });
    if (knockErr) throw knockErr;

    const { error: houseErr } = await supabase.from("houses")
      .update({ status: updates.status, notes: updates.notes || "", updated_at: new Date().toISOString() })
      .eq("id", house.dbId);
    if (houseErr) throw houseErr;

    if (updates.status === "lead" && updates.leadInfo) {
      const { error: leadErr } = await supabase.from("leads").insert({
        house_id:     house.dbId,
        session_id:   session.id,
        rep_id:       user.id,
        name:         updates.leadInfo.name    || "",
        phone:        updates.leadInfo.phone   || "",
        email:        updates.leadInfo.email   || "",
        service:      updates.leadInfo.service || "",
        grade:        updates.leadInfo.grade   || "B",
        note:         updates.leadInfo.note    || "",
        neighborhood: session.neighborhood,
        address:      `${house.number} ${house.street}`,
      });
      if (leadErr) throw leadErr;
    }
    if (updates.status === "sale" && updates.leadInfo) {
      const { error: leadErr } = await supabase.from("leads").insert({
        house_id:     house.dbId,
        session_id:   session.id,
        rep_id:       user.id,
        name:         updates.leadInfo.name    || "",
        phone:        updates.leadInfo.phone   || "",
        email:        updates.leadInfo.email   || "",
        service:      updates.leadInfo.service || "",
        grade:        updates.leadInfo.grade   || "A",
        note:         `${updates.leadInfo.note ? updates.leadInfo.note + " | " : ""}Sale value: $${updates.leadInfo.saleValue || "—"}`,
        neighborhood: session.neighborhood,
        address:      `${house.number} ${house.street}`,
      });
      if (leadErr) throw leadErr;
    }

    setHouses(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
    setSelectedHouse(null);
  };

  const handleReKnock = async (house, updates) => {
    if (!session) return;

    const { error: knockErr } = await supabase.from("knocks").insert({
      house_id:   house.id,
      rep_id:     user.id,
      session_id: session.id,
      status:     updates.status,
      notes:      updates.notes || "",
    });
    if (knockErr) throw knockErr;

    const { error: houseErr } = await supabase.from("houses")
      .update({ status: updates.status, notes: updates.notes || "", updated_at: new Date().toISOString() })
      .eq("id", house.id);
    if (houseErr) throw houseErr;

    if (updates.status === "lead" && updates.leadInfo) {
      const { error: leadErr } = await supabase.from("leads").insert({
        house_id:     house.id,
        session_id:   session.id,
        rep_id:       user.id,
        name:         updates.leadInfo.name    || "",
        phone:        updates.leadInfo.phone   || "",
        email:        updates.leadInfo.email   || "",
        service:      updates.leadInfo.service || "",
        grade:        updates.leadInfo.grade   || "B",
        note:         updates.leadInfo.note    || "",
        neighborhood: session.neighborhood,
        address:      `${house.number} ${house.street}`,
      });
      if (leadErr) throw leadErr;
    }
    if (updates.status === "sale" && updates.leadInfo) {
      const { error: leadErr } = await supabase.from("leads").insert({
        house_id:     house.id,
        session_id:   session.id,
        rep_id:       user.id,
        name:         updates.leadInfo.name    || "",
        phone:        updates.leadInfo.phone   || "",
        email:        updates.leadInfo.email   || "",
        service:      updates.leadInfo.service || "",
        grade:        updates.leadInfo.grade   || "A",
        note:         `${updates.leadInfo.note ? updates.leadInfo.note + " | " : ""}Sale value: $${updates.leadInfo.saleValue || "—"}`,
        neighborhood: session.neighborhood,
        address:      `${house.number} ${house.street}`,
      });
      if (leadErr) throw leadErr;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading…</div>
    </div>
  );
  if (!user) return <LoginScreen onLogin={handleLogin} authError={authError} />;
  if (user.role === "manager") return <AdminDashboard user={user} onLogout={logout} />;
  if (screen === "summary") return (
    <SummaryScreen metrics={metrics} elapsed={elapsed} user={user}
      neighborhood={lastSessionNeighborhood}
      onDone={() => { setHouses([]); setScreen("rep"); setRepTab("knock"); setElapsed(0); setPastHousesRefreshKey(k => k + 1); }}
      onLogout={logout} />
  );

  return (
    <div style={{ fontFamily: "'Courier New',monospace", paddingBottom: "env(safe-area-inset-bottom)" }} className="min-h-screen bg-gray-950 flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{ background: user.color + "22", color: user.color, border: `1px solid ${user.color}44` }}>
            {user.avatar}
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">{user.name}</div>
            {session && <div className="text-cyan-300 text-xs font-mono">● {formatDuration(elapsed)}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <KnockrLogo size="sm" />
          <button onClick={logout} className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-all"
            style={{ borderColor: "#2a6a6a", color: "#6b9e9e", fontFamily: "'Courier New',monospace" }}>
            Logout
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-800 bg-gray-900">
        {[["stats", "📊", "My Stats"], ["knock", "🚪", "Knock"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setRepTab(id)}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            style={repTab === id ? { color: user.color, borderBottom: `2px solid ${user.color}` } : { color: "#374151", borderBottom: "2px solid transparent" }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {repTab === "knock" && (
        <KnockTab user={user} houses={houses} session={session} metrics={metrics}
          selectedHouse={selectedHouse} onSelectHouse={setSelectedHouse}
          sessLoading={sessLoading}
          pastHousesRefreshKey={pastHousesRefreshKey}
          onStartSession={handleStartSession}
          onEndSession={handleEndSession}
          onUpdateHouse={handleUpdateHouse}
          onAddHouse={handleAddHouse}
          onUpdateSession={handleUpdateSession}
          onReKnock={handleReKnock} />
      )}
      {repTab === "stats" && <StatsTab user={user} statsRefreshKey={statsRefreshKey} />}
    </div>
  );
}

// ── Brand ────────────────────────────────────────────────────────────────────
const BRAND      = "#2a7d8c";
const BRAND_TEXT = "#1a3a4a";

function KnockrLogo({ size = "md" }) {
  const iconSize = size === "lg" ? 56 : size === "md" ? 38 : 26;
  const textSize = size === "lg" ? "text-4xl" : size === "md" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <svg width={iconSize} height={iconSize} viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28 3C17.5 3 9 11.5 9 22c0 13.5 19 38 19 38s19-24.5 19-38C47 11.5 38.5 3 28 3z"
          fill="none" stroke={BRAND} strokeWidth="3" strokeLinejoin="round"/>
        <path d="M17 26l11-10 11 10" fill="none" stroke={BRAND} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round"/>
        <rect x="19" y="26" width="18" height="12" rx="0.5" fill="none" stroke={BRAND} strokeWidth="2.5"/>
        <rect x="24.5" y="30" width="7" height="8" rx="0.5" fill="none" stroke={BRAND} strokeWidth="2"/>
      </svg>
      <div>
        <div className={`font-black tracking-tight leading-none ${textSize}`}
          style={{ color: BRAND_TEXT, fontFamily: "'Helvetica Neue', Arial, sans-serif", letterSpacing: "-0.5px" }}>
          Knockr
        </div>
        {size === "lg" && (
          <div className="text-xs mt-0.5" style={{ color: "#6b9aaa", letterSpacing: "0.03em", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
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
function LoginScreen({ onLogin, authError }) {
  const [email,   setEmail]   = useState("");
  const [pw,      setPw]      = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError("");
    const err = await onLogin(email, pw);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'Courier New', monospace" }} className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div className="text-5xl font-black tracking-tighter mb-1" style={{ color: "#00e5ff", letterSpacing: "-2px" }}>KNOCKR</div>
        <div className="text-gray-500 text-xs tracking-widest uppercase">Field Sales Tracker</div>
      </div>
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <label className="block text-gray-400 text-xs tracking-widest uppercase mb-2">Email</label>
            <input className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="you@knockr.io" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div className="mb-6">
            <label className="block text-gray-400 text-xs tracking-widest uppercase mb-2">Password</label>
            <input type="password" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="••••••" value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {authError && <div className="mb-4 text-red-400 text-xs text-center">{authError}</div>}
          {error && <div className="mb-4 text-red-400 text-xs text-center">{error}</div>}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-bold tracking-widest uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOCK TAB
// ══════════════════════════════════════════════════════════════════════════════
function KnockTab({ user, houses, session, metrics, selectedHouse, onSelectHouse, onStartSession, onEndSession, onUpdateHouse, onAddHouse, onUpdateSession, onReKnock, sessLoading, pastHousesRefreshKey }) {
  const [gpsPos,           setGpsPos]           = useState({ lat: 43.6894, lng: -79.3590 });
  const [gpsAccuracy,      setGpsAccuracy]      = useState(null);
  const [toast,            setToast]            = useState(null);
  const [creating,         setCreating]         = useState(false);
  const [pastHouses,       setPastHouses]       = useState([]);
  const [pastHousesLoaded, setPastHousesLoaded] = useState(false);
  const [selectedPast,     setSelectedPast]     = useState(null);
  const mapRef   = useRef(null);
  const watchRef = useRef(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY });

  // Get position immediately and watch it continuously
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPos(loc);
        setGpsAccuracy(pos.coords.accuracy);
        mapRef.current?.panTo(loc);
      },
      () => {},
      { enableHighAccuracy: true }
    );
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPos(loc);
        setGpsAccuracy(pos.coords.accuracy);
        mapRef.current?.panTo(loc);
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // Load all houses from previous sessions (communal map)
  useEffect(() => {
    async function loadPastHouses() {
      let q = supabase.from("houses").select("*").not("lat", "is", null).not("status", "eq", "unvisited");
      if (session?.id) q = q.neq("session_id", session.id);
      const { data } = await q;
      // Ensure dbId is always set so HouseModal can query knocks correctly
      setPastHouses((data || []).map(h => ({ ...h, dbId: h.id })));
      setPastHousesLoaded(true);
    }
    loadPastHouses();
  }, [session?.id, pastHousesRefreshKey]);

  // Reset loaded flag when session changes so taps are blocked until new load completes
  useEffect(() => { setPastHousesLoaded(false); }, [session?.id]);

  function handlePastHouseClick(house) {
    if (["lead", "sale"].includes(house.status)) return;
    if (!session) { showToast("Start a session to re-knock this house."); return; }
    setSelectedPast(house);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleMapClick(e) {
    if (!session || creating) return;
    if (!pastHousesLoaded) { showToast("Loading nearby houses…"); return; }
    const tapLat = e.latLng.lat();
    const tapLng = e.latLng.lng();

    // Proximity check — rep must be within 50m of the tap
    if (gpsAccuracy != null && gpsAccuracy > 30) {
      showToast("GPS signal weak — move to open sky for better accuracy.");
      return;
    }
    if (haversineDistance(gpsPos.lat, gpsPos.lng, tapLat, tapLng) > 50) {
      showToast("You must be near this house to log it.");
      return;
    }

    setCreating(true);

    // Step 1: reverse geocode the tap to find the nearest real address
    const { number, street, neighbourhood, lat: rgLat, lng: rgLng } = await reverseGeocode(tapLat, tapLng);

    // Block unidentified addresses
    if (!number || !street || street === "Unknown St") {
      showToast("Could not identify this address. Tap closer to a house.");
      setCreating(false);
      return;
    }

    // Duplicate check — current session
    const alreadyLogged = houses.some(
      h => h.number === number && h.street.toLowerCase() === street.toLowerCase()
    );
    if (alreadyLogged) {
      showToast("This house is already logged.");
      setCreating(false);
      return;
    }

    // Past house check — open re-knock modal instead of creating
    const pastMatch = pastHouses.find(
      h => h.number === number && h.street.toLowerCase() === street.toLowerCase()
    );
    if (pastMatch) {
      setCreating(false);
      if (["lead", "sale"].includes(pastMatch.status)) {
        showToast("This house is locked and cannot be re-knocked.");
      } else {
        handlePastHouseClick(pastMatch);
      }
      return;
    }

    // Auto-detect neighbourhood from geocode and update session once
    if (neighbourhood && session.neighborhood === "Current Location") {
      await supabase.from("sessions").update({ neighborhood: neighbourhood }).eq("id", session.id);
      onUpdateSession?.({ neighborhood: neighbourhood });
    }

    // Step 2: forward geocode to snap the marker to the exact house position
    const snapped = await forwardGeocode(number, street);
    const finalLat = snapped?.lat ?? rgLat ?? tapLat;
    const finalLng = snapped?.lng ?? rgLng ?? tapLng;

    const { data: saved, error } = await supabase.from("houses").insert({
      session_id: session.id,
      rep_id:     user.id,
      number:     number || 0,
      street,
      lat: finalLat,
      lng: finalLng,
      x: 0, y: 0,
      status: "unvisited",
    }).select().single();

    if (!error && saved) {
      const house = {
        id: saved.id, dbId: saved.id,
        number: saved.number, street: saved.street,
        lat: saved.lat, lng: saved.lng,
        x: 0, y: 0,
        status: "unvisited", leadInfo: null,
      };
      onAddHouse(house);
      onSelectHouse(house);
    }
    setCreating(false);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative" style={{ height: "calc(100dvh - 200px)" }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%", cursor: session ? "crosshair" : "default" }}
            center={gpsPos}
            zoom={20}
            options={{
              styles: MAP_DARK_STYLE,
              disableDefaultUI: true,
              gestureHandling: "greedy",
              clickableIcons: false,
              minZoom: 18,
            }}
            onLoad={map => { mapRef.current = map; }}
            onClick={handleMapClick}
          >
            {(() => {
              // Build a set of addresses already covered by current session
              const currentAddrs = new Set(
                houses.map(h => `${h.number}|${h.street.toLowerCase()}`)
              );

              // Deduplicated past houses — skip any whose address is in current session
              const dedupedPast = pastHouses.filter(
                h => !currentAddrs.has(`${h.number}|${h.street.toLowerCase()}`)
              );

              return (
                <>
                  {/* Past houses — candy-cane stripes, clickable for re-knock */}
                  {dedupedPast.map(house => {
                    const cfg      = STATUS_CONFIG[house.status] || STATUS_CONFIG.unvisited;
                    const isLocked = ["lead", "sale"].includes(house.status);
                    const isPastSelected = selectedPast?.id === house.id;
                    // Stripe pattern for past markers — overlay same-hue at 40% over solid color
                    const darkStripe = cfg.color + "44";
                    const stripe = `repeating-linear-gradient(45deg, ${cfg.color} 0px, ${cfg.color} 4px, ${darkStripe} 4px, ${darkStripe} 8px)`;
                    return (
                      <OverlayView
                        key={`past-${house.id}`}
                        position={{ lat: house.lat, lng: house.lng }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      >
                        <div
                          onClick={e => { e.stopPropagation(); handlePastHouseClick(house); }}
                          style={{
                            transform: "translate(-50%,-50%)",
                            position: "relative",
                            zIndex: 8,
                            background: stripe,
                            color: cfg.textColor || "#fff",
                            borderRadius: 6,
                            minWidth: 36,
                            height: 28,
                            padding: "0 6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 3,
                            fontSize: 13,
                            fontWeight: 900,
                            fontFamily: "monospace",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            border: isPastSelected ? "2px solid #00e5ff" : "1.5px solid rgba(255,255,255,0.5)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.8)",
                            userSelect: "none",
                            whiteSpace: "nowrap",
                            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                          }}
                        >
                          {house.number || "?"}
                          {isLocked && <span style={{ fontSize: 9, lineHeight: 1 }}>🔒</span>}
                        </div>
                      </OverlayView>
                    );
                  })}

                  {/* Current session houses — solid color, full opacity */}
                  {houses.map(house => {
                    const cfg = STATUS_CONFIG[house.status] || STATUS_CONFIG.unvisited;
                    const isSelected = selectedHouse?.id === house.id;
                    const markerBg = house.status === "avoid"
                      ? "repeating-linear-gradient(45deg,#ef4444 0,#ef4444 4px,#fff 4px,#fff 8px)"
                      : cfg.color;
                    const markerColor = cfg.textColor || "#fff";
                    return (
                      <OverlayView
                        key={house.id}
                        position={{ lat: house.lat, lng: house.lng }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                      >
                        <div
                          onClick={e => { e.stopPropagation(); onSelectHouse(house); }}
                          style={{
                            transform: "translate(-50%,-50%)",
                            position: "relative",
                            zIndex: 10,
                            background: markerBg,
                            color: markerColor,
                            borderRadius: 6,
                            minWidth: 36,
                            height: 30,
                            padding: "0 7px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 900,
                            fontFamily: "monospace",
                            cursor: "pointer",
                            border: isSelected ? "3px solid #00e5ff" : "2px solid #fff",
                            boxShadow: isSelected
                              ? `0 0 0 2px ${cfg.color}, 0 3px 10px rgba(0,0,0,0.9)`
                              : "0 3px 8px rgba(0,0,0,0.8)",
                            userSelect: "none",
                            whiteSpace: "nowrap",
                            textShadow: house.status === "avoid" ? "0 1px 3px rgba(0,0,0,0.6)" : undefined,
                          }}
                        >
                          {house.number || "?"}
                        </div>
                      </OverlayView>
                    );
                  })}
                </>
              );
            })()}
            <OverlayView position={gpsPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%,-50%)", position: "relative", width: 18, height: 18, pointerEvents: "none", zIndex: 20 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#00e5ff", border: "2.5px solid white", boxShadow: "0 0 16px #00e5ff" }} />
                <div className="animate-ping" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#00e5ff", opacity: 0.35 }} />
              </div>
            </OverlayView>
          </GoogleMap>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#0d1117" }}>
            <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading map…</div>
          </div>
        )}

        {/* Toast notification */}
        {toast && (
          <div className="absolute top-4 left-0 right-0 flex justify-center" style={{ zIndex: 30, pointerEvents: "none" }}>
            <div style={{ background: "#f87171", color: "#000", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, fontFamily: "monospace", boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}>
              {toast}
            </div>
          </div>
        )}

        {/* Creating indicator */}
        {creating && (
          <div className="absolute top-4 left-0 right-0 flex justify-center" style={{ zIndex: 30, pointerEvents: "none" }}>
            <div style={{ background: "#1f2937", color: "#00e5ff", border: "1px solid #00e5ff44", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>
              Getting address…
            </div>
          </div>
        )}

        {/* Hint overlay */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center" style={{ pointerEvents: "none", zIndex: 10 }}>
          <div className="bg-gray-900 bg-opacity-80 border border-gray-700 rounded-xl px-4 py-2 text-center">
            {session
              ? <div className="text-cyan-400 text-xs font-bold">Tap near a house to log it</div>
              : <>
                  <div className="text-gray-300 text-sm font-bold">Ready to knock?</div>
                  <div className="text-gray-500 text-xs">Hit Start Session below</div>
                </>
            }
          </div>
        </div>
      </div>

      {session && (
        <div className="grid grid-cols-5 bg-gray-900 border-t border-gray-800 text-center text-xs py-2">
          {[["Knocked", metrics.knocked, "text-white"], ["Answered", metrics.answered, "text-green-400"], ["Leads", metrics.leads, "text-blue-400"], ["Sales", metrics.sales, "text-yellow-400"], ["No Ans.", metrics.noAnswer, "text-amber-400"]].map(([l, v, c]) => (
            <div key={l}><div className={`font-bold text-lg ${c}`}>{v}</div><div className="text-gray-500">{l}</div></div>
          ))}
        </div>
      )}

      <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1 px-4 py-2 bg-gray-900 border-t border-gray-800">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} />{cfg.label}
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        {!session ? (
          <button onClick={onStartSession} disabled={sessLoading}
            className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
            {sessLoading ? "Starting…" : "▶ START SESSION"}
          </button>
        ) : (
          <button onClick={onEndSession}
            className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase border border-red-600 text-red-400 hover:bg-red-900 transition-all active:scale-95">
            ■ END SESSION
          </button>
        )}
      </div>

      {selectedHouse && <HouseModal house={selectedHouse} onUpdate={onUpdateHouse} onClose={() => onSelectHouse(null)} />}

      {selectedPast && (
        <HouseModal
          house={selectedPast}
          onUpdate={async (id, updates) => {
            await onReKnock(selectedPast, updates);
            setPastHouses(prev => prev.map(h => h.id === id ? { ...h, status: updates.status } : h));
            setSelectedPast(null);
          }}
          onClose={() => setSelectedPast(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOUSE MODAL
// ══════════════════════════════════════════════════════════════════════════════
const AVOID_REASONS = [
  "No solicitation sign",
  "Aggressive animal",
  "Rude/hostile home owner",
  "Gated/no access",
  "Unsafe property",
  "Other",
];

function HouseModal({ house, onUpdate, onClose }) {
  // Status always starts empty — rep picks a fresh outcome every time
  const [status,        setStatus]        = useState("");
  const [notes,         setNotes]         = useState("");
  const [avoidReasons,  setAvoidReasons]  = useState([]);
  const [showLeadForm,  setShowLeadForm]  = useState(false);
  const [leadInfo,      setLeadInfo]      = useState({ name: "", phone: "", email: "", service: "", grade: "", note: "" });
  const [saleValue,     setSaleValue]     = useState("");
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [history,       setHistory]       = useState([]);
  const [historyReady,  setHistoryReady]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [dirty,         setDirty]         = useState(false);

  // Fetch knock history on mount — use dbId (set for past houses) or fall back to id
  useEffect(() => {
    const houseId = house.dbId || house.id;
    supabase.from("knocks")
      .select("*, profiles(name, color)")
      .eq("house_id", houseId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("[History] query error:", error);
        setHistory(data || []);
        setHistoryReady(true);
      });
  }, [house.dbId, house.id]);

  // Row 1: Avoid | Not Interested
  // Row 2: No Answer | Answered
  // Row 3: Got a Lead | Sale!
  const statusButtons = [
    { key: "avoid",          label: "⛔ Avoid",        bg: "#ffffff",  text: "#dc2626" },
    { key: "not_interested", label: "Not Interested",  bg: "#7f1d1d",  text: "#fc8181" },
    { key: "no_answer",      label: "No Answer",       bg: "#78350f",  text: "#f6ad55" },
    { key: "answered",       label: "Needs Follow Up", bg: "#14532d",  text: "#68d391" },
    { key: "lead",           label: "Got a Lead! ★",   bg: "#1e3a5f",  text: "#63b3ed" },
    { key: "sale",           label: "Sale! 💰",         bg: "#1c1400",  text: "#FFD700" },
  ];

  function handleStatusClick(key) {
    setStatus(key);
    setShowLeadForm(key === "lead" || key === "sale");
    if (key !== "avoid") setAvoidReasons([]);
    setDirty(true);
  }

  function toggleAvoidReason(reason) {
    setAvoidReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
    setDirty(true);
  }

  const canSubmit = (() => {
    if (!status || status === "unvisited") return false;
    if (status === "avoid") return avoidReasons.length > 0;
    if (status === "lead") return !!(leadInfo.name.trim() && leadInfo.phone.trim() && leadInfo.grade);
    if (status === "sale") return !!(leadInfo.name.trim() && leadInfo.phone.trim() && leadInfo.grade && parseFloat(saleValue) > 0);
    return true;
  })();

  const logOutcome = async () => {
    setSubmitting(true);
    try {
      const finalNotes = status === "avoid"
        ? avoidReasons.join(", ") + (notes.trim() ? ` | ${notes.trim()}` : "")
        : notes;
      await onUpdate(house.id, {
        status,
        notes: finalNotes,
        leadInfo: status === "lead" ? leadInfo : status === "sale" ? { ...leadInfo, saleValue } : null,
      });
    } catch (err) {
      alert("Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  function tryClose() {
    if (dirty && !window.confirm("Discard this knock?")) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.8)" }} onClick={tryClose}>
      <div className="bg-gray-900 rounded-t-3xl p-6 max-h-[85dvh] overflow-y-auto pb-8" style={{ WebkitOverflowScrolling: "touch" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-white font-bold text-lg">{house.number} {house.street}</span>
              {/* History button — always a clickable toggle */}
              <button onClick={() => setHistoryOpen(o => !o)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border transition-all"
                style={historyOpen
                  ? { background: "#0d1f14", color: "#34d399", borderColor: "#34d399" }
                  : { color: "#6b7280", borderColor: "#374151" }}>
                🕐 History
              </button>
            </div>
            <div className="text-gray-500 text-xs">Select an outcome</div>
          </div>
          <button onClick={tryClose} className="text-gray-500 text-2xl leading-none flex-shrink-0">×</button>
        </div>

        {/* History dropdown */}
        {historyOpen && (() => {
          // Build display entries: knocks table rows first; fall back to house itself
          // if the house has been visited but predates the knocks table.
          const entries = historyReady && history.length === 0 && house.status && house.status !== "unvisited"
            ? [{
                id: `fallback-${house.id}`,
                status: house.status,
                notes: house.notes || "",
                created_at: house.updated_at || house.created_at,
                profiles: null,
                isFallback: true,
              }]
            : history;

          return (
            <div className="mb-4 rounded-xl overflow-hidden border border-gray-800" style={{ background: "#0d1117" }}>
              <div className="px-3 py-2 border-b border-gray-800">
                <div className="text-gray-400 text-xs font-bold tracking-widest uppercase">{house.number} {house.street}</div>
              </div>
              <div className="p-2 space-y-1.5">
                {!historyReady ? (
                  <div className="px-2 py-3 text-gray-500 text-xs font-mono animate-pulse">Loading…</div>
                ) : entries.length === 0 ? (
                  <div className="px-2 py-3 text-gray-600 text-xs">No previous visits recorded.</div>
                ) : (
                  entries.map(k => {
                    const scfg = STATUS_CONFIG[k.status];
                    return (
                      <div key={k.id} className="rounded-lg overflow-hidden flex"
                        style={{ background: "#111827", borderLeft: `3px solid ${scfg?.color || "#4a5568"}` }}>
                        <div className="flex-1 px-3 py-2">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs mb-0.5">
                            <span className="text-white font-bold">{k.profiles?.name || "You"}</span>
                            <span className="text-gray-600">·</span>
                            <span style={{ color: scfg?.color || "#9ca3af" }} className="font-bold">
                              {scfg?.label || k.status}
                            </span>
                            <span className="text-gray-600">·</span>
                            <span className="text-gray-500">{formatDate(k.created_at)}</span>
                          </div>
                          {k.notes && <div className="text-gray-400 text-xs italic">{k.notes}</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* 6 status buttons — 3 rows × 2 columns */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {statusButtons.map(btn => (
            <button key={btn.key}
              onClick={() => handleStatusClick(btn.key)}
              className="py-3 rounded-xl text-sm font-bold transition-all border-2"
              style={{
                background: btn.bg,
                color: btn.text,
                borderColor: status === btn.key ? btn.text : "transparent",
              }}>
              {btn.label}
            </button>
          ))}
        </div>

        {/* Avoid reasons — checkboxes */}
        {status === "avoid" && (
          <div className="mb-4 bg-gray-800 rounded-xl p-4 border border-red-900">
            <div className="text-red-400 text-xs font-bold tracking-widest uppercase mb-3">Select all that apply:</div>
            <div className="space-y-2">
              {AVOID_REASONS.map(reason => (
                <label key={reason} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => toggleAvoidReason(reason)}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all"
                    style={{
                      background: avoidReasons.includes(reason) ? "#dc2626" : "transparent",
                      borderColor: avoidReasons.includes(reason) ? "#dc2626" : "#4b5563",
                    }}>
                    {avoidReasons.includes(reason) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors"
                    onClick={() => toggleAvoidReason(reason)}>
                    {reason}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <label className="block text-gray-400 text-xs mb-1.5 uppercase tracking-wider">Additional Notes</label>
              <textarea
                className="w-full bg-gray-700 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-red-500 resize-none transition-colors"
                rows={3} placeholder="Add notes (optional)..."
                value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }}
              />
            </div>
          </div>
        )}

        {/* Notes textarea — for no_answer, not_interested, answered only */}
        {status && ["no_answer", "not_interested", "answered"].includes(status) && (
          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-cyan-500 resize-none transition-colors"
              rows={3} placeholder="Add notes (optional)..."
              value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }}
            />
          </div>
        )}

        {/* Unified lead/sale form */}
        {showLeadForm && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-blue-900">
            <div className="text-blue-300 text-xs font-bold tracking-widest uppercase mb-3">
              {status === "sale" ? "Sale Info" : "Lead Info"}
            </div>
            {[{ label: "Name", key: "name", ph: "Full name" }, { label: "Phone", key: "phone", ph: "(416) 000-0000" }, { label: "Email", key: "email", ph: "email@example.com" }].map(f => (
              <div key={f.key} className="mb-3">
                <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">{f.label}</label>
                <input className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:border-blue-500"
                  placeholder={f.ph} value={leadInfo[f.key]} onChange={e => { setLeadInfo({ ...leadInfo, [f.key]: e.target.value }); setDirty(true); }} />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-gray-400 text-xs mb-2 uppercase tracking-wider">Lead Grade</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(GRADES).map(([g, cfg]) => (
                  <button key={g} onClick={() => { setLeadInfo({ ...leadInfo, grade: g }); setDirty(true); }}
                    className="py-2.5 rounded-xl font-black text-lg transition-all border-2"
                    style={leadInfo.grade === g
                      ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color, boxShadow: `0 0 10px ${cfg.color}44` }
                      : { background: "#1f2937", color: "#4b5563", borderColor: "transparent" }}>
                    {g}
                  </button>
                ))}
              </div>
              {leadInfo.grade && (
                <div className="mt-1.5 text-xs" style={{ color: GRADES[leadInfo.grade].color }}>
                  {leadInfo.grade === "A" && "Ready to move forward"}
                  {leadInfo.grade === "B" && "Interested, needs follow-up"}
                  {leadInfo.grade === "C" && "Lukewarm, worth a callback"}
                  {leadInfo.grade === "D" && "Low interest, low priority"}
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">Service</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SERVICES).map(([s, cfg]) => (
                  <button key={s} onClick={() => { setLeadInfo({ ...leadInfo, service: s }); setDirty(true); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                    style={leadInfo.service === s ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color } : { color: "#4b5563", borderColor: "#374151" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className={status === "sale" ? "mb-3" : ""}>
              <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider">Lead Note</label>
              <textarea className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:border-blue-500 resize-none"
                rows={2} placeholder="Any details…" value={leadInfo.note} onChange={e => { setLeadInfo({ ...leadInfo, note: e.target.value }); setDirty(true); }} />
            </div>
            {status === "sale" && (
              <div>
                <label className="block text-gray-400 text-xs mb-1 uppercase tracking-wider" style={{ color: "#FFD700" }}>
                  Estimated Sale Value ($)
                </label>
                <input type="number" min="0"
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. 1500"
                  value={saleValue} onChange={e => { setSaleValue(e.target.value); setDirty(true); }} />
              </div>
            )}
          </div>
        )}

        <button onClick={logOutcome}
          disabled={!canSubmit || submitting}
          className="w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
          style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
          {submitting ? "Saving…" : "LOG OUTCOME"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS TAB — loads from Supabase
// ══════════════════════════════════════════════════════════════════════════════
function StatsTab({ user, statsRefreshKey }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("overview");

  useEffect(() => {
    setLoading(true);
    async function load() {
      const [{ data: sessions }, { data: leads }] = await Promise.all([
        supabase.from("sessions").select("*").eq("rep_id", user.id).order("started_at", { ascending: false }),
        supabase.from("leads").select("*").eq("rep_id", user.id).order("created_at", { ascending: false }),
      ]);
      setData({ sessions: sessions || [], leads: leads || [] });
      setLoading(false);
    }
    load();
  }, [user.id, statsRefreshKey]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="text-cyan-400 text-sm font-mono animate-pulse">Loading stats…</div></div>;

  const { sessions, leads } = data;
  const totalDoors    = sessions.reduce((s, r) => s + (r.doors_knocked  || 0), 0);
  const totalAnswered = sessions.reduce((s, r) => s + (r.doors_answered || 0), 0);
  const totalLeads    = sessions.reduce((s, r) => s + (r.leads_count    || 0), 0);
  const totalMs       = sessions.reduce((s, r) => s + (r.ended_at ? new Date(r.ended_at) - new Date(r.started_at) : 0), 0);
  const lifetime = {
    sessions: sessions.length,
    doors:    totalDoors,
    answered: totalAnswered,
    leads:    totalLeads,
    duration: formatHM(totalMs),
  };

  const respRate = lifetime.doors    > 0 ? Math.round((lifetime.answered / lifetime.doors)    * 100) : 0;
  const leadRate = lifetime.answered > 0 ? Math.round((lifetime.leads    / lifetime.answered) * 100) : 0;
  const dpl      = lifetime.leads    > 0 ? Math.round(lifetime.doors / lifetime.leads) : 0;

  // Monthly grouping — oldest first
  const monthlyMap = {};
  sessions.forEach(s => {
    const d   = new Date(s.started_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, doors: 0, leads: 0, ts: d.getTime() };
    monthlyMap[key].doors += s.doors_knocked || 0;
    monthlyMap[key].leads += s.leads_count   || 0;
  });
  const monthly   = Object.values(monthlyMap).sort((a, b) => a.ts - b.ts);
  const maxDoors  = Math.max(...monthly.map(m => m.doors), 1);

  const gradeCounts = Object.fromEntries(Object.keys(GRADES).map(g => [g, leads.filter(l => l.grade === g).length]));

  const allSessionsFormatted = sessions.map(s => ({
    date:         formatDate(s.started_at),
    neighborhood: s.neighborhood,
    doors:        s.doors_knocked  || 0,
    answered:     s.doors_answered || 0,
    leads:        s.leads_count    || 0,
    duration:     s.ended_at ? formatHM(new Date(s.ended_at) - new Date(s.started_at)) : "In progress",
  }));

  return (
    <div className="flex-1 overflow-y-auto pb-12">
      <div className="flex gap-1 p-3 bg-gray-900 border-b border-gray-800">
        {[["overview", "Overview"], ["leads", "My Leads"], ["sessions", "Sessions"]].map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={section === k ? { background: user.color + "22", color: user.color } : { color: "#4b5563" }}>
            {l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {section === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Doors Knocked",  lifetime.doors.toLocaleString(), "#e5e7eb",  "All time"],
                ["Total Leads",    lifetime.leads,                   user.color, "All time"],
                ["Response Rate",  `${respRate}%`,                   "#34d399",  "Answered ÷ knocked"],
                ["Lead Conv.",     `${leadRate}%`,                   "#f97316",  "Leads ÷ answered"],
                ["Doors / Lead",   dpl || "—",                       "#fbbf24",  "Efficiency ratio"],
                ["Hours in Field", lifetime.duration,                "#a78bfa",  `${lifetime.sessions} sessions`],
              ].map(([label, value, color, sub]) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-gray-500 text-xs tracking-widest uppercase mb-1">{label}</div>
                  <div className="font-black text-2xl" style={{ color, fontFamily: "monospace" }}>{value}</div>
                  <div className="text-gray-600 text-xs mt-1">{sub}</div>
                </div>
              ))}
            </div>

            {monthly.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="text-white font-bold text-sm mb-4">Monthly Activity</div>
                <div className="space-y-3">
                  {monthly.map(m => (
                    <div key={m.month}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-300 font-bold">{m.month}</span>
                        <span className="text-gray-400">{m.doors} doors · <span style={{ color: user.color }} className="font-bold">{m.leads} leads</span></span>
                      </div>
                      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(m.doors / maxDoors) * 100}%`, background: `linear-gradient(90deg,${user.color}88,${user.color})` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800"><span className="text-white font-bold text-sm">Lead Grade Breakdown</span></div>
              {Object.entries(GRADES).map(([g, cfg], i, arr) => {
                const count = gradeCounts[g];
                const pct   = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                return (
                  <div key={g} className={`px-5 py-3.5 flex items-center gap-4 ${i < arr.length - 1 ? "border-b border-gray-800" : ""}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>{g}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-300">{cfg.desc}</span>
                        <span className="font-bold" style={{ color: cfg.color }}>{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${leads.length > 0 ? (count / leads.length) * 100 : 0}%`, background: cfg.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800"><span className="text-white font-bold text-sm">Service Breakdown</span></div>
              {(() => {
                const leadsWithService = leads.filter(l => l.service);
                return Object.entries(SERVICES).map(([s, cfg], i, arr) => {
                const serviceLeads = leads.filter(l => l.service === s);
                const count = serviceLeads.length;
                const pct   = leadsWithService.length > 0 ? Math.round((count / leadsWithService.length) * 100) : 0;
                return (
                  <div key={s} className={`px-5 py-4 ${i < arr.length - 1 ? "border-b border-gray-800" : ""}`}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                        {s === "Polymeric Sanding" ? "⬡" : s === "Sealing" ? "◈" : "◎"}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-300 font-medium">{s}</span>
                          <span className="font-bold" style={{ color: cfg.color }}>{count} leads · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${leadsWithService.length > 0 ? (count / leadsWithService.length) * 100 : 0}%`, background: cfg.color }} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 ml-12">
                      {Object.entries(GRADES).map(([g, gcfg]) => {
                        const gc = serviceLeads.filter(l => l.grade === g).length;
                        const gp = count > 0 ? Math.round((gc / count) * 100) : 0;
                        return (
                          <div key={g} className="rounded-lg p-2 text-center" style={{ background: gcfg.bg + "88", border: `1px solid ${gcfg.color}22` }}>
                            <div className="font-black text-base" style={{ color: gcfg.color, fontFamily: "monospace" }}>{gc}</div>
                            <div className="text-xs font-bold" style={{ color: gcfg.color }}>Grade {g}</div>
                            <div className="text-gray-600 text-xs mt-0.5">{gp}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </>
        )}

        {section === "leads" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
              <span className="text-white font-bold text-sm">My Leads</span>
              <span className="text-gray-500 text-xs">{leads.length} total</span>
            </div>
            {leads.length === 0
              ? <div className="px-5 py-10 text-center text-gray-600 text-sm">No leads yet. Start a session to capture leads.</div>
              : (
                <div className="divide-y divide-gray-800">
                  {leads.map(lead => {
                    const gcfg = GRADES[lead.grade];
                    const scfg = SERVICES[lead.service];
                    return (
                      <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                          style={{ background: gcfg.bg, color: gcfg.color, border: `1px solid ${gcfg.color}44` }}>{lead.grade}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-white font-bold text-sm">{lead.name || "—"}</span>
                            {scfg && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold"
                              style={{ background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.color}33` }}>{lead.service}</span>}
                          </div>
                          <div className="text-gray-400 text-xs">{lead.address}</div>
                          <div className="text-gray-500 text-xs">{lead.phone} · {lead.neighborhood}</div>
                          {lead.note && <div className="text-gray-500 text-xs italic mt-0.5">{lead.note}</div>}
                        </div>
                        <div className="text-gray-600 text-xs flex-shrink-0 pt-0.5">{formatDate(lead.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {section === "sessions" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800"><span className="text-white font-bold text-sm">All Sessions</span></div>
            {allSessionsFormatted.length === 0
              ? <div className="px-5 py-10 text-center text-gray-600 text-sm">No sessions yet.</div>
              : (
                <div className="divide-y divide-gray-800">
                  {allSessionsFormatted.map((s, i) => {
                    const sr = s.doors > 0 ? Math.round((s.answered / s.doors) * 100) : 0;
                    const lr = s.answered > 0 ? Math.round((s.leads / s.answered) * 100) : 0;
                    return (
                      <div key={i} className="px-5 py-4">
                        <div className="flex justify-between mb-3">
                          <div>
                            <div className="text-white font-bold text-sm">{s.neighborhood}</div>
                            <div className="text-gray-500 text-xs mt-0.5">{s.date} · {s.duration}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-lg" style={{ color: user.color }}>{s.leads}</div>
                            <div className="text-gray-600 text-xs">leads</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {[["Knocked", s.doors, "#e5e7eb"], ["Response", `${sr}%`, "#34d399"], ["Lead Rate", `${lr}%`, "#fb923c"]].map(([l, v, c]) => (
                            <div key={l} className="bg-gray-800 rounded-lg p-2 text-center">
                              <div className="font-bold" style={{ color: c }}>{v}</div>
                              <div className="text-gray-600">{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SummaryScreen({ metrics, elapsed, user, neighborhood, onDone, onLogout }) {
  const answerRate = metrics.knocked  > 0 ? Math.round((metrics.answered / metrics.knocked)  * 100) : 0;
  const leadRate   = metrics.answered > 0 ? Math.round((metrics.leads    / metrics.answered) * 100) : 0;
  const rows = [
    ["Doors Knocked",   metrics.knocked,        "text-white"],
    ["Doors Answered",  metrics.answered,       "text-green-400"],
    ["Not Interested",  metrics.notInterested,  "text-red-400"],
    ["No Answer",       metrics.noAnswer,       "text-amber-400"],
    ["Avoided",         metrics.avoided || 0,   "text-gray-400"],
    ["Leads Captured",  metrics.leads,          "text-blue-400"],
    ["Sales Closed",    metrics.sales || 0,     "text-yellow-400"],
    ["Answer Rate",     `${answerRate}%`,        "text-green-300"],
    ["Lead Conversion", `${leadRate}%`,          "text-blue-300"],
    ["Duration",        formatDuration(elapsed), "text-cyan-300"],
  ];
  return (
    <div style={{ fontFamily: "'Courier New',monospace" }} className="min-h-screen bg-gray-950 flex flex-col text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-cyan-400 font-black text-2xl tracking-tighter">SESSION COMPLETE</div>
          <div className="text-gray-500 text-xs mt-1">{user?.name} · {neighborhood || "Current Location"}</div>
        </div>
        <button onClick={onLogout} className="text-gray-600 hover:text-gray-400 text-xs">Logout</button>
      </div>
      <div className="text-center mb-8 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="text-7xl font-black" style={{ color: user?.color || "#00e5ff" }}>{metrics.leads}</div>
        <div className="text-gray-400 text-sm tracking-widest uppercase mt-1">Leads This Session</div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        {rows.map(([label, value, color], i) => (
          <div key={label} className={`flex justify-between items-center px-5 py-3 ${i < rows.length - 1 ? "border-b border-gray-800" : ""}`}>
            <span className="text-gray-400 text-sm">{label}</span>
            <span className={`font-bold text-sm ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      <button onClick={onDone} className="w-full py-4 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
        style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
        BACK TO APP
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — shared helpers
// ══════════════════════════════════════════════════════════════════════════════
function getCentroid(d) {
  const coords = [...d.matchAll(/[\d.]+,[\d.]+/g)].map(m => m[0].split(",").map(Number));
  if (!coords.length) return [0, 0];
  return [coords.reduce((s, c) => s + c[0], 0) / coords.length, coords.reduce((s, c) => s + c[1], 0) / coords.length];
}
function responseColor(r) { const t = r / 100; return `rgb(${10},${Math.round(60 + t * 160)},${Math.round(90 + t * 110)})`; }
function leadColor(r)     { const t = Math.min(r / 35, 1); return `rgb(${Math.round(30 + t * 215)},${Math.round(25 + t * 105)},10)`; }

function KPI({ label, value, sub, color = "#00e5ff" }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-500 text-xs tracking-widest uppercase mb-1">{label}</div>
      <div className="font-black text-2xl" style={{ color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div className="text-gray-600 text-xs mt-1">{sub}</div>}
    </div>
  );
}
function AdminGradeBadge({ grade }) {
  const g = GRADES[grade];
  return <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0" style={{ background: g.bg, color: g.color, border: `1px solid ${g.color}44` }}>{grade}</div>;
}
function Bar({ value, max, color }) {
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}
function ServiceTag({ service }) {
  const cfg = SERVICES[service]; if (!cfg) return null;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>{service}</span>;
}
function Spinner() {
  return <div className="flex-1 flex items-center justify-center py-16"><div className="text-cyan-400 text-sm font-mono animate-pulse">Loading…</div></div>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("heatmap");
  const tabs = [
    { id: "heatmap", icon: "⬡", label: "Heatmap" },
    { id: "leads",   icon: "★", label: "Leads"   },
    { id: "totals",  icon: "◈", label: "Totals"  },
    { id: "reps",    icon: "◎", label: "Reps"    },
    { id: "team",    icon: "＋", label: "Team"   },
  ];

  return (
    <div style={{ fontFamily: "'Courier New',monospace", background: "#080c12" }} className="min-h-screen text-white">
      <div className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KnockrLogo size="sm" />
          <span className="h-4 w-px bg-gray-700" />
          <span className="text-gray-500 text-xs uppercase tracking-widest">Admin</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={onLogout} className="ml-1 text-gray-600 hover:text-gray-300 border border-gray-700 px-2 py-1 rounded-lg transition-colors">Logout</button>
        </div>
      </div>
      <div className="flex border-b border-gray-800 bg-gray-950 sticky top-12 z-30 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all whitespace-nowrap px-2"
            style={tab === t.id ? { color: "#00e5ff", borderBottom: "2px solid #00e5ff" } : { color: "#374151", borderBottom: "2px solid transparent" }}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-12">
        {tab === "heatmap" && <HeatmapTab />}
        {tab === "leads"   && <LeadsTab />}
        {tab === "totals"  && <TotalsTab />}
        {tab === "reps"    && <AdminRepsTab />}
        {tab === "team"    && <TeamTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HEATMAP TAB
// ══════════════════════════════════════════════════════════════════════════════
function HeatmapTab() {
  const [hoods,   setHoods]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode,    setMode]    = useState("response");
  const [hov,     setHov]     = useState(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY });

  useEffect(() => {
    supabase.from("neighborhoods").select("*").then(({ data }) => {
      setHoods(data || []); setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  const hoodMap    = Object.fromEntries(hoods.map(n => [n.slug, n]));
  const colorFn    = mode === "response" ? responseColor : leadColor;
  const metricKey  = mode === "response" ? "response_rate" : "lead_rate";

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div><div className="text-white font-bold">Neighbourhood Heatmap</div><div className="text-gray-500 text-xs mt-0.5">Toronto · All time</div></div>
          <div className="flex gap-2">
            {[["response", "Response %", "#60a5fa", "#0070ff"], ["lead", "Lead %", "#fb923c", "#f97316"]].map(([m, l, c, b]) => (
              <button key={m} onClick={() => setMode(m)} className="text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all"
                style={mode === m ? { background: b + "22", color: c, border: `1px solid ${b}` } : { color: "#4b5563", border: "1px solid #374151" }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row">
          <div className="relative flex-1" style={{ background: "#0a0f1a", height: 300 }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={{ lat: 43.700, lng: -79.420 }}
                zoom={12}
                options={{ styles: MAP_DARK_STYLE, disableDefaultUI: true, gestureHandling: "greedy", clickableIcons: false }}
              >
                {hoods.filter(n => HOOD_LATLNG[n.slug]).map(n => {
                  const val   = n[metricKey];
                  const fill  = colorFn(val);
                  const isHov = hov === n.slug;
                  const radius = 350 + (n.doors / 312) * 500;
                  return (
                    <Circle
                      key={n.slug}
                      center={HOOD_LATLNG[n.slug]}
                      radius={radius}
                      options={{
                        fillColor: fill,
                        fillOpacity: isHov ? 0.9 : 0.65,
                        strokeColor: isHov ? "#ffffff" : fill,
                        strokeOpacity: 0.8,
                        strokeWeight: isHov ? 2 : 0.5,
                      }}
                      onMouseOver={() => setHov(n.slug)}
                      onMouseOut={() => setHov(null)}
                      onClick={() => setHov(hov === n.slug ? null : n.slug)}
                    />
                  );
                })}
              </GoogleMap>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="text-cyan-400 text-sm font-mono animate-pulse">Loading map…</div>
              </div>
            )}
            {hov && hoodMap[hov] && (
              <div className="absolute top-3 left-3 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl text-xs" style={{ minWidth: 160, zIndex: 10 }}>
                <div className="text-white font-bold mb-2">{hoodMap[hov].name}</div>
                {[["Response Rate", hoodMap[hov].response_rate + "%", "#34d399"], ["Lead Rate", hoodMap[hov].lead_rate + "%", "#fb923c"], ["Sessions", hoodMap[hov].sessions, "#e5e7eb"], ["Doors", hoodMap[hov].doors, "#9ca3af"]].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between gap-3 mb-1"><span className="text-gray-500">{l}</span><span className="font-bold" style={{ color: c }}>{v}</span></div>
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
              {[...hoods].sort((a,b) => b.lead_rate - a.lead_rate).map((n,i,arr) => (
                <tr key={n.id} className={i < arr.length - 1 ? "border-b border-gray-800" : ""}>
                  <td className="px-5 py-2.5 text-white font-medium">{n.name}</td>
                  <td className="px-3 py-2.5 text-gray-300 text-right">{n.doors}</td>
                  <td className="px-3 py-2.5 text-gray-400 text-right">{n.sessions}</td>
                  <td className="px-3 py-2.5 text-right font-bold" style={{color:n.response_rate>60?"#34d399":n.response_rate>40?"#fbbf24":"#f87171"}}>{n.response_rate}%</td>
                  <td className="px-5 py-2.5 text-right font-bold text-orange-300">{n.lead_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADS TAB
// ══════════════════════════════════════════════════════════════════════════════
function LeadsTab() {
  const [leads,         setLeads]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filterGrade,   setFilterGrade]   = useState("ALL");
  const [filterRep,     setFilterRep]     = useState("ALL");
  const [filterService, setFilterService] = useState("ALL");

  useEffect(() => {
    supabase.from("leads").select("*, profiles(name, color, avatar)").order("created_at", { ascending: false })
      .then(({ data }) => { setLeads(data || []); setLoading(false); });
  }, []);

  if (loading) return <Spinner />;

  const repNames = ["ALL", ...new Set(leads.map(l => l.profiles?.name).filter(Boolean))];
  const filtered = leads.filter(l =>
    (filterGrade   === "ALL" || l.grade   === filterGrade) &&
    (filterRep     === "ALL" || l.profiles?.name === filterRep) &&
    (filterService === "ALL" || l.service === filterService)
  );
  const counts       = Object.fromEntries(Object.keys(GRADES).map(g   => [g, leads.filter(l => l.grade   === g).length]));
  const serviceCounts= Object.fromEntries(Object.keys(SERVICES).map(s => [s, leads.filter(l => l.service === s).length]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(GRADES).map(([g, cfg]) => (
          <div key={g} onClick={() => setFilterGrade(filterGrade === g ? "ALL" : g)}
            className="bg-gray-900 border rounded-xl p-3 text-center cursor-pointer transition-all"
            style={{ borderColor: filterGrade === g ? cfg.color : "#1f2937" }}>
            <div className="font-black text-2xl" style={{ color: cfg.color, fontFamily: "monospace" }}>{counts[g]}</div>
            <div className="text-white text-xs font-bold mt-0.5">Grade {g}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(SERVICES).map(([s, cfg]) => (
          <div key={s} onClick={() => setFilterService(filterService === s ? "ALL" : s)}
            className="bg-gray-900 border rounded-xl p-3 text-center cursor-pointer transition-all"
            style={{ borderColor: filterService === s ? cfg.color : "#1f2937" }}>
            <div className="font-black text-2xl" style={{ color: cfg.color, fontFamily: "monospace" }}>{serviceCounts[s]}</div>
            <div className="text-xs font-bold mt-0.5" style={{ color: cfg.color }}>{s}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {["ALL","A","B","C","D"].map(g => { const cfg = g === "ALL" ? null : GRADES[g]; return (
            <button key={g} onClick={() => setFilterGrade(g)} className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
              style={filterGrade === g ? { background: cfg ? cfg.bg : "#1f2937", color: cfg ? cfg.color : "#fff" } : { color: "#4b5563" }}>{g}</button>
          ); })}
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
          {["ALL", ...Object.keys(SERVICES)].map(s => { const cfg = s === "ALL" ? null : SERVICES[s]; const short = s === "ALL" ? "All" : s === "Polymeric Sanding" ? "Poly Sand" : s; return (
            <button key={s} onClick={() => setFilterService(s)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={filterService === s ? { background: cfg ? cfg.bg : "#1f2937", color: cfg ? cfg.color : "#fff" } : { color: "#4b5563" }}>{short}</button>
          ); })}
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
          {repNames.map(r => (
            <button key={r} onClick={() => setFilterRep(r)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={filterRep === r ? { background: "#1f2937", color: "#fff" } : { color: "#4b5563" }}>{r === "ALL" ? "All Reps" : r}</button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
          <span className="text-white font-bold text-sm">All Leads</span>
          <span className="text-gray-500 text-xs">{filtered.length} results</span>
        </div>
        <div className="divide-y divide-gray-800">
          {filtered.map(lead => (
            <div key={lead.id} className="px-5 py-3.5 flex items-start gap-3">
              <AdminGradeBadge grade={lead.grade} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-bold text-sm">{lead.name || "—"}</span>
                  <ServiceTag service={lead.service} />
                </div>
                <div className="text-gray-400 text-xs">{lead.address} · {lead.phone}</div>
                <div className="text-xs mt-0.5 flex gap-2">
                  <span className="text-gray-600">{lead.neighborhood}</span>
                  <span className="text-gray-700">·</span>
                  <span style={{ color: lead.profiles?.color || "#9ca3af" }}>{lead.profiles?.name || "—"}</span>
                </div>
              </div>
              <div className="text-gray-600 text-xs flex-shrink-0">{formatDate(lead.created_at)}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-5 py-10 text-center text-gray-600 text-sm">No leads match this filter.</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TOTALS TAB
// ══════════════════════════════════════════════════════════════════════════════
function TotalsTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("sessions").select("*"),
      supabase.from("leads").select("*"),
      supabase.from("profiles").select("*").eq("role", "rep"),
      supabase.from("neighborhoods").select("*").order("lead_rate", { ascending: false }),
    ]).then(([{ data: sessions }, { data: leads }, { data: reps }, { data: hoods }]) => {
      setData({ sessions: sessions || [], leads: leads || [], reps: reps || [], hoods: hoods || [] });
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  const { sessions, leads, reps, hoods } = data;
  const totalDoors    = sessions.reduce((s, r) => s + (r.doors_knocked  || 0), 0);
  const totalAnswered = sessions.reduce((s, r) => s + (r.doors_answered || 0), 0);
  const totalLeads    = sessions.reduce((s, r) => s + (r.leads_count    || 0), 0);
  const totalSessions = sessions.length;
  const respRate = totalDoors    > 0 ? Math.round((totalAnswered / totalDoors)    * 100) : 0;
  const lRate    = totalAnswered > 0 ? Math.round((totalLeads    / totalAnswered) * 100) : 0;
  const dpl      = totalLeads    > 0 ? Math.round(totalDoors / totalLeads) : 0;
  const bestHood = hoods[0];
  const gradeCounts = Object.fromEntries(Object.keys(GRADES).map(g => [g, leads.filter(l => l.grade === g).length]));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">All-Time Totals</div>
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Total Doors"    value={totalDoors.toLocaleString()} sub={`${totalSessions} sessions`} />
          <KPI label="Total Leads"    value={totalLeads.toLocaleString()} color="#63b3ed" />
          <KPI label="Total Answered" value={totalAnswered.toLocaleString()} color="#34d399" />
          <KPI label="Active Reps"    value={reps.filter(r => r.status === "active").length} color="#a78bfa" />
        </div>
      </div>
      <div>
        <div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Overall Rates</div>
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Response Rate"   value={`${respRate}%`} color="#34d399" sub="Answered ÷ knocked" />
          <KPI label="Lead Conv. Rate" value={`${lRate}%`}    color="#f97316" sub="Leads ÷ answered" />
          <KPI label="Doors Per Lead"  value={dpl || "—"}     color="#fbbf24" sub="Efficiency" />
          {bestHood && <KPI label="Best Area" value={bestHood.name} color="#f472b6" sub={`${bestHood.lead_rate}% lead rate`} />}
        </div>
      </div>
      <div>
        <div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Lead Grade Breakdown</div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {Object.entries(GRADES).map(([g, cfg], i, arr) => {
            const count = gradeCounts[g]; const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
            return (
              <div key={g} className={`px-5 py-4 flex items-center gap-4 ${i < arr.length - 1 ? "border-b border-gray-800" : ""}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}>{g}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1.5"><span className="text-gray-300">{cfg.desc}</span><span className="font-bold" style={{ color: cfg.color }}>{count} · {pct}%</span></div>
                  <Bar value={count} max={Math.max(leads.length, 1)} color={cfg.color} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-gray-500 text-xs tracking-widest uppercase font-bold mb-3">Rep Comparison</div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-800 text-gray-600 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5">Rep</th><th className="text-right px-3 py-2.5">Doors</th><th className="text-right px-3 py-2.5">Leads</th><th className="text-right px-3 py-2.5">Response</th><th className="text-right px-5 py-2.5">Lead Rate</th>
            </tr></thead>
            <tbody>
              {reps.map((r, i) => {
                const repSess = sessions.filter(s => s.rep_id === r.id);
                const d  = repSess.reduce((s, x) => s + (x.doors_knocked  || 0), 0);
                const a  = repSess.reduce((s, x) => s + (x.doors_answered || 0), 0);
                const l  = repSess.reduce((s, x) => s + (x.leads_count    || 0), 0);
                const rr = d > 0 ? Math.round((a / d) * 100) : 0;
                const lr = a > 0 ? Math.round((l / a) * 100) : 0;
                return (
                  <tr key={r.id} className={i < reps.length - 1 ? "border-b border-gray-800" : ""}>
                    <td className="px-5 py-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center" style={{ background: r.color + "22", color: r.color }}>{r.avatar}</div>
                      <span className="text-white font-medium">{r.name}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-300 text-right">{d.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: r.color }}>{l}</td>
                    <td className="px-3 py-3 text-right font-bold" style={{ color: rr > 60 ? "#34d399" : rr > 40 ? "#fbbf24" : "#f87171" }}>{rr}%</td>
                    <td className="px-5 py-3 text-right font-bold text-orange-300">{lr}%</td>
                  </tr>
                );
              })}
              {reps.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-600">No reps yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN REPS TAB
// ══════════════════════════════════════════════════════════════════════════════
function AdminRepsTab() {
  const [reps,     setReps]     = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sel,      setSel]      = useState(null);
  const [sub,      setSub]      = useState("overview");

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*").eq("role", "rep"),
      supabase.from("sessions").select("*").order("started_at", { ascending: false }),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
    ]).then(([{ data: r }, { data: s }, { data: l }]) => {
      setReps(r || []); setSessions(s || []); setLeads(l || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner />;

  if (sel) {
    const repSessions = sessions.filter(s => s.rep_id === sel.id);
    const repLeads    = leads.filter(l => l.rep_id === sel.id);
    return <AdminRepDetail rep={sel} sessions={repSessions} leads={repLeads} sub={sub} setSub={setSub}
      onBack={() => { setSel(null); setSub("overview"); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="text-gray-500 text-xs tracking-widest uppercase font-bold">Rep Profiles</div>
      {reps.map(r => {
        const repSessions = sessions.filter(s => s.rep_id === r.id);
        const repLeads    = leads.filter(l => l.rep_id === r.id);
        const d  = repSessions.reduce((s, x) => s + (x.doors_knocked  || 0), 0);
        const a  = repSessions.reduce((s, x) => s + (x.doors_answered || 0), 0);
        const l  = repSessions.reduce((s, x) => s + (x.leads_count    || 0), 0);
        const rr = d > 0 ? Math.round((a / d) * 100) : 0;
        const lr = a > 0 ? Math.round((l / a) * 100) : 0;
        return (
          <div key={r.id} onClick={() => setSel(r)}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 cursor-pointer hover:border-gray-600 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl font-black text-lg flex items-center justify-center flex-shrink-0"
                style={{ background: r.color + "22", color: r.color, border: `1px solid ${r.color}44` }}>{r.avatar}</div>
              <div className="flex-1">
                <div className="text-white font-bold">{r.name}</div>
                <div className="text-gray-500 text-xs">Since {new Date(r.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})} · {repSessions.length} sessions</div>
              </div>
              <span className="text-gray-600 group-hover:text-white transition-colors text-xl">›</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
              {[["Doors", d.toLocaleString(), "#e5e7eb"], ["Leads", l, r.color], ["Resp.", `${rr}%`, "#34d399"], ["Conv.", `${lr}%`, "#fb923c"]].map(([lbl, v, c]) => (
                <div key={lbl} className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="font-bold" style={{ color: c }}>{v}</div>
                  <div className="text-gray-600 mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {Object.entries(GRADES).map(([g, cfg]) => {
                const cnt = repLeads.filter(ld => ld.grade === g).length;
                return (
                  <div key={g} className="flex items-center gap-1 text-xs">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center font-black text-xs" style={{ background: cfg.bg, color: cfg.color }}>{g}</div>
                    <span className="text-gray-400">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {reps.length === 0 && <div className="text-gray-600 text-sm text-center py-12">No reps yet. Add one in the Team tab.</div>}
    </div>
  );
}

function AdminRepDetail({ rep, sessions, leads, sub, setSub, onBack }) {
  const d   = sessions.reduce((s, x) => s + (x.doors_knocked  || 0), 0);
  const a   = sessions.reduce((s, x) => s + (x.doors_answered || 0), 0);
  const l   = sessions.reduce((s, x) => s + (x.leads_count    || 0), 0);
  const ms  = sessions.reduce((s, x) => s + (x.ended_at ? new Date(x.ended_at) - new Date(x.started_at) : 0), 0);
  const rr  = d > 0 ? Math.round((a / d) * 100) : 0;
  const lr  = a > 0 ? Math.round((l / a) * 100) : 0;
  const dpl = l > 0 ? Math.round(d / l) : 0;

  const monthlyMap = {};
  sessions.forEach(s => {
    const d   = new Date(s.started_at);
    const key = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, doors: 0, leads: 0, ts: d.getTime() };
    monthlyMap[key].doors += s.doors_knocked || 0;
    monthlyMap[key].leads += s.leads_count   || 0;
  });
  const monthly  = Object.values(monthlyMap).sort((a, b) => a.ts - b.ts);
  const maxDoors = Math.max(...monthly.map(m => m.doors), 1);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition-colors">← All Reps</button>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl font-black text-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: rep.color + "22", color: rep.color, border: `2px solid ${rep.color}55` }}>{rep.avatar}</div>
          <div>
            <div className="text-white font-black text-xl">{rep.name}</div>
            <div className="text-gray-400 text-xs">Field Rep · Since {new Date(rep.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${rep.status === "active" ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${rep.status === "active" ? "text-green-400" : "text-gray-500"}`}>{rep.status}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["Doors", d.toLocaleString(), "#e5e7eb"], ["Leads", l, rep.color], ["Sessions", sessions.length, "#a78bfa"]].map(([lbl, v, c]) => (
            <div key={lbl} className="bg-gray-800 rounded-xl p-3 text-center">
              <div className="font-black text-xl" style={{ color: c, fontFamily: "monospace" }}>{v}</div>
              <div className="text-gray-500 text-xs mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {[["overview","Overview"],["leads","Leads"],["sessions","Sessions"],["monthly","Monthly"]].map(([k,lbl]) => (
          <button key={k} onClick={() => setSub(k)} className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all"
            style={sub === k ? { background: rep.color + "22", color: rep.color } : { color: "#4b5563" }}>{lbl}</button>
        ))}
      </div>

      {sub === "overview" && (
        <div className="grid grid-cols-2 gap-3">
          <KPI label="Response Rate" value={`${rr}%`}        color="#34d399" sub="Doors answered" />
          <KPI label="Lead Conv."    value={`${lr}%`}        color="#f97316" sub="Answered → lead" />
          <KPI label="Doors / Lead"  value={dpl || "—"}      color="#fbbf24" sub="Efficiency" />
          <KPI label="Total Hours"   value={formatHM(ms)}    color={rep.color} sub="In field" />
        </div>
      )}

      {sub === "leads" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
            <span className="text-white font-bold text-sm">Leads — {rep.name}</span>
            <span className="text-gray-500 text-xs">{leads.length} total</span>
          </div>
          <div className="divide-y divide-gray-800">
            {leads.map(lead => (
              <div key={lead.id} className="px-5 py-3.5 flex items-center gap-3">
                <AdminGradeBadge grade={lead.grade} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-white font-bold text-sm">{lead.name || "—"}</span>
                    <ServiceTag service={lead.service} />
                  </div>
                  <div className="text-gray-400 text-xs">{lead.address} · {lead.phone}</div>
                </div>
                <div className="text-right text-xs flex-shrink-0">
                  <div className="text-gray-400">{formatDate(lead.created_at)}</div>
                  <div className="text-gray-600">{lead.neighborhood}</div>
                </div>
              </div>
            ))}
            {leads.length === 0 && <div className="px-5 py-8 text-center text-gray-600 text-xs">No leads yet.</div>}
          </div>
        </div>
      )}

      {sub === "sessions" && <AdminSessionsList sessions={sessions} leads={leads} rep={rep} />}

      {sub === "monthly" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="text-white font-bold text-sm">Monthly Breakdown</div>
          {monthly.length === 0
            ? <div className="text-gray-600 text-xs text-center py-6">No session data yet.</div>
            : monthly.map(m => (
                <div key={m.month}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-300 font-bold">{m.month}</span>
                    <span className="text-gray-400">{m.doors} doors · <span style={{ color: rep.color }} className="font-bold">{m.leads} leads</span></span>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(m.doors / maxDoors) * 100}%`, background: `linear-gradient(90deg,${rep.color}88,${rep.color})` }} />
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

function AdminSessionsList({ sessions, leads, rep }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex justify-between">
        <span className="text-white font-bold text-sm">Recent Sessions</span>
        <span className="text-gray-500 text-xs">tap to see leads</span>
      </div>
      <div className="divide-y divide-gray-800">
        {sessions.slice(0, 10).map((s, i) => {
          const sr           = s.doors_knocked > 0 ? Math.round((s.doors_answered / s.doors_knocked) * 100) : 0;
          const isOpen       = openIdx === i;
          const sessionLeads = leads.filter(l => l.session_id === s.id);
          const slr          = sessionLeads.length > 0 && s.doors_answered > 0 ? Math.round((sessionLeads.length / s.doors_answered) * 100) : 0;
          return (
            <div key={s.id}>
              <div onClick={() => setOpenIdx(isOpen ? null : i)} className="px-5 py-4 cursor-pointer transition-colors" style={{ background: isOpen ? "#0d1520" : "transparent" }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-white font-bold text-sm">{s.neighborhood}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{formatDate(s.started_at)} · {s.ended_at ? formatHM(new Date(s.ended_at) - new Date(s.started_at)) : "In progress"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400 font-black text-base">{sessionLeads.length} lead{sessionLeads.length !== 1 ? "s" : ""}</div>
                    <div className="text-gray-500 text-xs" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[["Knocked", s.doors_knocked || 0, "#e5e7eb"], ["Response", `${sr}%`, "#34d399"], ["Lead Rate", `${slr}%`, "#fb923c"]].map(([lbl, v, c]) => (
                    <div key={lbl} className="bg-gray-800 rounded-lg p-2 text-center">
                      <div className="font-bold" style={{ color: c }}>{v}</div>
                      <div className="text-gray-600">{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
              {isOpen && (
                <div style={{ background: "#060b11", borderTop: "1px solid #1a2535" }}>
                  <div className="px-5 py-2 flex items-center gap-2 border-b border-gray-800">
                    <div className="w-1 h-3 rounded-full" style={{ background: rep.color }} />
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: rep.color }}>{sessionLeads.length} lead{sessionLeads.length !== 1 ? "s" : ""} from this session</span>
                  </div>
                  {sessionLeads.length === 0
                    ? <div className="px-5 py-4 text-gray-600 text-xs italic">No leads for this session.</div>
                    : (
                      <div className="divide-y divide-gray-800">
                        {sessionLeads.map(lead => (
                          <div key={lead.id} className="px-5 py-3.5 flex items-center gap-3">
                            <AdminGradeBadge grade={lead.grade} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-white font-bold text-sm">{lead.name || "—"}</span>
                                <ServiceTag service={lead.service} />
                              </div>
                              <div className="text-gray-400 text-xs mt-0.5">{lead.address}</div>
                              <div className="text-gray-500 text-xs">{lead.phone}</div>
                            </div>
                            <div className="text-gray-600 text-xs flex-shrink-0 text-right">
                              <div>{formatDate(lead.created_at)}</div>
                              <div className="mt-0.5">{lead.neighborhood}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <div className="px-5 py-8 text-center text-gray-600 text-xs">No sessions yet.</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEAM TAB
// ══════════════════════════════════════════════════════════════════════════════
const REP_COLORS = ["#00e5ff","#f472b6","#34d399","#a78bfa","#fb923c","#f87171","#fbbf24","#60a5fa"];

function TeamTab() {
  const [reps,       setReps]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ name: "", email: "", password: "", color: REP_COLORS[3] });
  const [errors,     setErrors]     = useState({});
  const [showPw,     setShowPw]     = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [creating,   setCreating]   = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("*").neq("role", "manager").order("created_at")
      .then(({ data }) => { setReps(data || []); setLoading(false); });
  }, []);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.password.length < 6) e.password = "Min 6 characters";
    if (reps.find(r => r.email === form.email)) e.email = "Email already exists";
    return e;
  };

  const handleCreate = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setCreating(true);
    const initials = form.name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: { data: { name: form.name.trim(), avatar: initials, color: form.color, role: "rep" } },
    });
    if (error) { setErrors({ email: error.message }); setCreating(false); return; }

    const newRep = {
      id:         data.user?.id,
      name:       form.name.trim(),
      email:      form.email.trim().toLowerCase(),
      avatar:     initials,
      color:      form.color,
      role:       "rep",
      status:     "active",
      created_at: new Date().toISOString(),
    };
    setReps(prev => [...prev, newRep]);
    setForm({ name: "", email: "", password: "", color: REP_COLORS[reps.length % REP_COLORS.length] });
    setErrors({}); setShowForm(false); setCreating(false);
    setSuccessMsg(`${newRep.name} has been added. They'll receive a confirmation email.`);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const toggleStatus = async (id, currentStatus) => {
    const next = currentStatus === "active" ? "inactive" : "active";
    await supabase.from("profiles").update({ status: next }).eq("id", id);
    setReps(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-base">Team Management</div>
          <div className="text-gray-500 text-xs mt-0.5">{reps.filter(r => r.status === "active").length} active · {reps.length} total</div>
        </div>
        <button onClick={() => { setShowForm(true); setErrors({}); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
          ＋ Add Rep
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-3 text-green-300 text-sm flex items-center gap-2">
          <span>✓</span>{successMsg}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-900 border border-cyan-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-white font-bold text-sm">New Rep Profile</div>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-lg leading-none transition-colors">×</button>
          </div>
          {[{ label: "Full Name", key: "name", ph: "e.g. Alex Johnson", type: "text" }, { label: "Email", key: "email", ph: "alex@knockr.io", type: "email" }].map(f => (
            <div key={f.key}>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type} className="w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                style={{ borderColor: errors[f.key] ? "#f87171" : "#374151" }}
                placeholder={f.ph} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
              {errors[f.key] && <div className="text-red-400 text-xs mt-1">{errors[f.key]}</div>}
            </div>
          ))}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"}
                className="w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors pr-12"
                style={{ borderColor: errors.password ? "#f87171" : "#374151" }}
                placeholder="Min 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors">
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <div className="text-red-400 text-xs mt-1">{errors.password}</div>}
          </div>
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-1.5">Profile Colour</label>
            <div className="flex gap-2 flex-wrap">
              {REP_COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{ background: c, border: form.color === c ? "2px solid white" : "2px solid transparent", boxShadow: form.color === c ? `0 0 8px ${c}` : "none" }} />
              ))}
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
              style={{ background: form.color + "22", color: form.color, border: `1px solid ${form.color}44` }}>
              {form.name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??"}
            </div>
            <div>
              <div className="text-white text-sm font-bold">{form.name || "Rep Name"}</div>
              <div className="text-gray-500 text-xs">{form.email || "email@knockr.io"}</div>
            </div>
          </div>
          <button onClick={handleCreate} disabled={creating}
            className="w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#00e5ff,#0070ff)", color: "#000" }}>
            {creating ? "Creating…" : "Create Rep Profile"}
          </button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800"><span className="text-white font-bold text-sm">All Reps</span></div>
        <div className="divide-y divide-gray-800">
          {reps.map(rep => (
            <div key={rep.id} className="px-5 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{ background: rep.color + "22", color: rep.color, border: `1px solid ${rep.color}44`, opacity: rep.status === "inactive" ? 0.4 : 1 }}>
                {rep.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-sm">{rep.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={rep.status === "active"
                      ? { background: "#052e16", color: "#22c55e", border: "1px solid #166534" }
                      : { background: "#1f2937", color: "#6b7280", border: "1px solid #374151" }}>
                    {rep.status}
                  </span>
                </div>
                <div className="text-gray-500 text-xs mt-0.5">{rep.email}</div>
                <div className="text-gray-700 text-xs">Joined {new Date(rep.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</div>
              </div>
              <button onClick={() => toggleStatus(rep.id, rep.status)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold border transition-all hover:border-gray-500"
                style={{ borderColor: "#374151", color: "#6b7280" }}>
                {rep.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {reps.length === 0 && <div className="px-5 py-8 text-center text-gray-600 text-xs">No reps yet. Add one above.</div>}
        </div>
      </div>
    </div>
  );
}
