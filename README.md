# 🏥 Schedula – Doctor Appointment Booking System

A robust backend API built with **NestJS**, **PostgreSQL**, and **TypeORM** for managing doctor appointments with advanced scheduling features.

---

## 🚀 Live Server
https://schedula-mohamed-samsuteen.onrender.com

---

## 🛠️ Tech Stack

- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon - Hosted)
- **ORM:** TypeORM
- **Authentication:** JWT (JSON Web Token)
- **Deployment:** Render

---

## ⚙️ Project Setup

### Prerequisites
- Node.js v18+
- PostgreSQL
- npm

### Installation Steps

**1. Clone the repository:**
```bash
git clone https://github.com/samsuteen-m/schedula-mohamed-samsuteen.git
cd schedula-mohamed-samsuteen
```

**2. Install dependencies:**
```bash
npm install
```

**3. Create `.env` file:**
```bash
cp .env.example .env
```

**4. Update `.env` with your values:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=schedula
JWT_SECRET=your_secret_key
PORT=3000
```

**5. Run the application:**
```bash
npm run start
```

**6. Application runs at:**
http://localhost:3000

---

## 🔐 Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `yourpassword` |
| `DB_NAME` | Database name | `schedula` |
| `JWT_SECRET` | JWT secret key | `your_secret` |
| `PORT` | App port | `3000` |
| `DATABASE_URL` | Production DB URL | `postgresql://...` |

---

## ✅ Features Implemented

### 🔐 Authentication (Day 2)
- `POST /signup` – Register as Doctor or Patient
- `POST /login` – Login and get JWT token
- Role-based access control (DOCTOR / PATIENT)

### 👨‍⚕️ Doctor Onboarding (Day 3)
- `POST /doctor/profile` – Create doctor profile
- `GET /doctor/my/profile` – Get doctor profile
- `PATCH /doctor/my/profile` – Update doctor profile

### 🧑‍⚕️ Patient Onboarding (Day 3)
- `POST /patient/profile` – Create patient profile
- `GET /patient/profile` – Get patient profile
- `PATCH /patient/profile` – Update patient profile

### 🔍 Doctor Discovery (Day 4)
- `GET /doctor` – List all doctors
- `GET /doctor?specialization=xyz` – Filter by specialization
- `GET /doctor?search=name` – Search by name
- `GET /doctor?page=1&limit=10` – Pagination
- `GET /doctor?availability=true` – Filter available doctors
- `GET /doctor/:id` – Get doctor by ID

### 📅 Doctor Availability (Day 6)
- `POST /doctor/availability` – Set recurring availability
- `GET /doctor/availability` – Get availability
- `PATCH /doctor/availability/:id` – Update availability
- `DELETE /doctor/availability/:id` – Delete availability
- `POST /doctor/availability/override` – Custom date override
- `GET /doctor/availability/date?date=2026-06-20` – Get by date

### 🕐 Slot Generation (Day 7)
- `POST /doctor/slots/generate` – Generate slots from availability
- `GET /doctor/:id/slots?date=2026-06-20` – Patient views slots

### 📆 Advanced Scheduling (Day 9)
- `POST /doctor/scheduling-type` – Set STREAM or WAVE
- `POST /doctor/slots/stream` – Generate stream slots with buffer
- `POST /doctor/slots/wave` – Generate wave slots with capacity
- `GET /doctor/:id/slots/scheduled` – View slots by type

### 📋 Appointment Booking (Day 8)
- `POST /appointment` – Book appointment
- `GET /appointment/my` – Patient views appointments
- `PATCH /appointment/:id/cancel` – Cancel appointment
- `GET /doctor/appointments` – Doctor views appointments

### 🔄 Appointment Rescheduling (Day 10)
- `PATCH /appointment/:id/reschedule` – Reschedule appointment
- 30-minute cutoff rule
- Next available slot suggestion

---

## 📊 API Collection

Download and import into Postman:

[📥 Download API Collection](./docs/schedula-api-collection.json)

---

## 🗄️ Database Schema

See ER Diagram:

[📊 View ER Diagram](./docs/er-diagram.md)

---

## 📈 Flow Charts

- [Appointment Booking Flow](./docs/appointment-flow.png)
- [Scheduling Flow](./docs/scheduling-flow.png)
- [Rescheduling Flow](./docs/rescheduling-flow.png)

---

## 🔒 Security

- JWT Authentication on all protected routes
- Role-based authorization (DOCTOR / PATIENT)
- Environment variables for all secrets
- `.env` file excluded from version control
- Strong JWT secret key
- SSL enabled for production database

---

## 🌐 Deployment

- **Platform:** Render
- **Database:** Neon PostgreSQL
- **Live URL:** https://schedula-api.onrender.com

---

## 👨‍💻 Developer

**Mohamed Samsuteen**
Backend Internship – Schedula Project