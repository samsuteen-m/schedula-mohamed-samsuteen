# Schedula API Collection

## Base URL
Local: http://localhost:3000
Production: https://schedula-mohamed-samsuteen.onrender.com

---

## 🔐 Authentication

### Signup
POST /signup
Body:
{
  "name": "Dr. Mohamed",
  "email": "doctor@gmail.com",
  "password": "123456",
  "role": "DOCTOR"
}

### Login
POST /login
Body:
{
  "email": "doctor@gmail.com",
  "password": "123456"
}

---

## 👨‍⚕️ Doctor Profile

### Create Doctor Profile
POST /doctor/profile
Auth: Bearer Token (Doctor)
Body:
{
  "fullName": "Dr. Mohamed",
  "specialization": "Cardiologist",
  "qualification": "MBBS, MD",
  "experience": "10 years",
  "consultationFee": "700",
  "consultationHours": "9AM - 5PM",
  "bio": "Heart specialist",
  "phone": "9876544444",
  "isAvailable": true
}

### Get Doctor Profile
GET /doctor/my/profile
Auth: Bearer Token (Doctor)

### Update Doctor Profile
PATCH /doctor/my/profile
Auth: Bearer Token (Doctor)
Body:
{
  "consultationFee": "800"
}

---

## 🧑‍⚕️ Patient Profile

### Create Patient Profile
POST /patient/profile
Auth: Bearer Token (Patient)
Body:
{
  "fullName": "Patient Mohamed",
  "age": "25",
  "gender": "Male",
  "phone": "9876544444",
  "address": "Madurai, Tamil Nadu",
  "bloodGroup": "O+",
  "medicalHistory": "None"
}

### Get Patient Profile
GET /patient/profile
Auth: Bearer Token (Patient)

### Update Patient Profile
PATCH /patient/profile
Auth: Bearer Token (Patient)

---

## 🔍 Doctor Discovery

### Get All Doctors
GET /doctor

### Filter by Specialization
GET /doctor?specialization=Cardiologist

### Search by Name
GET /doctor?search=Mohamed

### Pagination
GET /doctor?page=1&limit=10

### Filter by Availability
GET /doctor?availability=true

### Get Doctor by ID
GET /doctor/:id

---

## 📅 Doctor Availability

### Create Recurring Availability
POST /doctor/availability
Auth: Bearer Token (Doctor)
Body:
{
  "dayOfWeek": "MONDAY",
  "startTime": "10:00:00",
  "endTime": "12:00:00"
}

### Get Availability
GET /doctor/availability
Auth: Bearer Token (Doctor)

### Update Availability
PATCH /doctor/availability/:id
Auth: Bearer Token (Doctor)
Body:
{
  "startTime": "09:00:00",
  "endTime": "13:00:00"
}

### Delete Availability
DELETE /doctor/availability/:id
Auth: Bearer Token (Doctor)

### Custom Override
POST /doctor/availability/override
Auth: Bearer Token (Doctor)
Body:
{
  "date": "2026-06-20",
  "startTime": "14:00:00",
  "endTime": "16:00:00"
}

### Get Availability by Date
GET /doctor/availability/date?date=2026-06-20
Auth: Bearer Token (Doctor)

---

## 🕐 Slot Generation

### Generate Slots (Old)
POST /doctor/slots/generate?date=2026-06-22&duration=30
Auth: Bearer Token (Doctor)

### Set Scheduling Type
POST /doctor/scheduling-type
Auth: Bearer Token (Doctor)
Body:
{
  "schedulingType": "STREAM"
}

### Generate Stream Slots
POST /doctor/slots/stream
Auth: Bearer Token (Doctor)
Body:
{
  "date": "2026-06-22",
  "duration": 15,
  "bufferTime": 5
}

### Generate Wave Slots
POST /doctor/slots/wave
Auth: Bearer Token (Doctor)
Body:
{
  "date": "2026-06-23",
  "maxCapacity": 5
}

### Patient Views Slots
GET /doctor/:doctorId/slots?date=2026-06-22
Auth: Bearer Token (Patient)

### Patient Views Scheduled Slots
GET /doctor/:doctorId/slots/scheduled?date=2026-06-22
Auth: Bearer Token (Patient)

---

## 📋 Appointments

### Book Appointment
POST /appointment
Auth: Bearer Token (Patient)
Body:
{
  "doctorId": "doctor-uuid",
  "date": "2026-06-22",
  "startTime": "10:00:00",
  "endTime": "10:30:00"
}

### Patient Views Appointments
GET /appointment/my
Auth: Bearer Token (Patient)

### Cancel Appointment
PATCH /appointment/:id/cancel
Auth: Bearer Token (Patient)

### Reschedule Appointment
PATCH /appointment/:id/reschedule
Auth: Bearer Token (Patient)
Body:
{
  "date": "2026-06-25",
  "startTime": "11:00:00",
  "endTime": "11:30:00"
}

### Doctor Views Appointments
GET /doctor/appointments
Auth: Bearer Token (Doctor)