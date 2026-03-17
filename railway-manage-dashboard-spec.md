# Railway Manage — Dashboard Layout Spec

## 🎯 Goal

Create a **clear, actionable DevOps dashboard** with:

- Strong visual hierarchy
- Fast scanning
- Minimal cognitive load
- Focus on **backups + system health**

---

# 🧱 Layout Overview


[ Stats Row ]

[ System Health Summary ]

[ Recent Backups (Primary) ]

[ Upcoming Jobs ] [ Recent Activity ]

[ Quick Reference (Collapsed) ]


---

# 1️⃣ Stats Row (Top)

## Purpose
Quick high-level system overview.

## Layout


[ Managed Services ] [ Total Services ] [ Backups (24h) ] [ Failures ]


## Example


1 8 4 1
Managed Services Backups Failed


## Improvements

- Add subtle labels (muted text)
- Add color for failures (red)
- Optional: add trend arrows later

---

# 2️⃣ System Health Summary (NEW — very important)

## Purpose
Give **instant insight**, not just raw data.

## Layout


System Status: ✅ Healthy

Last Backup: 2 mins ago
Failures (24h): 1
Next Backup: in 1h 53m


## Variants

### Healthy

✅ All systems operational


### Warning

⚠ 1 backup failed in last 24h


### Critical

❌ No successful backups in last 6h


---

# 3️⃣ Recent Backups (PRIMARY SECTION)

## Purpose
Main feature of the product → must dominate visually.

## Layout

Full-width table

Recent Backups
Service Schedule Status Time

umami-db hourly success 2m ago
umami-db hourly success 1h ago
umami-db daily success 2h ago
umami-db daily failed 12h ago


## UI Notes

- Use **colored status badges**
  - green → success
  - red → failed
- Show **relative time** (2m ago)
- Add “View all” button (top-right)

---

# 4️⃣ Secondary Section (Split Layout)

## Layout


[ Upcoming Jobs ] [ Recent Activity ]


---

## 4A — Upcoming Jobs

### Purpose
Show what's coming next, not full schedules.

### Layout

Upcoming Jobs

backup_hourly in 1h 53m
backup_daily in 6h
backup_weekly tomorrow


### Improvements

- Avoid full cron display (too noisy)
- Focus on **next execution time**
- Add "View Jobs" CTA

---

## 4B — Recent Activity

### Purpose
Audit + debugging visibility.

### Layout

Recent Activity

auth.login_success admin 2m ago
backup.completed system 5m ago
backup.failed system 2h ago
service.deleted admin 3h ago


### Improvements

- Add icons per event type
- Color-code failures
- Keep it lightweight

---

# 5️⃣ Quick Reference (LOW PRIORITY)

## Problem (current)
- Too prominent
- Not frequently needed

## Solution

Make it:


Quick Reference ▼


(collapsed by default)

---

## Expanded view


• Backup files stored in /data/backups
• JWT stored in httpOnly cookie
• Use BACKUP_STORAGE_PATH to change location
• Login is rate-limited
• Trigger manual backup from Backups page


---

# 🎨 Visual Hierarchy Rules

## Priority Levels

| Level | Section |
|------|--------|
| 1 | Stats |
| 2 | System Health |
| 3 | Recent Backups |
| 4 | Jobs + Activity |
| 5 | Quick Reference |

---

## Spacing

- Section gap: `24px`
- Card padding: `16px`
- Row height: `40–48px`

---

## Colors

- Background: dark (existing)
- Success: green
- Error: red
- Warning: yellow
- Muted text: gray-400

---

# 🧠 UX Principles Applied

## 1. Scan-first design

User should understand system in **< 3 seconds**:


Is system healthy?
Are backups working?
Anything broken?


---

## 2. Reduce cognitive load

Avoid:

- large tables everywhere
- redundant data
- full cron expressions

Prefer:

- summaries
- relative times
- grouped info

---

## 3. Actionable > Informational

Every section should answer:


What should the user do next?


---

# 🚀 Future Enhancements

## 1. Add charts

- backup success rate
- failures over time

---

## 2. Add alerts panel


⚠ Backup failed for umami-db


---

## 3. Add filtering

- by service
- by status

---

## 4. Add “Retry failed backup” action

---

# 🧩 Final Layout Summary


[ Stats Row ]

[ System Health Summary ]

[ Recent Backups ]

[ Upcoming Jobs ] [ Recent Activity ]

[ Quick Reference ▼ ]


---

# ✅ Outcome

After applying this:

- UI feels **focused**
- Dashboard becomes **actionable**
- Less noise, more clarity
- Feels like a **real DevOps control panel**
