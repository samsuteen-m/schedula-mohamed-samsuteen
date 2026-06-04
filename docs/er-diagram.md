# \# Schedula - ER Diagram

# 

# \## Entities

# 

# \### USER

# \- id (PK)

# \- name

# \- email

# \- password

# \- phone

# \- role (patient/doctor)

# 

# \### PATIENT

# \- id (PK)

# \- user\_id (FK → USER)

# \- date\_of\_birth

# \- gender

# \- blood\_group

# 

# \### DOCTOR

# \- id (PK)

# \- user\_id (FK → USER)

# \- specialization

# \- qualification

# \- is\_verified

# 

# \### AVAILABILITY

# \- id (PK)

# \- doctor\_id (FK → DOCTOR)

# \- day\_of\_week

# \- start\_time

# \- end\_time

# 

# \### SLOT

# \- id (PK)

# \- doctor\_id (FK → DOCTOR)

# \- slot\_date

# \- slot\_time

# \- status

# 

# \### APPOINTMENT

# \- id (PK)

# \- patient\_id (FK → PATIENT)

# \- doctor\_id (FK → DOCTOR)

# \- slot\_id (FK → SLOT)

# \- status

# \- booked\_at

# 

# \### NOTIFICATION

# \- id (PK)

# \- user\_id (FK → USER)

# \- title

# \- message

# \- is\_read

# 

# \## Relationships

# 

# \- USER → PATIENT (one to one)

# \- USER → DOCTOR (one to one)

# \- DOCTOR → AVAILABILITY (one to many)

# \- DOCTOR → SLOT (one to many)

# \- SLOT → APPOINTMENT (one to one)

# \- PATIENT → APPOINTMENT (one to many)

# \- DOCTOR → APPOINTMENT (one to many)

# \- USER → NOTIFICATION (one to many)

