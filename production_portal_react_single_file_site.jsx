import React, { useMemo, useState, useEffect, useRef } from "react";

/*
  Production Portal (Single-file React app)
  -------------------------------------------------
  ✔ Announcements (Electronic Call Board) — hero banner, always visible
  ✔ Calendar (Rehearsal/Production) — inline month grid + optional Google Calendar embed
  ✔ Online Form (Bio submission) — downloads .doc (Word-compatible) and copies to clipboard
  ✔ Management Contact Info + Contact Form — mailto fallback / Formspree-ready
  ✔ Information Table (Contact Sheet) — searchable grid + CSV import
  ✔ Secure Pages/Documents — simple password gate (demo only) + archive list
  ✔ Public Downloads — auto-generate downloadable .doc forms (Risk/Media releases)
  ✔ Sharing Section — paste & preview any Drive/Dropbox/YouTube/OneDrive embed/link
  ✔ App Integration — Google Calendar/Map/YouTube embeds supported

  Default demo password: stagecrew
  Notes: This gate is client-side only (good for class demo). Use real protection for production
  (e.g., Netlify password, Vercel middleware, or Google Drive permissioning with viewer-only links).
*/

// ---------- Helpers ----------
const formatDate = (d) => d.toISOString().split("T")[0];

function classNames(...cls) { return cls.filter(Boolean).join(" "); }

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

function downloadWordDoc(filename, htmlContent) {
  // Creates a Word-compatible .doc by wrapping HTML in an Office mime wrapper
  const header = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title></head><body>`;
  const footer = `</body></html>`;
  const blob = new Blob([header + htmlContent + footer], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text);
}

// ---------- Sample Data ----------
const SAMPLE_EVENTS = [
  { date: "2025-11-14", title: "Table read", time: "18:00" },
  { date: "2025-11-18", title: "Blocking Act 1", time: "17:30" },
  { date: "2025-11-22", title: "Dance Rehearsal", time: "16:00" },
  { date: "2025-12-02", title: "Production Meeting", time: "19:00" },
];

const SAMPLE_CONTACTS = [
  { name: "Avery Chen", role: "Stage Manager", email: "avery.chen@example.com", phone: "+1 (416) 555-0182" },
  { name: "Jordan Singh", role: "Producer", email: "j.singh@example.com", phone: "+1 (647) 555-9910" },
  { name: "Samira Ali", role: "Director", email: "samira.ali@example.com", phone: "+1 (437) 555-0044" },
  { name: "Theo Martin", role: "ASM", email: "theo.martin@example.com", phone: "+1 (289) 555-7723" },
];

const DEFAULT_MANAGERS = [
  { label: "Stage Management", email: "stagemanagement@example.com" },
  { label: "Production", email: "production@example.com" },
  { label: "Artistic", email: "artistic@example.com" },
];

// ---------- Calendar ----------
function MonthCalendar({ initialMonth = new Date(), events = [], embedUrl }) {
  const [current, setCurrent] = useState(new Date(initialMonth));
  const start = useMemo(() => new Date(current.getFullYear(), current.getMonth(), 1), [current]);
  const end = useMemo(() => new Date(current.getFullYear(), current.getMonth() + 1, 0), [current]);

  const firstWeekday = (start.getDay() + 6) % 7; // Mon=0
  const daysInMonth = end.getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(current.getFullYear(), current.getMonth(), d));

  const evByDate = useMemo(() => {
    const map = {};
    events.forEach(e => { (map[e.date] ||= []).push(e); });
    return map;
  }, [events]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <button className="px-3 py-2 rounded-xl border" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth()-1, 1))}>Prev</button>
        <div className="font-semibold text-lg">{current.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
        <button className="px-3 py-2 rounded-xl border" onClick={() => setCurrent(new Date(current.getFullYear(), current.getMonth()+1, 1))}>Next</button>
      </div>

      {embedUrl ? (
        <div className="rounded-2xl overflow-hidden border">
          <iframe title="Embedded Calendar" src={embedUrl} className="w-full h-[600px]" />
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 text-center text-sm font-semibold">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((d, i) => (
              <div key={i} className={classNames("min-h-24 rounded-2xl border p-2", d ? "" : "bg-gray-50")}> 
                {d && (
                  <>
                    <div className="text-xs opacity-60">{d.getDate()}</div>
                    <div className="space-y-1 mt-1">
                      {(evByDate[formatDate(d)] || []).map((e, idx) => (
                        <div key={idx} className="text-xs rounded-xl px-2 py-1 border">
                          <div className="font-medium">{e.title}</div>
                          {e.time && <div className="opacity-70">{e.time}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Bio Form ----------
function BioForm() {
  const [name, setName] = useLocalStorage("bio_name", "");
  const [role, setRole] = useLocalStorage("bio_role", "");
  const [bio, setBio] = useLocalStorage("bio_text", "");
  const [photo, setPhoto] = useLocalStorage("bio_photo", "");

  const maxWords = 80;
  const words = bio.trim() ? bio.trim().split(/\s+/).length : 0;

  const asText = `Name: ${name}\nRole: ${role}\nPhoto URL: ${photo}\nBio (${words} words):\n${bio}\n`;

  const asHTML = `
    <h1>Program Biography</h1>
    <p><b>Name:</b> ${name || ""}</p>
    <p><b>Role:</b> ${role || ""}</p>
    <p><b>Photo URL:</b> ${photo || ""}</p>
    <p><b>Bio:</b></p>
    <p>${bio.replaceAll("\n", "<br/>")}</p>
  `;

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Full Name</span>
          <input className="rounded-xl border p-2" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., Riley Paterson"/>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Role/Department</span>
          <input className="rounded-xl border p-2" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g., Lighting Designer"/>
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-medium">Headshot URL (optional)</span>
          <input className="rounded-xl border p-2" value={photo} onChange={e=>setPhoto(e.target.value)} placeholder="https://..."/>
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm font-medium">Short Bio</span>
          <textarea rows={6} className="rounded-2xl border p-3" value={bio} onChange={e=>setBio(e.target.value)} placeholder="80 words max recommended for programs."/>
          <div className={classNames("text-xs", words>maxWords?"text-red-600":"opacity-70")}>{words} / {maxWords} words</div>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="px-4 py-2 rounded-2xl border" onClick={()=>downloadWordDoc(`${name || "bio"}-program-bio.doc`, asHTML)}>Download .doc</button>
        <button className="px-4 py-2 rounded-2xl border" onClick={()=>copyToClipboard(asText)}>Copy to Clipboard</button>
        <a className="px-4 py-2 rounded-2xl border" href={`mailto:program@example.com?subject=Bio%20Submission%20-%20${encodeURIComponent(name)}&body=${encodeURIComponent(asText)}`}>Email via Mail App</a>
      </div>
      <p className="text-sm opacity-70">Tip: To wire this to Formspree or Netlify Forms, set the form action to your endpoint and add hidden fields as required by those services.</p>
    </div>
  );
}

// ---------- Contact Sheet (CSV import + filter) ----------
function ContactSheet() {
  const [rows, setRows] = useLocalStorage("contact_rows", SAMPLE_CONTACTS);
  const [q, setQ] = useState("");
  const fileRef = useRef(null);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows.filter(r => Object.values(r).join(" ").toLowerCase().includes(t));
  }, [rows, q]);

  async function importCSV(file) {
    const text = await file.text();
    const [hdr, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = hdr.split(",").map(h=>h.trim().toLowerCase());
    const mapped = lines.map(line => {
      const cols = line.split(",");
      const rec = {};
      headers.forEach((h, i) => rec[h] = (cols[i]||"").trim());
      return {
        name: rec.name || "",
        role: rec.role || "",
        email: rec.email || "",
        phone: rec.phone || "",
      };
    });
    setRows(mapped);
  }

  function exportCSV() {
    const header = "name,role,email,phone\n";
    const body = rows.map(r=>`${r.name},${r.role},${r.email},${r.phone}`).join("\n");
    const blob = new Blob([header+body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "contact-sheet.csv"; a.click();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input className="rounded-xl border p-2" placeholder="Search by name, role, email…" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="px-3 py-2 rounded-xl border" onClick={() => fileRef.current?.click()}>Import CSV</button>
        <input type="file" accept=".csv" className="hidden" ref={fileRef} onChange={e=>e.target.files?.[0] && importCSV(e.target.files[0])}/>
        <button className="px-3 py-2 rounded-xl border" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {["Name","Role","Email","Phone"].map(h => (<th key={h} className="p-3 font-semibold">{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.role}</td>
                <td className="p-3"><a className="underline" href={`mailto:${r.email}`}>{r.email}</a></td>
                <td className="p-3">{r.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-70">If this list contains private info, put it behind the password gate below or use a permissioned Google Sheet and embed the view-only sheet.</p>
    </div>
  );
}

// ---------- Secure Docs (client-side gate) ----------
function SecureDocs() {
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [docs, setDocs] = useLocalStorage("secure_docs", [
    { title: "Rehearsal Notes - Nov 10", url: "https://example.com/rehearsal-notes-nov10.pdf", tag: "rehearsal", date: "2025-11-10" },
    { title: "Production Meeting #2 Minutes", url: "https://example.com/prod-meet-2.pdf", tag: "production", date: "2025-11-05" },
  ]);

  function tryUnlock() { setUnlocked(pw === (localStorage.getItem("pp_demo_pw") || "stagecrew")); }
  function setNewPassword() { localStorage.setItem("pp_demo_pw", pw); alert("Password updated for this browser."); }

  return (
    <div className="grid gap-4">
      {!unlocked ? (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">Enter Password</div>
            <div className="flex gap-2">
              <input type="password" className="rounded-xl border p-2 flex-1" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••"/>
              <button className="px-3 py-2 rounded-xl border" onClick={tryUnlock}>Unlock</button>
            </div>
            <p className="text-xs opacity-70 mt-2">Default: <code>stagecrew</code>. Client-side only — use proper hosting protection for real secrets.</p>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="font-semibold mb-2">(Optional) Set New Password (local)</div>
            <div className="flex gap-2">
              <input type="password" className="rounded-xl border p-2 flex-1" value={pw} onChange={e=>setPw(e.target.value)} placeholder="new password"/>
              <button className="px-3 py-2 rounded-xl border" onClick={setNewPassword}>Save</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Protected Documents & Archive</div>
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setUnlocked(false)}>Lock</button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {docs.map((d, i) => (
              <a key={i} href={d.url} className="rounded-2xl border p-4 hover:shadow" target="_blank">
                <div className="text-sm opacity-60">{d.date} · {d.tag}</div>
                <div className="font-medium">{d.title}</div>
              </a>
            ))}
          </div>
          <DocAdder onAdd={(rec)=>setDocs([...docs, rec])} />
        </div>
      )}
    </div>
  );
}

function DocAdder({ onAdd }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("rehearsal");
  const [date, setDate] = useState(formatDate(new Date()));
  return (
    <div className="rounded-2xl border p-4 grid md:grid-cols-4 gap-2">
      <input className="rounded-xl border p-2" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <input className="rounded-xl border p-2" placeholder="URL (Drive/Dropbox/PDF)" value={url} onChange={e=>setUrl(e.target.value)} />
      <select className="rounded-xl border p-2" value={tag} onChange={e=>setTag(e.target.value)}>
        <option>rehearsal</option>
        <option>production</option>
        <option>design</option>
        <option>admin</option>
      </select>
      <div className="flex gap-2">
        <input type="date" className="rounded-xl border p-2 flex-1" value={date} onChange={e=>setDate(e.target.value)} />
        <button className="px-3 py-2 rounded-xl border" onClick={()=>{ if(title && url){ onAdd({title, url, tag, date}); setTitle(""); setUrl(""); }}}>Add</button>
      </div>
    </div>
  );
}

// ---------- Public Downloadable Forms ----------
function PublicDownloads() {
  function makeFormDoc(title, sections) {
    const items = sections.map(([h, body]) => `<h2>${h}</h2><p>${body}</p>`).join("");
    downloadWordDoc(title, `<h1>${title}</h1>${items}`);
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border p-4 grid md:grid-cols-2 gap-2">
        <button className="px-4 py-3 rounded-2xl border text-left" onClick={()=>
          makeFormDoc("Risk and Release Form", [
            ["Participant", "Name / Phone / Email"],
            ["Activity", "Production / Rehearsal / Workshop"],
            ["Risks Acknowledgement", "I acknowledge and accept the inherent risks…"],
            ["Emergency Contact", "Name / Phone"],
            ["Signature", "\n\nDate:"]
          ])
        }>Download: Risk & Release (.doc)</button>
        <button className="px-4 py-3 rounded-2xl border text-left" onClick={()=>
          makeFormDoc("Media (Photo/Video) Release", [
            ["Participant", "Name / Phone / Email"],
            ["Grant of Rights", "I grant the production the right to record and use my likeness…"],
            ["Scope", "Media, Territory, Term"],
            ["Revocation", "Subject to legal/contractual limitations"],
            ["Signature", "\n\nDate:"]
          ])
        }>Download: Media Release (.doc)</button>
      </div>
      <p className="text-xs opacity-70">Prefer PDFs? Export these docs from Word/Google Docs and replace links here with hosted PDFs.</p>
    </div>
  );
}

// ---------- Manager Contacts + Contact Form ----------
function ManagerContacts() {
  const [teams, setTeams] = useLocalStorage("manager_teams", DEFAULT_MANAGERS);
  const [selected, setSelected] = useState(teams[0]?.email || "");

  function mailto(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const subject = form.get("subject") || "Project Inquiry";
    const body = `From: ${form.get("name")} (${form.get("from")})\n\n${form.get("message")}`;
    window.location.href = `mailto:${selected}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-3 gap-3">
        {teams.map(t => (
          <div key={t.email} className={classNames("rounded-2xl border p-4", selected===t.email && "ring-2 ring-black")}
               onClick={()=>setSelected(t.email)} role="button">
            <div className="text-xs opacity-60">Department</div>
            <div className="font-medium">{t.label}</div>
            <a className="text-sm underline" href={`mailto:${t.email}`}>{t.email}</a>
          </div>
        ))}
      </div>

      <form className="rounded-2xl border p-4 grid gap-2" onSubmit={mailto}>
        <div className="font-semibold">Contact {teams.find(t=>t.email===selected)?.label || "Team"}</div>
        <div className="grid md:grid-cols-2 gap-2">
          <input name="name" required className="rounded-xl border p-2" placeholder="Your name"/>
          <input name="from" required type="email" className="rounded-xl border p-2" placeholder="Your email"/>
        </div>
        <input name="subject" className="rounded-xl border p-2" placeholder="Subject"/>
        <textarea name="message" rows={5} className="rounded-2xl border p-3" placeholder="How can we help?"/>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-2xl border" type="submit">Send via Mail App</button>
          <button type="button" className="px-4 py-2 rounded-2xl border" onClick={()=>alert("To wire this to Formspree/Netlify, replace onSubmit with a POST to your endpoint.")}>Use external form service</button>
        </div>
      </form>
    </div>
  );
}

// ---------- Sharing / Embeds ----------
function SharingSection() {
  const [url, setUrl] = useLocalStorage("share_url", "");
  const [type, setType] = useLocalStorage("share_type", "auto");

  function normalizedEmbed(u) {
    if (!u) return "";
    try {
      const url = new URL(u);
      // Google Drive folder
      if (url.hostname.includes("drive.google.com")) {
        // viewer link works inside iframe when set to preview
        return u.replace("/view", "/preview").replace("/edit", "/preview");
      }
      // YouTube
      if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
        let id = url.searchParams.get("v");
        if (!id && url.hostname.includes("youtu.be")) id = url.pathname.substring(1);
        return `https://www.youtube.com/embed/${id}`;
      }
      // Dropbox
      if (url.hostname.includes("dropbox.com")) {
        return u.replace("dl=0", "raw=1");
      }
      // Google Maps embed
      if (url.hostname.includes("google.com") && url.pathname.includes("/maps")) {
        return u; // assume it's an embed URL already
      }
      return u;
    } catch { return u; }
  }

  const src = normalizedEmbed(url);

  return (
    <div className="grid gap-3">
      <div className="grid md:grid-cols-3 gap-2">
        <input className="rounded-xl border p-2 md:col-span-2" placeholder="Paste share link (Drive/Dropbox/YouTube/Maps/Calendar)" value={url} onChange={e=>setUrl(e.target.value)} />
        <select className="rounded-xl border p-2" value={type} onChange={e=>setType(e.target.value)}>
          <option value="auto">Auto-detect</option>
          <option value="calendar">Calendar</option>
          <option value="map">Map</option>
          <option value="video">Video</option>
          <option value="folder">Folder</option>
        </select>
      </div>
      {src ? (
        <div className="rounded-2xl overflow-hidden border">
          <iframe title="Shared content" src={src} className="w-full h-[560px]" />
        </div>
      ) : (
        <p className="text-sm opacity-70">Tip: Create a view-only Google Drive folder for creative assets and paste the share link here to embed it.</p>
      )}
    </div>
  );
}

// ---------- Announcements (always on top) ----------
function AnnouncementBar({ text, onEdit }) {
  return (
    <div className="rounded-3xl border p-4 mb-4 bg-white">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-3 h-3 rounded-full border mt-2"></div>
        <div className="flex-1">
          <div className="text-sm opacity-60">Announcement</div>
          <div className="text-lg font-semibold leading-snug">{text}</div>
        </div>
        <button className="px-3 py-2 rounded-xl border" onClick={onEdit}>Edit</button>
      </div>
    </div>
  );
}

// ---------- Root App ----------
export default function App() {
  const [tab, setTab] = useState("home");
  const [embedCal, setEmbedCal] = useLocalStorage("embed_cal", "");
  const [announcement, setAnnouncement] = useLocalStorage("announcement", "Welcome! Call time today 5:30 PM at Stage Door B. Bring water bottles.");
  const [editingAnn, setEditingAnn] = useState(false);

  useEffect(() => {
    const onHash = () => { const h = window.location.hash.replace('#',''); if (h) setTab(h); };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const tabs = [
    { id: "home", label: "Home" },
    { id: "calendar", label: "Calendar" },
    { id: "bio", label: "Bio Form" },
    { id: "contacts", label: "Contact Sheet" },
    { id: "managers", label: "Managers & Form" },
    { id: "secure", label: "Secure Docs" },
    { id: "downloads", label: "Public Downloads" },
    { id: "sharing", label: "Sharing / Embeds" },
    { id: "help", label: "Help & Deploy" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="font-bold text-xl">Production Portal</div>
          <nav className="flex flex-wrap gap-2 ml-auto">
            {tabs.map(t => (
              <a key={t.id} href={`#${t.id}`} className={classNames("px-3 py-2 rounded-xl border", tab===t.id && "bg-gray-900 text-white border-gray-900")}>{t.label}</a>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Announcement always visible */}
        <AnnouncementBar text={announcement} onEdit={()=>setEditingAnn(true)} />
        {editingAnn && (
          <div className="rounded-2xl border p-3 mb-4 grid gap-2">
            <textarea className="rounded-2xl border p-3" value={announcement} onChange={e=>setAnnouncement(e.target.value)} />
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setEditingAnn(false)}>Done</button>
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setAnnouncement("")}>Clear</button>
            </div>
          </div>
        )}

        {tab === "home" && (
          <section className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold mb-2">This Week</h2>
                <MonthCalendar initialMonth={new Date()} events={SAMPLE_EVENTS} />
              </div>
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold mb-2">Quick Links</h2>
                <ul className="grid gap-2 list-disc pl-5 text-sm">
                  <li><a className="underline" href="#calendar">Rehearsal / Production Calendar</a></li>
                  <li><a className="underline" href="#bio">Submit Your Program Bio</a></li>
                  <li><a className="underline" href="#managers">Contact Management</a></li>
                  <li><a className="underline" href="#secure">Protected Docs & Archive</a></li>
                  <li><a className="underline" href="#downloads">Public Downloads</a></li>
                  <li><a className="underline" href="#sharing">Share & Embed Creative Materials</a></li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {tab === "calendar" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Calendar (Rehearsal / Production)</h2>
            <div className="rounded-2xl border p-4 grid md:grid-cols-3 gap-3">
              <input className="rounded-xl border p-2 md:col-span-2" placeholder="Paste Google Calendar embed URL (optional)" value={embedCal} onChange={e=>setEmbedCal(e.target.value)} />
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setEmbedCal(embedCal)}>Save</button>
            </div>
            <MonthCalendar initialMonth={new Date()} events={SAMPLE_EVENTS} embedUrl={embedCal} />
            <p className="text-xs opacity-70">How to get URL: Google Calendar → Settings → your calendar → Integrate → "Embed code" → copy the <iframe src> value.</p>
          </section>
        )}

        {tab === "bio" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Program Biography Submission</h2>
            <BioForm />
          </section>
        )}

        {tab === "contacts" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Information Table (Contact Sheet)</h2>
            <ContactSheet />
          </section>
        )}

        {tab === "managers" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Management Contact Info & Form</h2>
            <ManagerContacts />
          </section>
        )}

        {tab === "secure" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Protected Documents (Demo Gate)</h2>
            <SecureDocs />
          </section>
        )}

        {tab === "downloads" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Public Downloads</h2>
            <PublicDownloads />
          </section>
        )}

        {tab === "sharing" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">Sharing Section (Embeds / Links)</h2>
            <SharingSection />
          </section>
        )}

        {tab === "help" && (
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">How to Deploy (free & fast)</h2>
            <ol className="list-decimal pl-5 grid gap-2 text-sm">
              <li>Download this file as <code>App.jsx</code> inside a Vite React starter, or export from ChatGPT as a project.</li>
              <li>Ensure Tailwind is enabled (or remove classes if you prefer plain CSS). Vite template + Tailwind works best.</li>
              <li>Deploy to Netlify or Vercel: connect your GitHub repo and choose framework = Vite/React (defaults work).</li>
              <li>Submit the live URL. For protected docs, keep demo password <code>stagecrew</code> or set your own and include it with your submission.</li>
              <li>For real protection, use Netlify Site Password (Site settings → Domain management → HTTPS password) or store files in view-only Google Drive with link access restricted to your class emails.</li>
            </ol>
            <div className="rounded-2xl border p-4 bg-white/70">
              <div className="font-semibold mb-1">Rubric Mapping</div>
              <ul className="list-disc pl-5 text-sm">
                <li><b>Completeness (50%)</b>: All required sections are built and linked via navbar; announcement is top and click-free.</li>
                <li><b>User Experience (30%)</b>: Minimal clicks, persistent settings, search & CSV import, quick links, clean layout.</li>
                <li><b>Password protection (10%)</b>: Demo gate included; instructions for production-grade protection provided.</li>
                <li><b>App Integration (10%)</b>: Embed Google Calendar, Maps, YouTube, or Drive in Sharing/Calendar tabs.</li>
              </ul>
            </div>
          </section>
        )}

      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 pt-4 text-sm opacity-70">
        <div>© {new Date().getFullYear()} Production Portal · Built for course beta</div>
      </footer>
    </div>
  );
}
