'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Check, Clock3, ExternalLink, Image as ImageIcon, LayoutDashboard, Link2, Menu, MessageSquareText, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Send, Settings, Sparkles, Trash2, Users, X } from 'lucide-react';

type Channel = { id: string; name: string; handle: string; color: string; mark: string; connected: boolean };
type PostStatus = 'Scheduled' | 'Draft' | 'Publishing' | 'Published' | 'Failed' | 'Cancelled';
type QueuedPost = { id: string; date: string; month: string; title: string; time: string; channels: string[]; status: PostStatus; content: string; linkUrl: string; scheduledAt: number | null; error?: string; externalUrl?: string };
type ScheduleToolInput = { copy?: unknown; channels?: unknown; publishAt?: unknown };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: ScheduleToolInput) => object }) => void | Promise<void> };
type MetaSettings = { instagram: { configured: boolean; clientId: string }; threads: { configured: boolean; clientId: string } };

const channelCatalog: Channel[] = [
  { id: 'bluesky', name: 'Bluesky', handle: 'Connect account', color: '#198df3', mark: '☁', connected: false },
  { id: 'instagram', name: 'Instagram', handle: 'Meta setup next', color: '#e84778', mark: '◎', connected: false },
  { id: 'threads', name: 'Threads', handle: 'Meta setup next', color: '#171717', mark: '@', connected: false },
];

function ChannelMark({ id, small = false }: { id: string; small?: boolean }) {
  const channel = channelCatalog.find((item) => item.id === id)!;
  return <span className={`channel-mark ${small ? 'channel-mark-small' : ''}`} style={{ background: channel.color }} aria-label={channel.name}>{channel.mark}</span>;
}

export default function DashboardClient() {
  const [channels, setChannels] = useState(channelCatalog);
  const [selected, setSelected] = useState<string[]>([]);
  const [copy, setCopy] = useState('');
  const [link, setLink] = useState('');
  const [mode, setMode] = useState<'now' | 'later'>('later');
  const [date, setDate] = useState('2026-09-30');
  const [time, setTime] = useState('11:30');
  const [queue, setQueue] = useState<QueuedPost[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [media, setMedia] = useState<{ id: string; filename: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metaSettings, setMetaSettings] = useState<MetaSettings>({ instagram: { configured: false, clientId: '' }, threads: { configured: false, clientId: '' } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({ instagramClientId: '', instagramClientSecret: '', threadsClientId: '', threadsClientSecret: '' });
  const characterLimit = selected.includes('bluesky') ? 300 : 2200;
  const canSubmit = copy.trim().length > 0 && selected.length > 0;
  const connectedCount = channels.filter((channel) => channel.connected).length;
  const previewText = useMemo(() => copy || 'Your post preview will appear here as you write.', [copy]);

  async function loadQueue() {
    try {
      const response = await fetch('/api/posts');
      const data = await response.json() as { posts?: Array<{ id: string; content: string; link_url: string | null; scheduled_at: number | null; status: string }>; deliveries?: Array<{ post_id: string; platform: string; status: string; external_url: string | null; error_message: string | null }>; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load the queue.');
      const deliveries = new Map<string, NonNullable<typeof data.deliveries>>();
      for (const delivery of data.deliveries || []) deliveries.set(delivery.post_id, [...(deliveries.get(delivery.post_id) || []), delivery]);
      const mapped = (data.posts || []).map((post): QueuedPost => {
        const postDeliveries = deliveries.get(post.id) || [];
        const scheduled = post.scheduled_at ? new Date(post.scheduled_at) : null;
        const status = `${post.status.charAt(0).toUpperCase()}${post.status.slice(1)}` as PostStatus;
        return {
          id: post.id,
          date: scheduled ? String(scheduled.getDate()).padStart(2, '0') : '—',
          month: scheduled ? scheduled.toLocaleString('en-US', { month: 'short' }).toUpperCase() : status === 'Draft' ? 'DRAFT' : '—',
          title: post.content,
          content: post.content,
          linkUrl: post.link_url || '',
          scheduledAt: post.scheduled_at,
          time: scheduled ? scheduled.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : status,
          channels: postDeliveries.map((delivery) => delivery.platform),
          status,
          error: postDeliveries.find((delivery) => delivery.error_message)?.error_message || undefined,
          externalUrl: postDeliveries.find((delivery) => delivery.external_url)?.external_url || undefined,
        };
      });
      setQueue(mapped.reverse());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to load the queue.');
    } finally { setQueueLoading(false); }
  }

  async function loadMetaSettings() {
    const response = await fetch('/api/meta/settings');
    if (!response.ok) return;
    const data = await response.json() as MetaSettings;
    setMetaSettings(data);
    setMetaForm((current) => ({ ...current, instagramClientId: data.instagram.clientId, threadsClientId: data.threads.clientId }));
  }

  useEffect(() => {
    void fetch('/api/connections').then(async (response) => response.ok ? await response.json() as { connections: Array<{ platform: string; handle: string }> } : Promise.reject()).then((data) => {
      const connected = new Map(data.connections.map((item) => [item.platform, item.handle]));
      setChannels((current) => current.map((channel) => connected.has(channel.id) ? { ...channel, connected: true, handle: `@${connected.get(channel.id)}` } : channel));
      if (connected.has('bluesky')) setSelected((current) => current.includes('bluesky') ? current : ['bluesky', ...current]);
    }).catch(() => undefined);
    void loadQueue();
    void loadMetaSettings();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'bluesky') setNotice('Bluesky connected securely.');
    if (params.get('connected') === 'instagram') setNotice('Instagram connected securely.');
    if (params.get('connected') === 'threads') setNotice('Threads connected securely.');
    if (params.get('connection_error')) setNotice(params.get('connection_error') || 'Bluesky connection failed.');
  }, []);

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
          channels: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['bluesky', 'instagram', 'threads'] } },
          publishAt: { type: 'string', description: 'Local ISO date and time, for example 2026-09-30T11:30' },
        },
        required: ['copy', 'channels', 'publishAt'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (typeof input.copy !== 'string' || !input.copy.trim()) throw new Error('Post copy is required.');
        if (!Array.isArray(input.channels) || input.channels.length === 0 || input.channels.some((id) => !['bluesky', 'instagram', 'threads'].includes(String(id)))) throw new Error('Choose at least one supported channel.');
        if (typeof input.publishAt !== 'string') throw new Error('A publish date and time is required.');
        const scheduledDate = new Date(input.publishAt);
        if (Number.isNaN(scheduledDate.getTime())) throw new Error('The publish date and time is invalid.');
        const response = await fetch('/api/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: input.copy.trim(), platforms: input.channels, scheduledAt: input.publishAt }) });
        const result = await response.json() as { post?: { id: string }; error?: string };
        if (!response.ok) throw new Error(result.error || 'Unable to schedule the post.');
        await loadQueue();
        setNotice('Post added to the schedule.');
        return { id: result.post?.id, status: 'scheduled', channels: input.channels, publishAt: input.publishAt };
      },
    })).catch(() => undefined);
  }, []);

  function toggleChannel(id: string) {
    const channel = channels.find((item) => item.id === id);
    if (!channel?.connected) {
      if (id === 'bluesky') { window.location.href = '/api/oauth/bluesky/start?handle=spiralcomics.bsky.social'; return; }
      if (id === 'instagram' || id === 'threads') { window.location.href = `/api/oauth/meta/${id}/start`; return; }
      setSettingsOpen(true); setNotice(`Add the ${channel?.name} developer credentials, then connect the account.`); return;
    }
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveMetaSettings() {
    setSubmitting(true);
    try {
      const response = await fetch('/api/meta/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(metaForm) });
      const result = await response.json() as MetaSettings & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to save Meta settings.');
      setMetaSettings(result); setMetaForm((current) => ({ ...current, instagramClientSecret: '', threadsClientSecret: '' })); setSettingsOpen(false); setNotice('Meta developer settings saved securely. Select Instagram or Threads to connect.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save Meta settings.'); }
    finally { setSubmitting(false); }
  }

  async function saveDraft() {
    if (!copy.trim()) { setNotice('Add a little copy before saving your draft.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch(editingId ? `/api/posts/${editingId}` : '/api/posts', { method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: copy, linkUrl: link, platforms: selected, draft: true }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to save the draft.');
      setCopy(''); setLink(''); setMedia(null); setEditingId(null); await loadQueue(); setNotice('Draft saved to your content queue.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save the draft.'); }
    finally { setSubmitting(false); }
  }

  async function submitPost() {
    if (!canSubmit) { setNotice('Choose a connected account and add some post copy.'); return; }
    const scheduledDate = new Date(`${date}T${time}`);
    if (mode === 'later' && Number.isNaN(scheduledDate.getTime())) { setNotice('Choose a valid publishing date and time.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch(editingId ? `/api/posts/${editingId}` : '/api/posts', { method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: copy, linkUrl: link, mediaId: media?.id, platforms: selected, scheduledAt: mode === 'later' ? scheduledDate.toISOString() : null, publishNow: mode === 'now' }) });
      const result = await response.json() as { post?: { id: string }; bluesky?: { status?: string }; error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to save the post.');
      setCopy(''); setLink(''); setMedia(null); setEditingId(null); await loadQueue(); setNotice(mode === 'now' ? 'Post published to Bluesky.' : 'Post added to the durable schedule.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save the post.'); }
    finally { setSubmitting(false); }
  }

  function editPost(post: QueuedPost) {
    setEditingId(post.id); setCopy(post.content); setLink(post.linkUrl); setSelected(post.channels);
    if (post.scheduledAt) { const scheduled = new Date(post.scheduledAt); setDate(scheduled.toLocaleDateString('en-CA')); setTime(`${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`); setMode('later'); }
    else setMode('later');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setNotice('Post loaded into the composer.');
  }

  async function queueAction(post: QueuedPost, action: 'cancel' | 'retry') {
    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: action === 'cancel' ? 'DELETE' : 'PATCH', headers: { 'content-type': 'application/json' }, body: action === 'retry' ? JSON.stringify({ action: 'retry' }) : undefined });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Unable to ${action} the post.`);
      await loadQueue(); setNotice(action === 'retry' ? 'Post published successfully.' : 'Scheduled post cancelled.');
    } catch (error) { setNotice(error instanceof Error ? error.message : `Unable to ${action} the post.`); }
  }

  async function uploadImage(file: File) {
    const form = new FormData(); form.set('file', file); form.set('altText', 'Spiral Comics post image');
    setNotice('Uploading image…');
    try {
      const response = await fetch('/api/media', { method: 'POST', body: form });
      const result = await response.json() as { media?: { id: string; filename: string }; error?: string };
      if (!response.ok || !result.media) throw new Error(result.error || 'Image upload failed.');
      setMedia(result.media); setNotice('Image attached securely.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Image upload failed.'); }
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
        <div className="sidebar-bottom"><button className="settings-link" onClick={() => setSettingsOpen(true)}><Settings size={18} /> Settings</button><div className="profile"><div className="avatar">SC</div><div><strong>Spiral Comics</strong><small>{connectedCount} accounts connected</small></div><MoreHorizontal size={18} /></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle navigation"><Menu size={21} /></button><div><p>SPIRAL COMICS</p><h1>Good afternoon, Rich.</h1></div><div className="top-actions"><button aria-label="Search"><Search size={19} /></button><button aria-label="Notifications"><Bell size={19} /><span /></button><button className="new-post"><Plus size={16} /> New post</button></div></header>
        <div className="content" id="compose">
          <div className="page-heading"><div><p className="eyebrow">CREATE & PUBLISH</p><h2>{editingId ? 'Edit scheduled post' : 'Compose a post'}</h2><p>{editingId ? 'Update the copy or publishing time, then save your changes.' : 'Write once, then share everywhere your readers are.'}</p></div><button className="draft-button" onClick={() => void saveDraft()}>{editingId ? 'Save as draft' : 'Save draft'}</button></div>
          <div className="compose-grid">
            <section className="composer-card">
              <div className="field-block"><div className="field-label"><label>Publish to</label><span>{selected.length} of {connectedCount} selected</span></div><div className="channel-pills">{channels.map((channel) => <button key={channel.id} className={`${selected.includes(channel.id) ? 'selected' : ''} ${!channel.connected ? 'disabled' : ''}`} onClick={() => toggleChannel(channel.id)} aria-pressed={selected.includes(channel.id)}><ChannelMark id={channel.id} small /> {channel.name}{selected.includes(channel.id) && <Check size={14} />}</button>)}</div></div>
              <div className="field-block copy-field"><div className="field-label"><label htmlFor="post-copy">Post copy</label><span>{copy.length} / {characterLimit}</span></div><textarea id="post-copy" value={copy} maxLength={characterLimit} onChange={(event) => setCopy(event.target.value)} placeholder="What’s happening at Spiral Comics?" />{media && <div className="media-chip"><ImageIcon size={14} /><span>{media.filename}</span><button onClick={() => setMedia(null)} aria-label="Remove image"><X size={13} /></button></div>}<div className="editor-tools"><div><label className="editor-upload" title="Add image"><ImageIcon size={18} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /></label><button title="Add link"><Link2 size={18} /></button><button title="Improve copy"><Sparkles size={18} /></button></div><span>Tip: posts with images get more engagement.</span></div></div>
              <div className="field-block"><div className="field-label"><label htmlFor="post-link">Link <em>Optional</em></label></div><div className="link-input"><Link2 size={17} /><input id="post-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://spiralcomics.com/..." />{link && <button onClick={() => setLink('')} aria-label="Clear link"><X size={15} /></button>}</div></div>
              <div className="field-block schedule-block"><div className="field-label"><label>When should this go out?</label></div><div className="mode-switch"><button className={mode === 'now' ? 'active' : ''} onClick={() => setMode('now')}><Send size={16} /> Publish now</button><button className={mode === 'later' ? 'active' : ''} onClick={() => setMode('later')}><Clock3 size={16} /> Schedule for later</button></div>{mode === 'later' && <div className="date-row"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /><span>Pacific Time</span></div>}</div>
              <div className="composer-footer"><p><span /> {connectedCount ? editingId ? 'Editing a saved post' : 'Connected accounts are ready' : 'Connect Bluesky to begin'}</p><button className="schedule-button" disabled={submitting} onClick={submitPost}>{submitting ? 'Working…' : mode === 'later' ? <><CalendarClock size={17} /> {editingId ? 'Update schedule' : 'Schedule post'}</> : <><Send size={17} /> Publish post</>}</button></div>
            </section>

            <aside className="preview-panel"><div className="preview-heading"><div><h3>Post preview</h3><span>{selected.includes('bluesky') ? 'Bluesky' : 'Instagram'}</span></div><button><MoreHorizontal size={18} /></button></div><div className="social-preview"><div className="preview-user"><div className="spiral-avatar">S</div><div><strong>spiralcomics</strong><small>{selected.includes('bluesky') ? 'spiralcomics.bsky.social' : 'Spiral Comics'} · <span>{selected.includes('bluesky') ? '☁' : '◎'}</span></small></div><MoreHorizontal size={17} /></div><div className="preview-art"><div className="art-lines"><span /><span /><span /></div><div className="art-word">SPIRAL</div><small>COMICS · STORIES THAT PULL YOU IN</small></div><div className="preview-actions"><span>♡</span><span>◯</span><span>⌁</span><span className="save-icon">▱</span></div><div className="preview-copy"><strong>spiralcomics</strong> <span className={!copy ? 'placeholder-copy' : ''}>{previewText}</span>{link && <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer"> {link} <ExternalLink size={11} /></a>}</div><p className="preview-date">SEPTEMBER 30</p></div><p className="preview-note">Preview is approximate. Each network may crop media or links differently.</p></aside>
          </div>
          <section className="queue-section" id="queue"><div className="queue-heading"><div><p className="eyebrow">REAL-TIME STATUS</p><h2>Content queue</h2></div><button onClick={() => void loadQueue()}><RotateCcw size={14} /> Refresh</button></div><div className="queue-list">{queueLoading ? <p className="queue-empty">Loading your posts…</p> : queue.length === 0 ? <p className="queue-empty">No saved posts yet. Your drafts and scheduled Bluesky posts will appear here.</p> : queue.map((post) => <article className="queue-item" key={post.id}><div className="date-tile"><strong>{post.date}</strong><span>{post.month}</span></div><div className="queue-copy"><h3>{post.title}</h3><p>{post.scheduledAt ? <><Clock3 size={13} /> {post.time}</> : post.time}{post.error && <span className="queue-error"> · {post.error}</span>}</p></div><div className="queue-channels">{post.channels.map((id) => <ChannelMark id={id} small key={id} />)}</div><span className={`post-status ${post.status.toLowerCase()}`}>{post.status}</span><div className="queue-actions">{post.externalUrl && <a href={post.externalUrl} target="_blank" rel="noreferrer" title="View on Bluesky"><ExternalLink size={15} /></a>}{['Scheduled', 'Draft', 'Failed'].includes(post.status) && <button onClick={() => editPost(post)} title="Edit post"><Pencil size={15} /></button>}{post.status === 'Failed' && <button onClick={() => void queueAction(post, 'retry')} title="Retry now"><RotateCcw size={15} /></button>}{['Scheduled', 'Draft', 'Failed'].includes(post.status) && <button onClick={() => void queueAction(post, 'cancel')} title="Cancel post"><Trash2 size={15} /></button>}</div></article>)}</div></section>
        </div>
      </section>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSettingsOpen(false); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="meta-settings-title"><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button><p className="eyebrow">META DEVELOPER SETUP</p><h2 id="meta-settings-title">Connect Instagram & Threads</h2><p className="settings-intro">Enter credentials from your Meta developer app. Secrets are encrypted and never displayed again.</p><div className="callback-box"><strong>Instagram redirect URL</strong><code>https://spiral-comics-postmaster.rrobinson81.chatgpt.site/api/oauth/meta/instagram/callback</code><strong>Threads redirect URL</strong><code>https://spiral-comics-postmaster.rrobinson81.chatgpt.site/api/oauth/meta/threads/callback</code></div><div className="settings-grid"><label><span>Instagram App ID</span><input value={metaForm.instagramClientId} onChange={(event) => setMetaForm((current) => ({ ...current, instagramClientId: event.target.value }))} placeholder="Instagram App ID" /></label><label><span>Instagram App Secret</span><input type="password" value={metaForm.instagramClientSecret} onChange={(event) => setMetaForm((current) => ({ ...current, instagramClientSecret: event.target.value }))} placeholder={metaSettings.instagram.configured ? 'Saved — enter only to replace' : 'Instagram App Secret'} /></label><label><span>Threads App ID</span><input value={metaForm.threadsClientId} onChange={(event) => setMetaForm((current) => ({ ...current, threadsClientId: event.target.value }))} placeholder="Threads App ID" /></label><label><span>Threads App Secret</span><input type="password" value={metaForm.threadsClientSecret} onChange={(event) => setMetaForm((current) => ({ ...current, threadsClientSecret: event.target.value }))} placeholder={metaSettings.threads.configured ? 'Saved — enter only to replace' : 'Threads App Secret'} /></label></div><div className="settings-actions"><button onClick={() => setSettingsOpen(false)}>Cancel</button><button className="schedule-button" disabled={submitting} onClick={() => void saveMetaSettings()}>{submitting ? 'Saving…' : 'Save securely'}</button></div></section></div>}
      {notice && <div className="toast" role="status"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </main>
  );
}
