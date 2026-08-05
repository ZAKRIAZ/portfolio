/* screens.jsx — content screens for the portfolio "game" */
const { useEffect } = React;

/* ---------- shared data ---------- */
const LINKS = {
  email: 'zakariablefkih@gmail.com',
  linkedin: 'https://linkedin.com/in/zakariae-belfkih',
  github: 'https://github.com/ZAKRIAZ',
  x: 'https://x.com/7_akaria',
};

const SKILLS = [
  { name: 'INTEGRATION / AUTOMATION', lv: 5, color: 'alt',
    tags: ['NetSuite', 'Celigo', 'Workato', 'Orderful', 'EDI', 'REST APIs', 'System Integration'] },
  { name: 'BACKEND', lv: 4, color: '',
    tags: ['PHP', 'Laravel', 'Python', 'Node.js', 'Express.js'] },
  { name: 'FRONTEND', lv: 4, color: '',
    tags: ['JavaScript', 'React.js', 'HTML', 'CSS', 'Bootstrap', 'Responsive'] },
  { name: 'DATABASES', lv: 3, color: '',
    tags: ['MySQL', 'MongoDB'] },
  { name: 'TOOLS', lv: 3, color: '',
    tags: ['Git', 'WAMP'] },
  { name: 'AI / AUTOMATION TOOLING', lv: 2, color: 'warn',
    tags: ['Exploring', 'Smart Tools', 'Agents'] },
];
const MAX_LV = 7;

const EXPERIENCE = [
  { title: 'Integration Developer', org: 'LYSI', date: 'MAY 2024 — PRESENT', loc: 'RABAT',
    body: 'Design and maintain integrations & automated data flows between business applications using Celigo, Workato and Orderful — connecting NetSuite, Salesforce, Shopify, Amazon and Walmart through REST APIs and EDI. I eliminate manual work and keep business data flowing reliably.' },
  { title: 'Web Developer — Intern', org: 'ISMOTICA Fes · OFPPT', date: 'DEC 2023 — JAN 2024', loc: 'FES',
    body: 'Built responsive full-stack web apps with JavaScript, React, Node.js, Express, MongoDB and PHP.' },
];

const EDUCATION = [
  { deg: 'Technicien Spécialisé en Développement Digital — Web Full-Stack', school: 'ISMOTICA Fes (OFPPT)' },
  { deg: 'Baccalauréat — Life & Earth Sciences (SVT)', school: 'Charif Al Idriss' },
];

const PROJECTS = [
  { cat: 'INTEGRATION', emo: '⇄ SYNC', name: 'NetSuite ↔ Shopify Sync',
    desc: 'Two-way order & inventory sync between a NetSuite ERP and Shopify, with automated EDI fulfillment out to Amazon & Walmart.',
    role: 'Integration Developer',
    tech: ['Celigo', 'NetSuite', 'Shopify', 'Orderful', 'REST API'] },
  { cat: 'FULL-STACK', emo: '◈ WEB APP', name: 'Full-Stack Web App',
    desc: 'A responsive CRUD web application with auth, dashboard and REST backend — built end-to-end during my internship.',
    role: 'Full-Stack Developer',
    tech: ['React.js', 'Node.js', 'Express', 'MongoDB'] },
  { cat: 'AI', emo: '✦ AI TOOL', name: 'AI Automation Assistant',
    desc: 'A personal AI side-project that turns natural-language requests into automated workflows and smart helpers.',
    role: 'Builder',
    tech: ['Python', 'Node.js', 'AI APIs'] },
];

/* ---------- helpers ---------- */
function ScreenHead({ level, title }) {
  return (
    <>
      <div className="screen-kicker"><Type parts={'LEVEL ' + level} speed={24} cursor={false} /></div>
      <h2 className="screen-head"><Scramble text={title} speed={22} delay={120} /></h2>
    </>
  );
}

function SkillBar({ s }) {
  const segs = [];
  for (let i = 0; i < MAX_LV; i++) segs.push(<span key={i} className={'seg' + (i < s.lv ? ' on' : '')} />);
  return (
    <div className="stat-row">
      <div className="stat-head">
        <span className="stat-name">{s.name}</span>
        <span className="stat-lv">LV.{s.lv}</span>
      </div>
      <div className="bar">{segs}</div>
      <div className="skill-tags">
        {s.tags.map((t) => <span key={t} className={'tag' + (s.color ? ' ' + s.color : '')}>{t}</span>)}
      </div>
    </div>
  );
}

/* ---------- TITLE / MAIN MENU ---------- */
function TitleScreen({ onPick, sfx }) {
  const items = [
    { id: 'about', label: 'ABOUT' },
    { id: 'skills', label: 'SKILLS' },
    { id: 'experience', label: 'EXPERIENCE' },
    { id: 'projects', label: 'PROJECTS' },
    { id: 'contact', label: 'CONTACT' },
    { id: 'options', label: 'OPTIONS' },
  ];
  const [sel, setSel] = React.useState(0);
  const selRef = React.useRef(0);
  selRef.current = sel;

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => (s + 1) % items.length); sfx.move();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (s - 1 + items.length) % items.length); sfx.move();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onPick(items[selRef.current].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="title-wrap">
      <div className="title-badge">RABAT, MOROCCO · OPEN TO REMOTE</div>
      <h1 className="title-name"><Scramble text="ZAKARIAE" speed={28} /><br /><span className="b"><Scramble text="BELFKIH" speed={28} delay={260} /></span></h1>
      <div className="title-sub">INTEGRATION &amp; FULL-STACK DEVELOPER</div>
      <p className="title-tag">Full-stack developer specializing in integrations, automation &amp; ERP connectivity.</p>

      <ul className="menu-list">
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              className={'menu-item' + (i === sel ? ' sel' : '')}
              onClick={() => onPick(it.id)}
              onMouseEnter={() => { setSel(i); sfx.hover(); }}
            >
              <span className="cur">►</span>
              <span className="menu-num">{String(i + 1).padStart(2, '0')}</span>
              {it.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="press-start"><span className="blink">▸ ↑ ↓ + ENTER · OR CLICK A LEVEL ◂</span></div>

      <div className="menu-foot">
        <a className="foot-link" href={LINKS.linkedin} target="_blank" rel="noreferrer">LINKEDIN</a>
        <a className="foot-link" href={LINKS.x} target="_blank" rel="noreferrer">X</a>
        <a className="foot-link" href={LINKS.github} target="_blank" rel="noreferrer">GITHUB</a>
        <a className="foot-link" href={'mailto:' + LINKS.email}>EMAIL</a>
      </div>
    </div>
  );
}

/* ---------- ABOUT ---------- */
function AboutScreen() {
  return (
    <div>
      <ScreenHead level="01" title="PLAYER PROFILE" />

      <p className="lede">
        <Type speed={11} delay={900} parts={[
          { t: "I'm Zakariae, an " },
          { t: "integration developer", b: true },
          { t: " based in Rabat, Morocco. At LYSI I design and maintain integrations and automated data flows between business applications using Celigo, Workato and Orderful — connecting platforms like NetSuite, Salesforce, Shopify, Amazon and Walmart through REST APIs." },
        ]} />
      </p>

      <div className="profile-stats">
        <span className="kv">CLASS · <b>INTEGRATION DEV</b></span>
        <span className="kv">XP · <b>2+ YEARS</b></span>
        <span className="kv">BASE · <b>RABAT, MA</b></span>
        <span className="kv">STATUS · <b>OPEN TO REMOTE</b></span>
      </div>

      <p className="prose" style={{ marginTop: 22 }}>
        Beyond integration work, I'm a <b>full-stack developer</b> — comfortable across PHP/Laravel,
        React.js, Python, Node.js and MySQL — and I spend my own time exploring AI to build smarter
        tools and automations.
      </p>
      <p className="prose">
        I earned a full-stack development diploma (Technicien Spécialisé en Développement Digital)
        and I'm always learning. I care about <b>clean, reliable systems</b> and removing friction
        wherever I find it.
      </p>
    </div>
  );
}

/* ---------- SKILLS ---------- */
function SkillsScreen() {
  return (
    <div>
      <ScreenHead level="02" title="STAT SHEET" />
      <div className="grid-2" style={{ marginTop: 22, alignItems: 'start' }}>
        <div className="panel glow">
          <div className="panel-title">CORE STATS</div>
          {SKILLS.slice(0, 3).map((s) => <SkillBar key={s.name} s={s} />)}
        </div>
        <div className="panel">
          <div className="panel-title">SUPPORT STATS</div>
          {SKILLS.slice(3).map((s) => <SkillBar key={s.name} s={s} />)}
        </div>
      </div>
    </div>
  );
}

/* ---------- EXPERIENCE ---------- */
function ExperienceScreen() {
  return (
    <div>
      <ScreenHead level="03" title="QUEST LOG" />

      <div className="stack" style={{ marginTop: 22, gap: 22 }}>
        {EXPERIENCE.map((q, i) => (
          <div className="quest" key={q.title}>
            <span className="quest-dot" />
            <h3 className="quest-title">{q.title} <span className="quest-org">@ {q.org}</span></h3>
            <div className="quest-meta"><span>{q.date}</span><span>◈ {q.loc}</span></div>
            <p className="quest-body"><Type parts={q.body} speed={10} delay={700 + i * 1300} /></p>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 30 }}>
        <div className="panel-title">EDUCATION</div>
        <div className="grid-2">
          {EDUCATION.map((e) => (
            <div className="edu-card" key={e.deg}>
              <p className="edu-deg">{e.deg}</p>
              <div className="edu-school">{e.school}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- PROJECTS ---------- */
function ProjectsScreen({ sfx }) {
  return (
    <div>
      <ScreenHead level="04" title="SELECT A CARTRIDGE" />
      <p className="prose" style={{ margin: '0 0 22px' }}>
        <Type parts="Featured builds across my three specialties. Live links coming online soon." speed={11} delay={650} />
      </p>

      <div className="grid-3">
        {PROJECTS.map((p) => (
          <div className="cart" key={p.name}>
            <div className="cart-top">
              <span className="cart-cat">{p.cat}</span>
              <span className="cart-emo">{p.emo}</span>
            </div>
            <div className="cart-body">
              <h3 className="cart-name">{p.name}</h3>
              <p className="cart-desc">{p.desc}</p>
              <div className="cart-role">ROLE · <b>{p.role}</b></div>
              <div className="cart-tech">{p.tech.map((t) => <span key={t}>{t}</span>)}</div>
              <div className="cart-links">
                <button className="btn locked" disabled onMouseEnter={() => sfx.hover()}>CODE · SOON</button>
                <button className="btn locked" disabled>DEMO · SOON</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- CONTACT ---------- */
function ContactScreen({ sfx }) {
  return (
    <div>
      <ScreenHead level="05" title="CONTACT" />

      <p className="cta">
        <Type speed={26} delay={550} parts={[
          { t: 'GOT A SYSTEM THAT NEEDS ' },
          { t: 'CONNECTING?', b: true },
          { t: " LET'S TALK." },
        ]} />
      </p>

      <div className="contact-grid">
        <a className="contact-card" href={'mailto:' + LINKS.email} onMouseEnter={() => sfx.hover()}>
          <span className="contact-ico">@</span>
          <span><span className="contact-label">EMAIL</span><span className="contact-val">{LINKS.email}</span></span>
        </a>
        <a className="contact-card" href={LINKS.linkedin} target="_blank" rel="noreferrer" onMouseEnter={() => sfx.hover()}>
          <span className="contact-ico">in</span>
          <span><span className="contact-label">LINKEDIN</span><span className="contact-val">/zakariae-belfkih</span></span>
        </a>
        <a className="contact-card" href={LINKS.github} target="_blank" rel="noreferrer" onMouseEnter={() => sfx.hover()}>
          <span className="contact-ico">{'</>'}</span>
          <span><span className="contact-label">GITHUB</span><span className="contact-val">/ZAKRIAZ</span></span>
        </a>
        <a className="contact-card" href={LINKS.x} target="_blank" rel="noreferrer" onMouseEnter={() => sfx.hover()}>
          <span className="contact-ico">X</span>
          <span><span className="contact-label">X</span><span className="contact-val">@7_akaria</span></span>
        </a>
        <div className="contact-card" style={{ cursor: 'default' }}>
          <span className="contact-ico">◈</span>
          <span><span className="contact-label">LOCATION</span><span className="contact-val">Rabat, Morocco</span></span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  TitleScreen, AboutScreen, SkillsScreen, ExperienceScreen, ProjectsScreen, ContactScreen,
});
