# NutriAI 🌿

A full-stack AI-powered nutrition tracker built with React + Vite, Node.js/Express, and SQLite (Prisma ORM). Tracks calories, all 18 amino acids, fatty acids, 14 vitamins, and 14+ minerals. Generates personalised meal plans using Claude AI.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS 3, Recharts, React Router 6 |
| Backend | Node.js 18+, Express 4, Prisma ORM, SQLite |
| AI | Anthropic Claude (meal plans + photo estimation) |
| External API | Open Food Facts (barcode lookup) |
| Fonts | Syne (headings) + DM Sans (body) |

---

## Setup

### Prerequisites
- Node.js 18+
- An Anthropic API key (for AI features)

---

### 1. Clone and enter the project

```bash
cd "nutriai"
```

### 2. Set up the backend

```bash
cd backend

# Copy environment file and fill in your values
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY and a strong JWT_SECRET

# Install dependencies
npm install

# Generate Prisma client and create the SQLite database
npm run db:generate
npm run db:push

# Seed 56+ foods with complete nutrient data
npm run db:seed

# Start the development server (port 3001)
npm run dev
```

### 3. Set up the frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Start the dev server (port 5173)
npm run dev
```

### 4. Open the app

Visit **http://localhost:5173** — register an account and complete the 5-step onboarding wizard.

---

## Environment variables

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...      # Required for AI meal plans & photo estimation
DATABASE_URL=file:./dev.db         # SQLite file path
JWT_SECRET=your-long-random-secret # Used to sign JWTs (min 32 chars recommended)
PORT=3001                          # Optional, defaults to 3001
```

---

## Features

### Auth & Onboarding
- Register / login with JWT (30-day token)
- 5-step onboarding wizard: goal → body stats → activity → restrictions → calorie summary
- Calorie & macro targets calculated via Mifflin-St Jeor + activity multiplier

### Today page
- **SVG Calorie ring** — shows consumed vs target, colour-coded
- **Macro bars** — protein / carbs / fat progress bars
- **Water tracker** — 8 clickable glasses
- **Food search** — live dropdown with 300ms debounce
- **Barcode scan** — enter barcode → fetches Open Food Facts
- **Photo AI** — upload photo → Claude vision estimates calories & macros
- **Food log** — grouped by Breakfast / Lunch / Dinner / Snack with delete
- **Nutrition accordion** — 5 expandable sections:
  - Protein & Amino Acids (all 18 amino acids with DRV % bars, green/amber/red)
  - Lipids & Fatty Acids (saturated, MUFA, PUFA, omega-3, omega-6, trans)
  - Carbohydrates
  - Vitamins (all 14: A, D, E, K, B1–B12, C, choline)
  - Minerals (14: Ca, P, Mg, K, Na, Fe, Zn, Cu, Mn, Se, I, Mo, Cr, F)

### Library page
- Browse 56+ seeded foods by category with emoji icons
- Full-text search
- Category filter chips
- Detail modal with portion adjuster → add to today's log

### AI Plan page
- Calorie target slider
- Meals per day selector (2–6)
- Dietary restriction toggles
- Generates full day meal plan via Claude API with:
  - Complete amino acid coverage notes
  - Omega-3 source highlights
  - Nutrition win summary

### Insights page
- 7-day calorie bar chart (Recharts)
- Today's macro split pie chart
- Streak counter
- Top 5 nutrient gaps (< 50% DRV)
- Top 5 nutrition wins (≥ 90% DRV)
- Weekly summary table

### Profile page
- Edit name, age, sex, height, weight, units (metric/imperial)
- Change goal & activity level → auto-recalculates targets
- Update dietary restrictions

---

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/onboarding` | Complete onboarding |
| PUT | `/api/auth/profile` | Update profile |
| GET | `/api/foods` | List/search foods (`?q=&category=`) |
| GET | `/api/foods/categories` | List categories |
| GET | `/api/foods/:id` | Get food by ID |
| GET | `/api/log` | Get food log (`?date=YYYY-MM-DD`) |
| POST | `/api/log` | Add food to log |
| DELETE | `/api/log/:id` | Remove log entry |
| GET | `/api/water` | Get water for date |
| PUT | `/api/water` | Update water glasses |
| POST | `/api/ai/meal-plan` | Generate AI meal plan |
| POST | `/api/ai/photo-estimate` | Estimate from photo |
| GET | `/api/insights` | 7-day analytics |
| GET | `/api/barcode/:code` | Lookup Open Food Facts barcode |

---

## Design system

- **Primary colour**: `#4a7c59` (forest green)
- **Font headings**: Syne
- **Font body**: DM Sans
- **Max width**: 540px (mobile-first)
- **Navigation**: fixed bottom nav, 5 tabs
- **Modals**: slide-up sheet with backdrop blur
- **Toasts**: slide-up from bottom, auto-dismiss after 3.5s
