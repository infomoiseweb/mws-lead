# Roadmap MWS Lead Manager

## Fase 1 — Sicurezza & Fondamenta (IN CORSO)

### 1.1 Fix Autenticazione
- [x] Spostare chiavi Supabase in `.env.local`
- [x] Eliminare `constants.ts` con dati hardcoded
- [ ] **DA FARE NEL DB:** Rimuovere colonna `password` dalla tabella `users` (migration SQL)
- [ ] **DA FARE NEL DB:** Migrare gli utenti esistenti a Supabase Auth (creare account auth per ognuno)
- [x] Eliminare login fallback custom in `AuthContext`
- [x] `getUsers()` non restituisce più la colonna `password`

### 1.2 Protezione API Lead
- [ ] Aggiungere `api_token` per client nella tabella `clients`
- [ ] Creare Supabase Edge Function per ricezione lead (con validazione token)
- [ ] Rate limiting sull'endpoint pubblico

### 1.3 Ristrutturazione Codebase
- [ ] Spostare tutto in `src/`
- [ ] Separare `apiService.ts` in moduli per dominio (`src/api/`)
- [ ] Creare componenti atomici UI in `src/components/ui/`

---

## Fase 2 — Multi-nicchia & Pulizia (PROSSIMA)

- [ ] Rimuovere tutti i riferimenti hardcoded a "officine meccaniche"
- [ ] Rendere i campi lead 100% dinamici via configurazione
- [ ] Aggiungere campo "tipo business/nicchia" al client
- [ ] Template WhatsApp personalizzabili per nicchia
- [ ] Onboarding nuovo cliente migliorato

---

## Fase 3 — SaaS Pubblico (FUTURO)

- [ ] Schema multi-tenant con livello "organizzazione/agenzia"
- [ ] Registrazione self-service per nuove agenzie
- [ ] Integrazione pagamenti (Stripe)
- [ ] Dashboard analytics avanzata
- [ ] White-label (logo/colori personalizzabili per agenzia)
- [ ] Notifiche email transazionali (Resend/SendGrid)
