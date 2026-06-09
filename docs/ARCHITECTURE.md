# Architettura Tecnica

## Principio base: Layer separati

Il progetto è diviso in layer che **non si toccano tra loro**. Ogni layer ha una responsabilità sola.

```
┌─────────────────────────────────────┐
│           PAGES (composizione)       │  ← assembla tutto
├─────────────────┬───────────────────┤
│   COMPONENTS    │      HOOKS        │  ← UI pura | logica pura
│   (design)      │   (features)      │
├─────────────────┴───────────────────┤
│              API LAYER              │  ← chiamate Supabase
├─────────────────────────────────────┤
│           SUPABASE (DB + Auth)      │  ← database con RLS
└─────────────────────────────────────┘
```

## Come funzionano gli agent paralleli

Con `claude --worktree` puoi lanciare due agent su branch separati:

```bash
# Terminal 1 — Agent Design
claude "Migliora il componente LeadDetailModal con UI moderna"
# lavora solo in src/components/

# Terminal 2 — Agent Features
claude "Aggiungi filtro avanzato per stato e data alle lead"
# lavora solo in src/api/ e src/hooks/
```

I branch vengono poi uniti — nessun conflitto perché toccano file diversi.

## Regole di separazione

| Layer | File toccati | NON tocca |
|---|---|---|
| Design | `src/components/**`, `src/pages/**` (solo JSX) | api/, hooks/, types/ |
| Features | `src/api/**`, `src/hooks/**`, `src/types/**` | components/ |
| Database | `supabase/**` | tutto il resto |

## Sicurezza: come funziona l'auth

```
Browser → Supabase Auth (JWT) → RLS su ogni tabella
                                  ↓
                    admin: vede tutto
                    client: vede solo i propri dati
```

L'endpoint pubblico per le lead (form HTML) usa un `api_token` univoco per cliente,
validato da una Supabase Edge Function (NON dalla anon key).

## Database: struttura multi-tenant

```
users (auth.users linked)
  └── clients (1 client = 1 user)
        ├── leads
        │     ├── notes
        │     ├── quotes
        │     └── appointments
        └── ad_spends
```

Ogni query è automaticamente filtrata per `client_id` tramite RLS.
