'use strict';
/* Mitsuyomi — MODE STATIS.
   Di mode ini TIDAK ada server Node.js dan TIDAK ada database: browser
   memanggil layanan data komik langsung, lalu menormalisasi responsnya
   di sisi klien (fungsi norm* di bawah adalah padanan sisi-klien dari
   normalisasi server). Konsekuensinya:
   - Tidak ada cache bersama: tiap pengunjung memanggil layanan data sendiri.
   - Fitur akun NONAKTIF (tidak ada server/database untuk menyimpan akun).
   - Genre khusus member tidak bisa dikunci beneran, hanya disembunyikan
     dari daftar — sama seperti tampilan mode dinamis untuk tamu. */
(function staticMode() {
  const UPSTREAM = 'https://www.sankavollerei.web.id/comic';

  /* ---------- Normalisasi (padanan sisi klien) ---------- */
  function slugFromLink(link) {
    if (!link) return null;
    const m = String(link).match(/\/(?:manga|detail-komik)\/([^/?#]+)/);
    if (m) return m[1].replace(/\/$/, '');
    const parts = String(link).replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || null;
  }
  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function normItem(it) {
    if (!it || typeof it !== 'object') return null;
    const slug = it.slug || slugFromLink(it.link || it.href || it.url);
    const title = it.title || it.name;
    if (!slug || !title) return null;
    return {
      slug,
      title: String(title).trim(),
      cover: it.cover || it.image || it.thumbnail || it.img || null,
      chapter: it.chapter || it.latestChapter || it.chapterLatest || null,
      date: it.date || it.time_ago || it.updated || null,
      type: it.type ? String(it.type).trim() : null,
      rating: numOrNull(it.rating),
      status: it.status || null,
      genres: typeof it.genres === 'string' ? it.genres : (Array.isArray(it.genre) ? it.genre.join(', ') : (it.genre || null)),
    };
  }
  function normList(raw) {
    const arr = (raw && (raw.komikList || raw.data || raw.comics || raw.results)) || [];
    return {
      items: arr.map(normItem).filter(Boolean),
      hasNextPage: Boolean(raw && (raw.hasNextPage ?? raw.has_next ?? (raw.pagination ? raw.pagination.hasNext : false))),
      currentPage: raw && raw.currentPage ? Number(raw.currentPage) : 1,
    };
  }
  function chapterTitleFromSlug(slug) {
    const m = String(slug).match(/chapter[- ]?([0-9]+(?:[.,][0-9]+)?)/i);
    if (m) return 'Chapter ' + m[1].replace(',', '.');
    const side = String(slug).match(/(side|extra|special|prologue|epilogue)[- ]?([0-9]*)/i);
    if (side) return (side[1][0].toUpperCase() + side[1].slice(1).toLowerCase()) + (side[2] ? ' ' + side[2] : '');
    return String(slug).replace(/[-_]+/g, ' ').trim();
  }
  function normDetail(raw, slug) {
    const d = (raw && raw.detail) || raw || {};
    const genres = Array.isArray(d.genres)
      ? d.genres.map((g) => (typeof g === 'string' ? { slug: g.toLowerCase().replace(/\s+/g, '-'), name: g } : { slug: g.slug || g.value || '', name: g.title || g.name || '' })).filter((g) => g.name)
      : [];
    const chapters = Array.isArray(d.chapters)
      ? d.chapters.map((c) => ({
          slug: c.slug || slugFromLink(c.link || c.href),
          title: (c.title && String(c.title).trim()) || chapterTitleFromSlug(c.slug || ''),
          date: c.date || null,
        })).filter((c) => c.slug)
      : [];
    let status = d.status || null;
    if (status) {
      const s = String(status).toLowerCase();
      if (s.includes('berjalan') || s.includes('ongoing')) status = 'Ongoing';
      else if (s.includes('tamat') || s.includes('complete') || s.includes('end')) status = 'Completed';
    }
    return {
      slug,
      title: d.title || slug,
      cover: d.cover || d.image || null,
      rating: numOrNull(d.rating),
      otherTitle: d.otherTitle || d.title_indonesian || null,
      status,
      type: d.type || (d.metadata && d.metadata.type) || null,
      author: d.author || (d.metadata && d.metadata.author) || null,
      artist: d.artist || null,
      release: d.release || null,
      synopsis: d.synopsis || d.synopsis_full || '',
      genres,
      chapters,
    };
  }
  function normChapter(raw, slug) {
    const images = Array.isArray(raw && raw.images) ? raw.images.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)) : [];
    const nav = (raw && raw.navigation) || {};
    return {
      slug,
      title: (raw && raw.title) || (raw && raw.chapter_title) || chapterTitleFromSlug(slug),
      comicTitle: (raw && raw.manga_title) || null,
      comicSlug: String(slug).replace(/-chapter[- ].*$/i, ''),
      images,
      prev: nav.prev || nav.previousChapter || null,
      next: nav.next || nav.nextChapter || null,
    };
  }
  function normGenres(raw) {
    const arr = (raw && (raw.data || raw.genres)) || [];
    const seen = new Set();
    const out = [];
    for (const g of arr) {
      const slug = g.slug || g.value || '';
      const name = (g.title || g.name || '').trim();
      if (!slug || !name) continue;
      if (/^[0-9]+$/.test(name)) continue;
      if (name.split(/\s+/).length > 3) continue;
      const key = slug.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ slug, name });
    }
    return out.filter((g) => !out.some((o) => o !== g && o.name.toLowerCase().startsWith(g.name.toLowerCase()) && o.name.length > g.name.length));
  }

  /* ---------- Urutan hasil pencarian: judul utama dulu ---------- */
  function normText(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  const SEQUEL_WORDS = /\b(season|part|final|movie|ova|ona|special|spinoff|spin off|sequel|prequel|remake|2nd|3rd|4th|5th|6th)\b/;
  function sequelPenalty(title) {
    const t = normText(title);
    let p = 0;
    if (String(title).includes(':')) p += 2;
    if (SEQUEL_WORDS.test(t)) p += 3;
    const nums = t.match(/\b\d+\b/g);
    if (nums) p += Math.min(3, nums.length);
    if (/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/.test(t)) p += 2;
    return p;
  }
  function rankSearchItems(items, q) {
    const nq = normText(q);
    const score = (it) => {
      const nt = normText(it.title);
      let base = 4;
      if (nt === nq) base = 0;
      else if (nt.startsWith(nq)) base = 1;
      else if ((' ' + nt + ' ').includes(' ' + nq + ' ')) base = 2;
      else if (nt.includes(nq)) base = 3;
      return [base, sequelPenalty(it.title), nt.length];
    };
    return [...(items || [])].sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
      return String(a.title).localeCompare(String(b.title));
    });
  }

  /* ---------- Pengganti /api/* ---------- */
  async function up(path) {
    const res = await fetch(UPSTREAM + path, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Layanan data bermasalah (${res.status})`);
    return res.json();
  }
  function loginRequiredError() {
    const err = new Error('Konten ini khusus member. Di mode statis fitur akun nonaktif, jadi konten ini tidak bisa dibuka.');
    err.status = 401;
    err.code = 'LOGIN_REQUIRED';
    return err;
  }
  function detailNeedsLogin(detail) {
    return Boolean(detail && Array.isArray(detail.genres) && detail.genres.some((g) => typeof isHiddenGenre === 'function' && isHiddenGenre(g)));
  }

  window.apiGet = async function apiGetStatic(path) {
    const u = new URL(path, 'http://static.local');
    const p = u.pathname;
    if (p === '/api/home') {
      const [terbaru, populer, recomen, genres] = await Promise.all([
        up('/bacakomik/latest?page=1').then(normList),
        up('/bacakomik/populer').then(normList),
        up('/bacakomik/recomen').then(normList),
        up('/bacakomik/genres').then(normGenres),
      ]);
      return { terbaru, populer, recomen, genres: visibleGenres(genres) };
    }
    if (p === '/api/terbaru') {
      const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
      const data = await up(`/bacakomik/latest?page=${page}`).then(normList);
      data.currentPage = page;
      return data;
    }
    if (p === '/api/populer') return up('/bacakomik/populer').then(normList);
    if (p === '/api/top') return up('/bacakomik/top').then(normList);
    if (p === '/api/rekomendasi') return up('/bacakomik/recomen').then(normList);
    if (p === '/api/cari') {
      const q = (u.searchParams.get('q') || '').trim();
      const data = await up(`/bacakomik/search/${encodeURIComponent(q)}`).then(normList);
      return { ...data, items: rankSearchItems(data.items, q) };
    }
    if (p === '/api/genres') {
      const genres = await up('/bacakomik/genres').then(normGenres);
      return { genres: visibleGenres(genres) };
    }
    let m;
    if ((m = p.match(/^\/api\/genre\/([^/]+)$/))) {
      const slug = decodeURIComponent(m[1]);
      if (typeof isHiddenGenre === 'function' && isHiddenGenre({ slug })) throw loginRequiredError();
      const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10) || 1);
      const data = await up(`/bacakomik/genre/${encodeURIComponent(slug)}?page=${page}`).then(normList);
      data.currentPage = page;
      return data;
    }
    if ((m = p.match(/^\/api\/tipe\/([^/]+)$/))) {
      return up(`/bacakomik/only/${encodeURIComponent(decodeURIComponent(m[1]))}`).then(normList);
    }
    if ((m = p.match(/^\/api\/komik\/([^/]+)$/))) {
      const slug = decodeURIComponent(m[1]);
      const detail = await up(`/bacakomik/detail/${encodeURIComponent(slug)}`).then((raw) => normDetail(raw, slug));
      if (!detail || !detail.title) { const e = new Error('Komik tidak ditemukan.'); e.status = 404; throw e; }
      if (detailNeedsLogin(detail)) throw loginRequiredError();
      return detail;
    }
    if ((m = p.match(/^\/api\/baca\/([^/]+)$/))) {
      const slug = decodeURIComponent(m[1]);
      const data = await up(`/bacakomik/chapter/${encodeURIComponent(slug)}`).then((raw) => normChapter(raw, slug));
      const detail = await up(`/bacakomik/detail/${encodeURIComponent(data.comicSlug)}`).then((raw) => normDetail(raw, data.comicSlug)).catch(() => null);
      if (detailNeedsLogin(detail)) throw loginRequiredError();
      if (!data.images.length) { const e = new Error('Chapter tidak ditemukan atau belum tersedia.'); e.status = 404; throw e; }
      return data;
    }
    if (p === '/api/auth/me') return { user: null };
    const err = new Error('Endpoint tidak tersedia di mode statis.');
    err.status = 404;
    throw err;
  };

  window.apiPost = async function apiPostStatic(path) {
    if (String(path).startsWith('/api/auth/')) {
      const err = new Error('Fitur akun nonaktif di mode statis — tidak ada server/database. Pakai versi dinamis untuk akun.');
      err.code = 'STATIC_MODE';
      throw err;
    }
    const err = new Error('Tidak tersedia di mode statis.');
    err.status = 405;
    throw err;
  };

  /* Spanduk penjelasan di halaman akun */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!/\/(akun|masuk|daftar|lupa|aktivasi|reset)\.html/.test(location.pathname)) return;
      const main = document.querySelector('main');
      if (!main) return;
      const banner = document.createElement('div');
      banner.className = 'msg-ok';
      banner.style.margin = '18px auto 0';
      banner.style.maxWidth = '880px';
      banner.innerHTML = '<b>Mode statis.</b> Ini versi tanpa server/database untuk hosting statis gratis — fitur akun (daftar/masuk) nonaktif di sini. Baca komik, cari, dan jelajahi genre tetap jalan.';
      main.prepend(banner);
    });
  }
})();
