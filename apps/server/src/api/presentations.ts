import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Slide {
  id: string;
  type: 'title' | 'content' | 'bullets' | 'image' | 'code' | 'split';
  title?: string;
  content?: string;
  bullets?: string[];
  code?: { language: string; content: string };
  imageUrl?: string;
  notes?: string;
  background?: string;
}

interface Presentation {
  id: string;
  title: string;
  theme: 'dark' | 'light' | 'hiveclaw';
  slides: Slide[];
  createdAt: string;
  updatedAt: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const presentations: Map<string, Presentation> = new Map();

// ─── Helper: persist to disk ─────────────────────────────────────────────────

function saveToDisk(presDir: string, pres: Presentation): void {
  writeFileSync(join(presDir, `${pres.id}.json`), JSON.stringify(pres, null, 2));
}

// ─── HTML export helper ───────────────────────────────────────────────────────

function buildExportHtml(pres: Presentation): string {
  const isDark = pres.theme !== 'light';
  const bgColor = isDark ? '#0D1117' : '#FFFFFF';
  const textColor = isDark ? '#E6EDF3' : '#1F2328';
  const accentColor = '#FF6B6B';

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const slidesHtml = pres.slides
    .map((slide, i) => {
      let content = '';
      switch (slide.type) {
        case 'title':
          content = `<h1 style="font-size:3em;margin-bottom:0.3em">${escape(slide.title ?? '')}</h1><p style="font-size:1.3em;opacity:0.7">${escape(slide.content ?? '')}</p>`;
          break;
        case 'content':
          content = `<h2 style="font-size:2em;margin-bottom:0.5em">${escape(slide.title ?? '')}</h2><p style="font-size:1.1em;line-height:1.8">${escape(slide.content ?? '')}</p>`;
          break;
        case 'bullets':
          content = `<h2 style="font-size:2em;margin-bottom:0.5em">${escape(slide.title ?? '')}</h2><ul style="font-size:1.1em;line-height:2">${(slide.bullets ?? []).map(b => `<li>${escape(b)}</li>`).join('')}</ul>`;
          break;
        case 'code':
          content = `<h2 style="font-size:1.5em;margin-bottom:0.5em">${escape(slide.title ?? '')}</h2><pre style="background:rgba(0,0,0,0.3);padding:20px;border-radius:8px;overflow-x:auto;font-size:0.9em"><code>${escape(slide.code?.content ?? '')}</code></pre>`;
          break;
        case 'split':
          content = `<div style="display:flex;gap:2em;width:100%;text-align:left"><div style="flex:1"><h2 style="font-size:1.8em;margin-bottom:0.5em">${escape(slide.title ?? '')}</h2><p style="font-size:1em;line-height:1.7">${escape(slide.content ?? '')}</p></div>${slide.imageUrl ? `<div style="flex:1;display:flex;align-items:center;justify-content:center"><img src="${escape(slide.imageUrl)}" style="max-width:100%;border-radius:8px" alt=""/></div>` : ''}</div>`;
          break;
        case 'image':
          content = `<h2 style="font-size:2em;margin-bottom:0.5em">${escape(slide.title ?? '')}</h2>${slide.imageUrl ? `<img src="${escape(slide.imageUrl)}" style="max-height:60vh;border-radius:8px" alt=""/>` : ''}`;
          break;
        default:
          content = `<h2>${escape(slide.title ?? '')}</h2><p>${escape(slide.content ?? '')}</p>`;
      }
      return `<section class="slide" id="slide-${i}">${content}</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(pres.title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;background:${bgColor};color:${textColor};overflow:hidden}
.slide{width:100vw;height:100vh;display:none;align-items:center;justify-content:center;flex-direction:column;padding:10%;text-align:center}
.slide.active{display:flex}
h1,h2{color:${accentColor}}
ul{text-align:left;list-style:none}
ul li::before{content:"→ ";color:${accentColor}}
pre{white-space:pre-wrap;word-break:break-all}
.nav{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:10}
.nav button{padding:8px 16px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.3);color:${textColor};border-radius:6px;cursor:pointer;font-size:14px;transition:background 0.2s}
.nav button:hover{background:rgba(255,107,107,0.2)}
.counter{position:fixed;bottom:24px;left:20px;font-size:13px;opacity:0.5}
</style></head><body>
${slidesHtml}
<div class="nav">
  <button onclick="prev()">←</button>
  <button onclick="next()">→</button>
</div>
<div class="counter" id="counter"></div>
<script>
let current=0;
const slides=document.querySelectorAll('.slide');
function show(i){
  slides.forEach(s=>s.classList.remove('active'));
  if(slides[i])slides[i].classList.add('active');
  document.getElementById('counter').textContent=(i+1)+'/'+slides.length;
}
function next(){if(current<slides.length-1)show(++current);}
function prev(){if(current>0)show(--current);}
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key===' ')next();
  if(e.key==='ArrowLeft')prev();
  if(e.key==='Home')show(current=0);
  if(e.key==='End')show(current=slides.length-1);
});
show(0);
</script></body></html>`;
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerPresentationRoutes(app: FastifyInstance): void {
  const presDir = join(process.env.HOME ?? '/root', '.hiveclaw', 'presentations');
  if (!existsSync(presDir)) mkdirSync(presDir, { recursive: true });

  // Load existing presentations from disk on startup
  try {
    const files = readdirSync(presDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = readFileSync(join(presDir, file), 'utf-8');
        const pres = JSON.parse(raw) as Presentation;
        if (pres.id) presentations.set(pres.id, pres);
      } catch {
        // skip malformed files
      }
    }
  } catch {
    // presDir might not exist yet on first run
  }

  // GET /presentations — list all
  app.get('/presentations', async (_req, reply) => {
    const list = Array.from(presentations.values()).map(p => ({
      id: p.id,
      title: p.title,
      slideCount: p.slides.length,
      theme: p.theme,
      updatedAt: p.updatedAt,
    }));
    return reply.send({ data: list });
  });

  // GET /presentations/:id — full presentation
  app.get<{ Params: { id: string } }>('/presentations/:id', async (req, reply) => {
    const pres = presentations.get(req.params.id);
    if (!pres) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' } });
    }
    return reply.send({ data: pres });
  });

  // POST /presentations — create new
  app.post<{ Body: { title: string; theme?: string } }>('/presentations', async (req, reply) => {
    const { title, theme } = req.body ?? {};
    if (!title) {
      return reply
        .status(400)
        .send({ error: { code: 'VALIDATION', message: 'title required' } });
    }
    const pres: Presentation = {
      id: randomUUID(),
      title,
      theme: (theme as Presentation['theme']) ?? 'hiveclaw',
      slides: [
        {
          id: randomUUID(),
          type: 'title',
          title,
          content: 'Created with HiveClaw',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    presentations.set(pres.id, pres);
    saveToDisk(presDir, pres);
    return reply.status(201).send({ data: pres });
  });

  // PATCH /presentations/:id — update title, theme, and/or slides
  app.patch<{ Params: { id: string }; Body: Partial<Presentation> }>(
    '/presentations/:id',
    async (req, reply) => {
      const pres = presentations.get(req.params.id);
      if (!pres) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' } });
      }
      if (req.body.title) pres.title = req.body.title;
      if (req.body.theme) pres.theme = req.body.theme;
      if (req.body.slides) pres.slides = req.body.slides;
      pres.updatedAt = new Date().toISOString();
      presentations.set(pres.id, pres);
      saveToDisk(presDir, pres);
      return reply.send({ data: pres });
    },
  );

  // DELETE /presentations/:id
  app.delete<{ Params: { id: string } }>('/presentations/:id', async (req, reply) => {
    presentations.delete(req.params.id);
    return reply.send({ data: { deleted: true } });
  });

  // GET /presentations/:id/export — export as self-contained HTML slideshow
  app.get<{ Params: { id: string } }>('/presentations/:id/export', async (req, reply) => {
    const pres = presentations.get(req.params.id);
    if (!pres) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Presentation not found' } });
    }
    const html = buildExportHtml(pres);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(pres.title)}.html"`,
    );
    return reply.send(html);
  });
}
