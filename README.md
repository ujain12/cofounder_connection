# Cofounder Connections

An AI powered platform that helps startup founders find, evaluate, and collaborate with potential cofounders.

Live: https://cofounderconnections.com/

## What it does

Cofounder Connections handles the full lifecycle of finding a cofounder. Founders sign up, build a profile with skill tags, and use an AI search agent to find people whose skills complement theirs. Once matched, they get a shared workspace with chat, a task board, a founder agreement builder, and weekly check ins.

The platform is not a job board or a dating app. It is built around the idea that trust and alignment matter more than resumes. Every user goes through an admin approval process before they can access the community. AI features help founders evaluate compatibility, write better profiles, and stay accountable after they connect.

## Problem

23% of startups fail because they have the wrong team (CB Insights). Finding a cofounder today means posting in scattered forums, attending networking events, or relying on personal introductions. There is no dedicated platform that handles discovery, evaluation, and collaboration in one place.

## Key features

- Google OAuth sign in with admin approval for every new user
- 35 tag skill matching system across domain expertise, business skills, founder type, and industry focus
- AI powered cofounder search using a ReAct multi agent architecture with parallel scoring
- Real time chat with automated message moderation and content flagging
- Shared workspace: drag and drop task board, 17 field founder agreement builder, weekly check ins
- AI tools: profile rewrite, profile gap analysis, match explanations, connection openers, conversation coaching
- Admin dashboard with user management, content moderation, and cost analytics
- Usage based billing with credit packages and 10% platform margin
- LLM evaluation suite with 17 tests covering core tasks, edge cases, adversarial inputs, and A/B model comparisons
- Model cascade (FrugalGPT style) that tries cheap models first and escalates only when quality checks fail
- Response caching, rate limiting, prompt injection blocking, and input sanitization

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, React |
| Styling | Custom CSS variables, Plus Jakarta Sans |
| Backend | Next.js API routes (serverless) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth with Google OAuth |
| Storage | Supabase Storage |
| AI | OpenAI (GPT 4o, GPT 4o mini), Anthropic (Claude Sonnet, Claude Haiku), HuggingFace, OpenRouter |
| Payments | Stripe |
| Email | Resend |
| Hosting | Vercel |

## System architecture

```
+-------------------+
|      User         |
| (Browser/Mobile)  |
+--------+----------+
         |
         v
+--------+----------+
|    Next.js App     |
|   (Vercel Edge)    |
|                    |
|  +-- Pages -----+  |
|  | Landing       |  |
|  | Onboarding    |  |
|  | Home          |  |
|  | Matches       |  |
|  | Chat          |  |
|  | Workspace     |  |
|  | Profile       |  |
|  | Billing       |  |
|  | Admin         |  |
|  | Eval Suite    |  |
|  +--------------+  |
|                    |
|  +-- Middleware -+  |
|  | Auth check    |  |
|  | Approval check|  |
|  | Credit gate   |  |
|  +--------------+  |
+--------+-----------+
         |
         v
+--------+-----------+
|   API Routes       |
|   (Serverless)     |
|                    |
|  /api/ai           |
|  /api/search-agent |
|  /api/checkins-ai  |
|  /api/multimodal   |
|  /api/chat/send    |
|  /api/admin/review |
|  /api/admin/costs  |
|  /api/billing/*    |
|  /api/report       |
|  /api/account/del  |
|  /api/eval         |
+---+--------+-------+
    |        |
    v        v
+---+---+ +--+------------+
|Supabase| | AI Providers  |
|        | |               |
| Auth   | | OpenAI        |
| DB     | |  GPT 4o mini  |
| Storage| |  GPT 4o       |
| Realtime| |              |
|        | | Anthropic     |
| Tables:| |  Claude Haiku |
| profiles|  Claude Sonnet |
| matches| |               |
| chats  | | HuggingFace   |
| messages| Gemma, Mistral |
| tasks  | |               |
| agreements| OpenRouter   |
| usage_log| Free models   |
| payments |               |
| flags  | +---------------+
+--------+
    |
    v
+---------+
| Stripe  |
| Checkout|
| Webhooks|
+---------+
```

### How a search works (ReAct agent flow)

```
User query: "looking for a technical cofounder with AI experience"
     |
     v
[Step 1] Tag extraction (Claude Haiku)
     |  Input: natural language query
     |  Output: ["AI / ML", "Technical Founder"]
     v
[Step 2] Database search (Supabase, no AI)
     |  Query profile_tags table for matching founders
     |  Exclude already matched founders
     v
[Step 3] Load profiles (Supabase, no AI)
     |  Get full profiles + tags for all candidates
     v
[Step 4] Score all candidates in parallel (Claude Haiku x N)
     |  Each candidate scored 1-10 on complementarity
     |  Promise.all() runs all scoring concurrently
     v
[Step 5] Synthesize recommendation (GPT 4o mini)
     |  Top 3 matches summarized with specific reasons
     |  Suggests who to message first
     v
Return ranked results + recommendation to frontend
```

### Model cascade (FrugalGPT)

```
Request comes in
     |
     v
Try cheap model (GPT 4o mini or Claude Haiku)
     |
     v
Run quality checks:
  - Response length > 20 chars?
  - No refusal patterns?
  - Valid JSON for structured tasks?
     |
     +-- PASS --> Return response (cost: ~$0.0003)
     |
     +-- FAIL --> Escalate to premium model
                  (GPT 4o or Claude Sonnet)
                  Return response (cost: ~$0.01)
```

## Setup

### Prerequisites

- Node.js 18+
- npm
- Supabase account
- Google Cloud Console project (for OAuth)
- OpenAI API key
- Anthropic API key

### Install

```bash
git clone https://github.com/ujain12/cofounder_connection.git
cd cofounder_connection
npm install
```

### Environment variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
HF_API_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_openrouter_key
RESEND_API_KEY=your_resend_key
STRIPE_SECRET_KEY=your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_pub
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Database setup

In Supabase SQL Editor, create the following tables:

- profiles (id, full_name, bio, goals, stage, role, company, linkedin_url, why_join, status, avatar_url, credits_balance, flag_count, is_banned, hours_per_week, applied_at)
- profile_tags (user_id, tag, category)
- matches (id, user_id, candidate_id, status, created_at)
- chats (id, match_id)
- messages (id, chat_id, sender_id, body, created_at)
- founder_tasks (id, match_id, title, description, status, priority, assigned_to, assigned_to_name, created_by, created_by_name, due_date, category, blocker_notes, last_edited_by, last_edited_by_name)
- founder_agreements (id, match_id, agreement_title, project_name, founder_a_role, founder_b_role, equity_expectations, time_commitment, milestones, decision_style, conflict_handling, status)
- content_flags (id, flagged_user_id, reason, severity, auto_detected, reviewed, action_taken)
- usage_log (id, user_id, action, model, tokens_used, cost, your_margin, total_charged, created_at)
- payments (id, user_id, stripe_session_id, amount, credits_added, status, created_at)

Enable Google OAuth in Supabase Dashboard under Authentication > Providers > Google. Create an `avatars` storage bucket and set it to public.

### Google OAuth

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Set authorized JavaScript origin to your domain
4. Set redirect URI to your Supabase callback URL
5. Add Client ID and Secret to Supabase Auth settings

### Run

```bash
npm run dev
```

Open http://localhost:3000

## Folder structure

```
app/
  page.tsx                    Landing page (Google sign in)
  home/page.tsx               Dashboard
  profile/page.tsx            Profile editor with tags
  matches/page.tsx            Browse and discover founders
  requests/page.tsx           Incoming connection requests
  chat/[matchId]/page.tsx     Chat interface
  workspace/
    tasks/page.tsx            Drag and drop task board
    checkins/page.tsx         Collaboration dashboard
    agreement/page.tsx        Founder agreement builder
  billing/page.tsx            Credits and payment
  admin/page.tsx              Admin dashboard (4 tabs)
  onboarding/page.tsx         New user application form
  pending/page.tsx            Waiting for approval
  auth/callback/route.ts      OAuth callback
  api/
    ai/route.ts               Main AI endpoint (6 tasks)
    ai/context/route.ts       AI context endpoint
    search-agent/route.ts     ReAct search agent
    checkins-ai/route.ts      Weekly summary AI
    multimodal/route.ts       Image analysis
    chat/send/route.ts        Message sending with moderation
    admin/review/route.ts     Approve/reject users
    admin/costs/route.ts      Cost analytics API
    billing/checkout/route.ts Stripe checkout
    billing/webhook/route.ts  Stripe webhook
    billing/balance/route.ts  User balance
    report/route.ts           Report a user
    account/delete/route.ts   Delete account
    eval/route.ts             Evaluation suite
    eval/security/route.ts    Security eval
  components/
    AppShell.tsx              Sidebar layout
lib/
  supabase-browser.ts         Client side Supabase
  supabase-server.ts          Server side Supabase
  moderation.ts               Message content moderation
  rate-limit.ts               API rate limiting
  api-security.ts             Security headers, sanitization
  billing.ts                  Cost calculation, credit deduction
  cost-optimizer.ts           Caching, cascade config, analytics
  require-auth.ts             Auth middleware
  require-credits.ts          Credit gate middleware
  tags.ts                     35 tag taxonomy
  model-router.ts             Multi model routing
  email.ts                    Email templates via Resend
  security.ts                 Input/output security checks
```

## Known limitations

- Email notifications require a verified domain in Resend. Without it, emails only send to the account owner.
- Stripe payments need a live account with domain verification for real transactions.
- Response cache is in memory and resets on server restart.
- The search agent can approach Vercel's 10 second function timeout with more than 10 candidates.
- AI features are locked until users purchase credits.

## Future work

- Semantic caching using embeddings for better cache hit rates
- Push notifications for new matches and messages
- Founder reputation scoring based on collaboration history
- LinkedIn API integration for automatic profile enrichment
- Mobile app using React Native

## Credits

Built by Utkarsh Jain as part of DSBA 6010 at UNC Charlotte.
