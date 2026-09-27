'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Check, ChevronDown, Clock3, ExternalLink, Image as ImageIcon, LayoutDashboard, Link2, Menu, MessageSquareText, MoreHorizontal, Plus, Search, Send, Settings, Sparkles, Users, X } from 'lucide-react';

type Channel = { id: string; name: string; handle: string; color: string; mark: string; connected: boolean };
type QueuedPost = { id: number; date: string; month: string; title: string; time: string; channels: string[]; status: 'Scheduled' | 'Draft' };
type ScheduleToolInput = { copy?: unknown; channels?: unknown; publishAt?: unknown };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: ScheduleToolInput) => object }) => void | Promise<void> };

const channels: Channel[] = [
  { id: 'instagram', name: 'Instagram', handle: '@spiralcomics', color: '#e84778', mark: '◎', connected: true },
  { id: 'facebook', name: 'Facebook', handle: 'Spiral Comics', color: '#3777df', mark: 'f', connected: true },
  { id: 'x', name: 'X / Twitter', handle: '@spiralcomics', color: '#171717', mark: 'X', connected: true },
  { id: 'bluesky', name: 'Bluesky', handle: 'Not connected', color: '#198df3', mark: '☁', connected: false },
];

const initialQueue: QueuedPost[] = [
  { id: 1, date: '28', month: 'SEP', title: 'Sunday sketchbook: the making of issue #12', time: '9:00 AM', channels: ['instagram', 'facebook'], status: 'Scheduled' },
  { id: 2, date: '30', month: 'SEP', title: 'New release day — The Neon Ranger #4', time: '11:30 AM', channels: ['instagram', 'facebook', 'x'], status: 'Scheduled' },
  { id: 3, date: '02', month: 'OCT', title: 'Behind the panels with Maria Chen', time: 'Draft', channels: ['instagram'], status: 'Draft' },
];

function ChannelMark({ id, small = false }: { id: string; small?: boolean }) {
  const channel = channels.find((item) => item.id === id)!;
  return <span className={`channel-mark ${small ? 'channel-mark-small' : ''}`} style={{ background: channel.color }} aria-label={channel.name}>{channel.mark}</span>;
}

export default function Home() {
  const [selected, setSelected] = useState(['instagram', 'facebook', 'x']);
  const [copy, setCopy] = useState('');
  const [link, setLink] = useState('');
  const [mode, setMode] = useState<'now' | 'later'>('later');
  const [date, setDate] = useState('2026-09-30');
  const [time, setTime] = useState('11:30');
  const [queue, setQueue] = useState(initialQueue);
  const [notice, setNotice] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const characterLimit = selected.includes('x') ? 280 : 2200;
  const canSubmit = copy.trim().length > 0 && selected.length > 0;
  const connectedCount = channels.filter((channel) => channel.connected).length;
  const previewText = useMemo(() => copy || 'Your post preview will appear here as you write.', [copy]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;

    void Promise.resolve(context.registerTool({
      name: 'schedule_social_post',
      title: 'Schedule social post',
      description: 'Schedule one Spiral Comics post to one or more connected social accounts and add it to the visible content queue.',
      inputSchema: {
        type: 'object',
        properties: {
          copy: { type: 'string', minLength: 1, maxLength: 280 },
          channels: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['instagram', 'facebook', 'x'] } },
          publishAt: { type: 'string', description: 'Local ISO date and time, for example 2026-09-30T11:30' },
        },
        required: ['copy', 'channels', 'publishAt'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (typeof input.copy !== 'string' || !input.copy.trim()) throw new Error('Post copy is required.');
        if (!Array.isArray(input.channels) || input.channels.length === 0 || input.channels.some((id) => !['instagram', 'facebook', 'x'].includes(String(id)))) throw new Error('Choose at least one connected channel.');
        if (typeof input.publishAt !== 'string') throw new Error('A publish date and time is required.');
        const scheduledDate = new Date(input.publishAt);
        if (Number.isNaN(scheduledDate.getTime())) throw new Error('The publish date and time is invalid.');
        const newPost: QueuedPost = {
          id: Date.now(),
          date: String(scheduledDate.getDate()).padStart(2, '0'),
          month: scheduledDate.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
          title: input.copy.trim(),
          time: scheduledDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }),
          channels: input.channels.map(String),
          status: 'Scheduled',
        };
        setQueue((current) => [...current, newPost]);
        setNotice('Post added to the schedule.');
        return { id: newPost.id, status: 'scheduled', channels: newPost.channels, publishAt: input.publishAt };
      },
    })).catch(() => undefined);
  }, []);

  function toggleChannel(id: string) {
    const channel = channels.find((item) => item.id === id);
    if (!channel?.connected) { setNotice(`${channel?.name} needs to be connected first.`); return; }
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveDraft() {
    if (!copy.trim()) { setNotice('Add a little copy before saving your draft.'); return; }
    setQueue((current) => [...current, { id: Date.now(), date: '—', month: 'DRAFT', title: copy.trim(), time: 'Not scheduled', channels: selected, status: 'Draft' }]);
    setNotice('Draft saved to your content queue.');
  }

  function submitPost() {
    if (!canSubmit) { setNotice('Choose a connected account and add some post copy.'); return; }
    if (mode === 'now') { setNotice(`Post ready to publish to ${selected.length} account${selected.length === 1 ? '' : 's'}. Connect API credentials to send it live.`); return; }
    const scheduledDate = new Date(`${date}T${time}`);
    const invalid = Number.isNaN(scheduledDate.getTime());
    setQueue((current) => [...current, { id: Date.now(), date: invalid ? '—' : String(scheduledDate.getDate()).padStart(2, '0'), month: invalid ? 'DATE' : scheduledDate.toLocaleString('en-US', { month: 'short' }).toUpperCase(), title: copy.trim(), time: invalid ? 'Time needed' : scheduledDate.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }), channels: selected, status: 'Scheduled' }]);
    setCopy(''); setLink(''); setNotice('Post added to the schedule.');
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span>S</span></div><div><strong>POSTMASTER</strong><small>by Spiral Comics</small></div></div>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="#overview"><LayoutDashboard size={18} /> Overview</a><a href="#compose" className="active"><MessageSquareText size={18} /> Compose</a><a href="#queue"><CalendarClock size={18} /> Content queue <span className="nav-count">{queue.length}</span></a><a href="#audience"><Users size={18} /> Audience</a>
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-label"><span>CONNECTED ACCOUNTS</span><button aria-label="Add account"><Plus size={15} /></button></div>
          {channels.map((channel) => <button className="account-row" key={channel.id} onClick={() => toggleChannel(channel.id)}><ChannelMark id={channel.id} /><span><strong>{channel.name}</strong><small>{channel.handle}</small></span><i className={channel.connected ? 'status-online' : 'status-offline'} /></button>)}
        </div>
        <div className="sidebar-bottom"><a href="#settings"><Settings size={18} /> Settings</a><div className="profile"><div className="avatar">SC</div><div><strong>Spiral Comics</strong><small>{connectedCount} accounts connected</small></div><MoreHorizontal size={18} /></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle navigation"><Menu size={21} /></button><div><p>SPIRAL COMICS</p><h1>Good afternoon, Rich.</h1></div><div className="top-actions"><button aria-label="Search"><Search size={19} /></button><button aria-label="Notifications"><Bell size={19} /><span /></button><button className="new-post"><Plus size={16} /> New post</button></div></header>
        <div className="content" id="compose">
          <div className="page-heading"><div><p className="eyebrow">CREATE & PUBLISH</p><h2>Compose a post</h2><p>Write once, then share everywhere your readers are.</p></div><button className="draft-button" onClick={saveDraft}>Save draft</button></div>
          <div className="compose-grid">
            <section className="composer-card">
              <div className="field-block"><div className="field-label"><label>Publish to</label><span>{selected.length} of {connectedCount} selected</span></div><div className="channel-pills">{channels.map((channel) => <button key={channel.id} className={`${selected.includes(channel.id) ? 'selected' : ''} ${!channel.connected ? 'disabled' : ''}`} onClick={() => toggleChannel(channel.id)} aria-pressed={selected.includes(channel.id)}><ChannelMark id={channel.id} small /> {channel.name}{selected.includes(channel.id) && <Check size={14} />}</button>)}</div></div>
              <div className="field-block copy-field"><div className="field-label"><label htmlFor="post-copy">Post copy</label><span>{copy.length} / {characterLimit}</span></div><textarea id="post-copy" value={copy} maxLength={characterLimit} onChange={(event) => setCopy(event.target.value)} placeholder="What’s happening at Spiral Comics?" /><div className="editor-tools"><div><button title="Add image"><ImageIcon size={18} /></button><button title="Add link"><Link2 size={18} /></button><button title="Improve copy"><Sparkles size={18} /></button></div><span>Tip: posts with images get more engagement.</span></div></div>
              <div className="field-block"><div className="field-label"><label htmlFor="post-link">Link <em>Optional</em></label></div><div className="link-input"><Link2 size={17} /><input id="post-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://spiralcomics.com/..." />{link && <button onClick={() => setLink('')} aria-label="Clear link"><X size={15} /></button>}</div></div>
              <div className="field-block schedule-block"><div className="field-label"><label>When should this go out?</label></div><div className="mode-switch"><button className={mode === 'now' ? 'active' : ''} onClick={() => setMode('now')}><Send size={16} /> Publish now</button><button className={mode === 'later' ? 'active' : ''} onClick={() => setMode('later')}><Clock3 size={16} /> Schedule for later</button></div>{mode === 'later' && <div className="date-row"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /><span>Pacific Time</span></div>}</div>
              <div className="composer-footer"><p><span /> All selected accounts are ready</p><button className="schedule-button" onClick={submitPost}>{mode === 'later' ? <><CalendarClock size={17} /> Schedule post</> : <><Send size={17} /> Publish post</>}</button></div>
            </section>

            <aside className="preview-panel"><div className="preview-heading"><div><h3>Post preview</h3><span>Instagram</span></div><button><MoreHorizontal size={18} /></button></div><div className="social-preview"><div className="preview-user"><div className="spiral-avatar">S</div><div><strong>spiralcomics</strong><small>Sponsored · <span>◎</span></small></div><MoreHorizontal size={17} /></div><div className="preview-art"><div className="art-lines"><span /><span /><span /></div><div className="art-word">SPIRAL</div><small>COMICS · STORIES THAT PULL YOU IN</small></div><div className="preview-actions"><span>♡</span><span>◯</span><span>⌁</span><span className="save-icon">▱</span></div><div className="preview-copy"><strong>spiralcomics</strong> <span className={!copy ? 'placeholder-copy' : ''}>{previewText}</span>{link && <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer"> {link} <ExternalLink size={11} /></a>}</div><p className="preview-date">SEPTEMBER 30</p></div><p className="preview-note">Preview is approximate. Each network may crop media or links differently.</p></aside>
          </div>
          <section className="queue-section" id="queue"><div className="queue-heading"><div><p className="eyebrow">UP NEXT</p><h2>Content queue</h2></div><button>View calendar <ChevronDown size={15} /></button></div><div className="queue-list">{queue.slice(-4).map((post) => <article className="queue-item" key={post.id}><div className="date-tile"><strong>{post.date}</strong><span>{post.month}</span></div><div className="queue-copy"><h3>{post.title}</h3><p>{post.status === 'Scheduled' ? <><Clock3 size={13} /> {post.time}</> : post.time}</p></div><div className="queue-channels">{post.channels.map((id) => <ChannelMark id={id} small key={id} />)}</div><span className={`post-status ${post.status.toLowerCase()}`}>{post.status}</span><button aria-label={`More options for ${post.title}`}><MoreHorizontal size={18} /></button></article>)}</div></section>
        </div>
      </section>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      {notice && <div className="toast" role="status"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </main>
  );
}
