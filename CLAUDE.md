# MWS Lead Manager — Contesto per Claude Code

## Cos'è questo progetto

SaaS B2B per la gestione delle lead pubblicitarie. Daniel (l'admin) gestisce campagne pubblicitarie per i suoi clienti; le lead generate dagli annunci arrivano nel software tramite API o form HTML generati dall'app. I clienti accedono alla loro dashboard per vedere le lead, creare preventivi, mandare messaggi WhatsApp/email e tracciare i ricavi.

**Stato attuale:** funzionante ma con gravi problemi di sicurezza. In fase di ristrutturazione professionale.

---

## Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS (inline styles attuali) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| Deploy | — (da definire) |
| i18n | i18next (IT, EN, RO) |

---

## Struttura cartelle (ATTUALE → da migrare)

```
/                       ← root disorganizzata (da pulire)
├── App.tsx             ← routing e state globale
├── constants.ts        ← ⚠️ dati hardcoded da eliminare
├── supabaseClient.ts   ← ⚠️ chiavi hardcoded → spostare in .env
├── types.ts            ← tipi TypeScript globali
├── components/         ← componenti UI misti (da separare)
├── pages/              ← pagine
├── contexts/           ← AuthContext, ThemeContext
├── services/
│   └── apiService.ts   ← ⚠️ tutta la logica DB in un file solo
└── src/
    └── i18n/           ← localizzazioni
```

---

## Struttura cartelle TARGET (architettura modulare)

```
/
├── CLAUDE.md               ← questo file
├── .env.local              ← chiavi Supabase (NON committare)
├── docs/                   ← memoria progetto, decisioni, roadmap
│
└── src/
    ├── main.tsx
    ├── App.tsx             ← solo routing
    │
    ├── types/              ← tutti i tipi TypeScript
    │   └── index.ts
    │
    ├── lib/
    │   └── supabase.ts     ← client Supabase (da .env)
    │
    ├── api/                ← 🔒 LAYER API — agent "Features" lavora qui
    │   ├── auth.ts
    │   ├── leads.ts
    │   ├── clients.ts
    │   ├── quotes.ts
    │   ├── appointments.ts
    │   ├── notifications.ts
    │   ├── adSpends.ts
    │   └── forms.ts
    │
    ├── hooks/              ← 🔒 LAYER HOOKS — agent "Features" lavora qui
    │   ├── useAuth.ts
    │   ├── useLeads.ts
    │   ├── useClients.ts
    │   └── ...
    │
    ├── components/         ← 🎨 LAYER UI — agent "Design" lavora qui
    │   ├── ui/             ← componenti atomici (Button, Modal, Badge...)
    │   ├── lead/           ← componenti specifici per le lead
    │   ├── quote/          ← componenti preventivi
    │   ├── calendar/       ← componenti calendario
    │   ├── analytics/      ← grafici e statistiche
    │   └── layout/         ← Sidebar, Header, Layout
    │
    ├── pages/              ← composizione di components + hooks
    │   ├── admin/
    │   └── client/
    │
    ├── contexts/           ← state globale React
    │   ├── AuthContext.tsx
    │   └── ThemeContext.tsx
    │
    └── i18n/               ← localizzazioni
        └── locales/
```

**Regola per agent paralleli:**
- Agent **"Design"** → lavora solo in `src/components/` e `src/pages/` (UI puro)
- Agent **"Features"** → lavora solo in `src/api/`, `src/hooks/`, `src/types/` (logica)
- Agent **"Database"** → lavora solo in `supabase/` (schema SQL, migrations, RLS)
- Nessun agent tocca i file dell'altro → zero conflitti

---

## Ruoli utente

| Ruolo | Accesso |
|---|---|
| `admin` | Daniel — vede tutto, gestisce tutti i clienti, inserisce spese pubblicitarie |
| `client` | Il cliente di Daniel — vede solo le proprie lead, crea preventivi |

---

## Flusso principale

1. Lead arriva via API POST o form HTML → viene salvata in `leads` con `client_id`
2. Il cliente vede la lead nella sua dashboard → cambia stato (Nuovo → Contattato → In Lavorazione → Vinto/Perso)
3. Il cliente crea un preventivo (Quote) → lo manda via webhook a WhatsApp/email
4. Il cliente registra il valore → il sistema calcola ROI vs spesa pubblicitaria
5. L'admin vede tutto + gestisce spese ads + revenue MWS

---

## Problemi di sicurezza noti (da risolvere in ordine)

- [ ] **CRITICO** — Password utenti salvate in plaintext nel DB (`users.password`)
- [ ] **CRITICO** — Login fallback custom bypassa Supabase Auth completamente
- [ ] **CRITICO** — Credenziali hardcoded in `constants.ts` e `supabaseClient.ts`
- [ ] **ALTO** — `getUsers()` ritorna le password nel payload
- [ ] **ALTO** — Endpoint ricezione lead non autenticato (chiunque può inserire lead)
- [ ] **MEDIO** — Nessuna rate limiting sull'API

---

## Decisioni architetturali prese

| Data | Decisione | Motivazione |
|---|---|---|
| 2026-06-09 | Migrare a Supabase Auth nativo | Eliminare password plaintext, usare JWT sicuri |
| 2026-06-09 | Struttura modulare per layer | Permettere agent Claude paralleli senza conflitti |
| 2026-06-09 | Separare `apiService.ts` in moduli per dominio | File unico troppo grande, impossibile da mantenere |
