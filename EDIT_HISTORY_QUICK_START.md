# 🚀 Edit History - Quick Start Guide

## Setup Instructions

### 1. Run Database Migration

```bash
cd backend
npx prisma migrate deploy
```

This creates:
- `aircraft_edit_history` table
- `vessel_edit_history` table

### 2. Restart Backend

```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

---

## How It Works

### For Admin/Operator Users

**Editing an Aircraft:**
1. Go to aircraft detail page
2. Click **"Chỉnh sửa"** button
3. Modify fields (Call Sign, Aircraft Type, etc.)
4. Click **"Lưu"** button
5. Scroll down to **"Lịch sử chỉnh sửa"** section
6. See your edit with:
   - Your username
   - What fields changed
   - When you changed it

**Editing a Vessel:**
- Same process as aircraft
- Can update Vessel Name, Type, Flag, Dimensions, etc.

---

## What Gets Tracked

### Aircraft Fields
- ✅ Call Sign
- ✅ Registration Number
- ✅ Aircraft Type
- ✅ Operator

### Vessel Fields  
- ✅ Vessel Name
- ✅ Vessel Type
- ✅ Flag
- ✅ Operator
- ✅ Length
- ✅ Width

---

## Viewing Edit History

### In Detail Page

**Aircraft:** http://localhost:3000/aircraft/{id}
**Vessel:** http://localhost:3000/vessels/{id}

Scroll to **"Lịch sử chỉnh sửa"** section to see:

| Người chỉnh sửa | Thay đổi | Thời gian |
|---|---|---|
| admin | Call Sign: VNA123 | 07/11/2025 14:30 |
| | Aircraft Type: A320 | |
| operator1 | Operator: Vietnam Airlines | 07/11/2025 14:25 |

### API Endpoint

```bash
# Get aircraft edit history
curl http://localhost:3001/api/aircrafts/1/edit-history

# Get vessel edit history
curl http://localhost:3001/api/vessels/1/edit-history

# With pagination
curl http://localhost:3001/api/aircrafts/1/edit-history?limit=50&offset=0
```

---

## Features

✅ **Automatic Recording** - Edits tracked automatically when you save  
✅ **User Attribution** - Shows who made each edit  
✅ **Change Details** - Shows exactly what fields changed  
✅ **Timestamps** - Shows when edit was made  
✅ **Pagination** - History paginated (10 per page)  
✅ **Secure** - Only authenticated users can view  

---

## Testing

### Test Edit Recording

1. Login as admin/operator
2. Go to any aircraft detail page
3. Click Edit button
4. Change "Call Sign" to "TEST123"
5. Click Save
6. Scroll down to "Lịch sử chỉnh sửa"
7. Should see new entry with your username and the change

### Test API

```bash
# View all aircraft
curl http://localhost:3001/api/aircrafts

# View edit history for aircraft #1
curl http://localhost:3001/api/aircrafts/1/edit-history

# View second page of history
curl 'http://localhost:3001/api/aircrafts/1/edit-history?limit=10&offset=10'
```

---

## Troubleshooting

### Edit history not showing

**Check 1:** Database migration ran
```bash
cd backend
npx prisma migrate status
```

**Check 2:** Backend restarted
```bash
# Kill and restart
npm run start:dev
```

**Check 3:** User logged in with admin/operator role
- Only admins and operators can edit
- History visible to all authenticated users

### API Error 404

**Check:** Using correct endpoint format
- ❌ Wrong: `/api/aircrafts/1/edithistory`
- ✅ Correct: `/api/aircrafts/1/edit-history`

### Changes not recorded

**Check:** User is authenticated
- Edit is only recorded if `req.user.id` exists
- Verify JWT token is valid
- Check browser console for auth errors

---

## Database Schema

```sql
-- Aircraft Edit History Table
CREATE TABLE aircraft_edit_history (
  id SERIAL PRIMARY KEY,
  aircraftId INT NOT NULL,
  userId INT NOT NULL,
  changes TEXT NOT NULL,
  editedAt TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (aircraftId) REFERENCES aircrafts(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_aircraft_id (aircraftId),
  INDEX idx_edited_at (editedAt)
);

-- Vessel Edit History Table (same structure)
CREATE TABLE vessel_edit_history (
  id SERIAL PRIMARY KEY,
  vesselId INT NOT NULL,
  userId INT NOT NULL,
  changes TEXT NOT NULL,
  editedAt TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (vesselId) REFERENCES vessels(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_vessel_id (vesselId),
  INDEX idx_edited_at (editedAt)
);
```

---

## File Locations

### Backend
- Services: `backend/src/aircraft/aircraft.service.ts`, `backend/src/vessel/vessel.service.ts`
- Controllers: `backend/src/aircraft/aircraft.controller.ts`, `backend/src/vessel/vessel.controller.ts`
- DTOs: `backend/src/aircraft/dto/aircraft-edit-history.dto.ts`

### Frontend
- Components: `frontend/src/components/aircraft/EditHistoryTable.tsx`
- Pages: `frontend/src/app/aircraft/[id]/page.tsx`

---

## Next Steps

After setup:

1. ✅ Test editing an aircraft
2. ✅ Verify edit history displays
3. ✅ Test with multiple edits
4. ✅ Check pagination works
5. ✅ Verify correct username shows

---

## Support Commands

```bash
# Check if migration applied
cd backend && npx prisma migrate status

# Format Prisma schema
cd backend && npx prisma format

# Regenerate Prisma client
cd backend && npx prisma generate

# View database directly
# (psql command - adjust connection details)
psql postgresql://user:password@localhost:5432/tracking \
  -c "SELECT * FROM aircraft_edit_history ORDER BY editedAt DESC LIMIT 10;"
```

---

## Performance Notes

- Queries optimized with database indexes
- Pagination set to 10 records per page (configurable)
- Edit history is immutable (append-only audit log)
- Automatic cleanup not implemented yet

---

**Status:** ✅ Ready for Production

For detailed documentation, see: `EDIT_HISTORY_IMPLEMENTATION.md`

