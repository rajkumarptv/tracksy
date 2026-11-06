# 💰 Tracksy — Personal Finance Dashboard.

A full-stack personal finance management web app built with **React**, **Node.js**, and **PostgreSQL**.

---

## 🗂️ Project Structure

```
tracksy/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── controllers/   # Business logic
│   │   ├── db/            # DB connection, migrations, seeds
│   │   ├── middleware/     # JWT auth middleware
│   │   ├── routes/        # API routes
│   │   └── index.js       # Entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/              # React + Vite app
│   ├── src/
│   │   ├── components/    # Reusable UI + layout components
│   │   ├── pages/         # Dashboard, Transactions, Budget, Goals, etc.
│   │   ├── services/      # Axios API service
│   │   ├── store/         # Zustand auth store
│   │   └── main.jsx       # Entry point
│   ├── .env
│   └── package.json
│
└── README.md
```

---

## ✅ Prerequisites

- **Node.js** v18+
- **PostgreSQL** v14+
- **npm** v9+

---

## 🚀 Quick Setup

### 1. Clone & Install

```bash
# Clone the repo
git clone https://github.com/yourname/tracksy.git
cd tracksy

# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Set Up PostgreSQL Database

```bash
# Connect to PostgreSQL and create the database
psql -U postgres

CREATE DATABASE tracksy_db;
\q
```

### 3. Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tracksy_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=super_secret_change_me_in_production
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000
```

### 4. Run Database Migrations & Seed

```bash
# From the backend directory
cd backend
npm run db:setup
```

This will:
- Create all tables (users, wallets, transactions, categories, budgets, saving_goals)
- Seed demo data including a demo user

**Demo credentials:** `adaline@tracksy.com` / `password123`

### 5. Start the App

```bash
# From root — starts both backend and frontend
cd ..
npm run dev
```

Or start them separately:

```bash
# Terminal 1 – Backend (port 5000)
cd backend && npm run dev

# Terminal 2 – Frontend (port 3000)
cd frontend && npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Income, expense, balance totals |
| GET | `/api/dashboard/money-flow` | Monthly income/expense by year |
| GET | `/api/dashboard/recent-transactions` | Latest N transactions |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List with filters & pagination |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List with spent amounts |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |

### Goals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List goals |
| POST | `/api/goals` | Create goal |
| PUT | `/api/goals/:id` | Update goal |
| POST | `/api/goals/:id/add-funds` | Add funds to goal |
| DELETE | `/api/goals/:id` | Delete goal |

### Wallets & Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallets` | List wallets |
| POST | `/api/wallets` | Add wallet |
| DELETE | `/api/wallets/:id` | Remove wallet |
| GET | `/api/categories` | List categories |

---

## 🗄️ Database Schema

```
users
  id, first_name, last_name, email, password_hash, currency, language

wallets
  id, user_id → users, name, type, last_four, balance, color, is_default

categories
  id, user_id → users, name, type (income|expense|both), emoji, color

transactions
  id, user_id → users, wallet_id → wallets, category_id → categories,
  type (income|expense|transfer), amount, description, payment_name,
  status (completed|pending|failed), transaction_date

budgets
  id, user_id → users, category_id → categories,
  name, amount, period (weekly|monthly|yearly), start_date

saving_goals
  id, user_id → users, name, target_amount, current_amount,
  emoji, color, target_date, monthly_contribution

notification_preferences
  id, user_id → users, transaction_alerts, budget_warnings,
  weekly_summary, goal_milestones
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, TanStack Query, Recharts, Zustand |
| Backend | Node.js, Express 4, JWT Auth, bcryptjs |
| Database | PostgreSQL with `pg` driver |
| Build | Vite |
| Styling | CSS Modules + CSS Variables |

---

## 🔐 Authentication

- JWT-based auth with `Bearer` tokens
- Tokens stored in `localStorage`
- Auto-redirect to `/login` on 401 responses
- Protected routes via React Router

---

## 🧪 Development Tips

```bash
# Reset and re-seed the database
cd backend && npm run db:setup

# Run only migrations (no seed)
cd backend && npm run db:migrate

# Run only seed
cd backend && npm run db:seed
```

---

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in backend `.env`
2. Build the frontend: `cd frontend && npm run build`
3. Serve `frontend/dist` via nginx or Express static
4. Use a process manager like `pm2` for the backend
5. Use environment variables (not `.env` files) in production

---

## 📦 Features

- ✅ User authentication (register, login, JWT)
- ✅ Dashboard with income/expense stats & charts
- ✅ Full transaction CRUD with filtering & pagination
- ✅ Budget tracking with real-time spending calculations
- ✅ Saving goals with progress tracking & add-funds
- ✅ Wallet management (multiple cards/accounts)
- ✅ Analytics page with charts
- ✅ Settings (profile, currency, notifications)
- ✅ Responsive layout with sidebar navigation
