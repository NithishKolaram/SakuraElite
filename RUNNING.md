# Running Sakura Elite Locally

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [PostgreSQL](https://www.postgresql.org/) database (local or remote)
- Razorpay account (for payment features)

---

## 1. Clone / Navigate to the project

```bash
cd "Sakura Elite"
```

## 2. Install dependencies

```bash
npm install
```

## 3. Set up environment variables

Create a `.env` file in the project root:

```bash
cp .env .env.backup   # optional: back up existing .env first
```

Open `.env` and fill in your values:

```
DB_USER=your_postgres_username
DB_HOST=localhost
DB_DATABASE=your_database_name
DB_PASSWORD=your_postgres_password
DB_PORT=5432
PORT=3000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## 4. Run the server

**Production mode:**
```bash
npm start
```

**Development mode** (auto-restarts on file changes — requires `nodemon`):
```bash
npm run dev
```

If `nodemon` is not installed:
```bash
npm install -g nodemon
npm run dev
```

## 5. Open in browser

```
http://localhost:3000
```

- **Resident login:** `http://localhost:3000`
- **Admin panel:** `http://localhost:3000/admin.html`

---

## Stopping the server

Press `Ctrl + C` in the terminal.
