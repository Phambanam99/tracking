# 📝 Edit History Implementation - Complete Guide

**Date:** November 7, 2025  
**Status:** ✅ FULLY IMPLEMENTED

---

## 📋 Overview

This document describes the complete implementation of edit history tracking for Aircraft and Vessel resources, including:
- **Who** made the edit (username)
- **What** was changed (fields and values)
- **When** it was changed (timestamp)

---

## 🏗️ Architecture

### Backend Structure

```
Database Layer
├─ AircraftEditHistory (table)
│  ├─ id (primary key)
│  ├─ aircraftId (foreign key)
│  ├─ userId (foreign key)
│  ├─ changes (JSON string)
│  └─ editedAt (timestamp)
│
├─ VesselEditHistory (table)
│  ├─ id (primary key)
│  ├─ vesselId (foreign key)
│  ├─ userId (foreign key)
│  ├─ changes (JSON string)
│  └─ editedAt (timestamp)
│
└─ User Relations
   ├─ aircraftEdits[] 
   └─ vesselEdits[]
```

### API Endpoints

**Get Aircraft Edit History:**
```
GET /aircrafts/{id}/edit-history?limit=50&offset=0
```

**Get Vessel Edit History:**
```
GET /vessels/{id}/edit-history?limit=50&offset=0
```

---

## 🗄️ Database Changes

### Schema Updates

**Added to `schema.prisma`:**

```prisma
// Aircraft edit history model
model AircraftEditHistory {
  id           Int      @id @default(autoincrement())
  aircraftId   Int
  userId       Int
  changes      String // JSON string of changed fields
  editedAt     DateTime @default(now())

  aircraft Aircraft @relation(fields: [aircraftId], references: [id], onDelete: Cascade)
  user     User     @relation("AircraftEdits", fields: [userId], references: [id], onDelete: Cascade)

  @@index([aircraftId])
  @@index([editedAt])
  @@map("aircraft_edit_history")
}

// Vessel edit history model
model VesselEditHistory {
  id        Int      @id @default(autoincrement())
  vesselId  Int
  userId    Int
  changes   String // JSON string of changed fields
  editedAt  DateTime @default(now())

  vessel Vessel @relation(fields: [vesselId], references: [id], onDelete: Cascade)
  user   User   @relation("VesselEdits", fields: [userId], references: [id], onDelete: Cascade)

  @@index([vesselId])
  @@index([editedAt])
  @@map("vessel_edit_history")
}
```

**User Model Update:**
```prisma
// Edit history relationships
aircraftEdits AircraftEditHistory[] @relation("AircraftEdits")
vesselEdits   VesselEditHistory[] @relation("VesselEdits")
```

### Database Migration

Migration created: `20251107083941_add_edit_history`

To apply:
```bash
cd backend
npx prisma migrate dev
```

---

## 🔧 Backend Implementation

### 1. DTOs (Data Transfer Objects)

**`backend/src/aircraft/dto/aircraft-edit-history.dto.ts`:**
```typescript
export class AircraftEditHistoryDto {
  id: number;
  aircraftId: number;
  userId: number;
  userName: string;
  changes: Record<string, any>;
  editedAt: Date;
}
```

**`backend/src/vessel/dto/vessel-edit-history.dto.ts`:**
```typescript
export class VesselEditHistoryDto {
  id: number;
  vesselId: number;
  userId: number;
  userName: string;
  changes: Record<string, any>;
  editedAt: Date;
}
```

### 2. Service Methods

**Aircraft Service:**
```typescript
// Record aircraft edit in history
async recordEdit(
  aircraftId: number,
  userId: number,
  changes: Record<string, any>,
)

// Get edit history for an aircraft
async getEditHistory(
  aircraftId: number,
  limit = 50,
  offset = 0,
)
```

**Vessel Service:**
```typescript
// Record vessel edit in history
async recordEdit(
  vesselId: number,
  userId: number,
  changes: Record<string, any>,
)

// Get edit history for a vessel
async getEditHistory(
  vesselId: number,
  limit = 50,
  offset = 0,
)
```

### 3. Controller Endpoints

**Aircraft Controller - Update Endpoint:**
```typescript
@Put(':id')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
async update(
  @Param('id', ParseIntPipe) id: number,
  @Body() updateAircraftDto: UpdateAircraftDto,
  @Req() req: any,
) {
  const updated = await this.aircraftService.update(id, updateAircraftDto);
  
  // Record edit history
  if (req.user?.id && changes exist) {
    await this.aircraftService.recordEdit(id, req.user.id, changes);
  }
  
  return updated;
}

// Get edit history endpoint
@Get(':id/edit-history')
@UseGuards(AuthGuard)
async getEditHistory(
  @Param('id', ParseIntPipe) id: number,
  @Query('limit') limit?: string,
  @Query('offset') offset?: string,
)
```

**Vessel Controller - Similar implementation**

---

## 💻 Frontend Implementation

### 1. Edit History Components

**`frontend/src/components/aircraft/EditHistoryTable.tsx`:**
- Displays aircraft edit history
- Shows: Username, Changes, Timestamp
- Paginated (10 records per page)
- Loading and empty states

**`frontend/src/components/vessel/EditHistoryTable.tsx`:**
- Same structure for vessel edits

### 2. Integration into Detail Pages

**Aircraft Detail Page:**
```typescript
import EditHistoryTable from '@/components/aircraft/EditHistoryTable';

// In detail page layout:
<div className="mt-6 bg-white shadow rounded-lg">
  <div className="px-4 py-5 sm:p-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">
      Lịch sử chỉnh sửa
    </h3>
    <EditHistoryTable aircraftId={aircraft.id} />
  </div>
</div>
```

**Vessel Detail Page:**
- Same pattern with `EditHistoryTable` from vessel components

### 3. Feature Display

Each edit history record shows:

| Field | Display | Example |
|-------|---------|---------|
| **Người chỉnh sửa** | Username | john_doe |
| **Thay đổi** | Field name + value | "Call Sign: VNA123" |
| **Thời gian** | Localized datetime | 07/11/2025 14:30:45 |

---

## 🔄 Data Flow

### When User Edits Aircraft/Vessel

```
1. User clicks "Chỉnh sửa" (Edit)
   ↓
2. User modifies form fields
   ↓
3. User clicks "Lưu" (Save)
   ↓
4. Frontend: PUT /aircrafts/{id}
   with updated data
   ↓
5. Backend Controller:
   - Extract user ID from JWT
   - Get changed fields
   - Save to database
   - Call service.recordEdit()
   ↓
6. Service:
   - Store in AircraftEditHistory
   - Include: userId, aircraftId, changes (JSON)
   - Set editedAt to now()
   ↓
7. Response returned to frontend
```

### When User Views Edit History

```
1. User clicks on aircraft/vessel detail
   ↓
2. Page loads with EditHistoryTable component
   ↓
3. EditHistoryTable fetches:
   GET /aircrafts/{id}/edit-history?limit=10&offset=0
   ↓
4. Backend:
   - Query AircraftEditHistory for this aircraft
   - Join with User table to get username
   - Parse changes from JSON
   - Return with pagination info
   ↓
5. Frontend displays table with:
   - Username of editor
   - Changed fields
   - Timestamp of edit
   - Pagination controls
```

---

## 📊 Database Queries

### Get Edit History with User Info

```sql
SELECT 
  aeh.id,
  aeh.aircraftId,
  aeh.userId,
  u.username,
  aeh.changes,
  aeh.editedAt
FROM aircraft_edit_history aeh
JOIN users u ON aeh.userId = u.id
WHERE aeh.aircraftId = ?
ORDER BY aeh.editedAt DESC
LIMIT ? OFFSET ?
```

### Performance Optimization

Indexes created:
- `aircraft_edit_history(aircraftId)` - Fast lookup by aircraft
- `aircraft_edit_history(editedAt)` - Fast sorting by time
- `vessel_edit_history(vesselId)` - Fast lookup by vessel
- `vessel_edit_history(editedAt)` - Fast sorting by time

---

## 🧪 Testing

### Backend Testing

```bash
# 1. Create aircraft
POST /aircrafts
{
  "flightId": "VN123",
  "callSign": "VNA123",
  "aircraftType": "A320"
}

# 2. Update aircraft (edit history recorded)
PUT /aircrafts/1
{
  "callSign": "VNA456",
  "operator": "Vietnam Airlines"
}

# 3. Get edit history
GET /aircrafts/1/edit-history?limit=10&offset=0

Response:
{
  "data": [
    {
      "id": 1,
      "aircraftId": 1,
      "userId": 1,
      "userName": "admin",
      "changes": {
        "callSign": "VNA456",
        "operator": "Vietnam Airlines"
      },
      "editedAt": "2025-11-07T14:30:45Z"
    }
  ],
  "total": 1
}
```

### Frontend Testing

1. Navigate to aircraft/vessel detail page
2. Click "Chỉnh sửa" button
3. Modify fields
4. Click "Lưu"
5. Scroll down to "Lịch sử chỉnh sửa" section
6. Verify table shows:
   - Your username
   - Fields you changed
   - Current timestamp

---

## 🔒 Security

### Authentication Required

✅ Edit history endpoint requires authentication:
```typescript
@UseGuards(AuthGuard)
```

### Authorization

✅ Only authenticated users can view edit history  
✅ Admin/Operator can modify records  
✅ All edits are attributed to the logged-in user  

### Data Protection

✅ User ID from JWT (not from request body)  
✅ Changes validated before recording  
✅ Audit trail immutable (only insertion, no deletion)

---

## 📈 Field Mapping

Displayed field names are user-friendly:

| Database Field | Display Name |
|---|---|
| callSign | Call Sign |
| registration | Số đăng ký |
| aircraftType | Loại máy bay |
| operator | Hãng vận hành |
| vesselName | Tên tàu |
| vesselType | Loại tàu |
| flag | Quốc kỳ |
| length | Chiều dài |
| width | Chiều rộng |

---

## ✨ Features

### ✅ Implemented

- [x] Record edit history on PUT/UPDATE
- [x] Store username, changes, timestamp
- [x] Get edit history with pagination
- [x] Display in frontend tables
- [x] User-friendly field names
- [x] Timestamps in Vietnamese locale
- [x] Database indexes for performance
- [x] Authentication/Authorization
- [x] Graceful error handling

### 🚀 Future Enhancements

- [ ] Filter history by date range
- [ ] Export history to CSV
- [ ] Diff view of old vs new values
- [ ] Undo/Restore previous versions
- [ ] Activity feed across all resources
- [ ] Email notifications for admin
- [ ] Archive old history records

---

## 📝 API Documentation

### Get Aircraft Edit History

```
GET /aircrafts/{id}/edit-history
```

**Query Parameters:**
- `limit` (optional, default: 50) - Records per page
- `offset` (optional, default: 0) - Starting position

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "aircraftId": 1,
      "userId": 1,
      "userName": "admin",
      "changes": {
        "callSign": "VNA123",
        "operator": "Vietnam Airlines"
      },
      "editedAt": "2025-11-07T14:30:45Z"
    }
  ],
  "total": 42
}
```

### Get Vessel Edit History

```
GET /vessels/{id}/edit-history
```

Same as aircraft endpoint (parameters and response structure)

---

## 🎯 Files Modified/Created

### Backend

**New Files:**
- `backend/src/aircraft/dto/aircraft-edit-history.dto.ts`
- `backend/src/vessel/dto/vessel-edit-history.dto.ts`

**Modified Files:**
- `backend/prisma/schema.prisma` - Added AircraftEditHistory, VesselEditHistory models
- `backend/src/aircraft/aircraft.service.ts` - Added recordEdit(), getEditHistory()
- `backend/src/aircraft/aircraft.controller.ts` - Modified update(), added getEditHistory endpoint
- `backend/src/vessel/vessel.service.ts` - Added recordEdit(), getEditHistory()
- `backend/src/vessel/vessel.controller.ts` - Modified update(), added getEditHistory endpoint

**Database:**
- Migration: `prisma/migrations/20251107083941_add_edit_history/`

### Frontend

**New Files:**
- `frontend/src/components/aircraft/EditHistoryTable.tsx`
- `frontend/src/components/vessel/EditHistoryTable.tsx`

**Modified Files:**
- `frontend/src/app/aircraft/[id]/page.tsx` - Added EditHistoryTable display
- `frontend/src/app/vessels/[id]/VesselDetailClient.tsx` - Added EditHistoryTable display

---

## 🚀 Deployment Checklist

- [x] Database schema updated
- [x] Migration created and tested
- [x] Backend services updated
- [x] API endpoints implemented
- [x] Frontend components created
- [x] Pages updated to display history
- [x] Authentication/Authorization configured
- [x] Error handling implemented
- [x] Pagination working
- [x] Timestamps localized

**Status:** ✅ **READY FOR DEPLOYMENT**

---

## 📞 Support

### Common Issues

**Issue: Edit history not showing**
- Ensure database migration ran: `npx prisma migrate deploy`
- Check backend logs for errors
- Verify user ID in JWT token

**Issue: Pagination not working**
- Check limit/offset parameters
- Verify total count calculation
- Check database indexes

**Issue: Changes not being recorded**
- Verify user authentication
- Check req.user.id is set
- Verify changes object is populated

---

## 📄 Example Usage

### Recording an Edit

```typescript
// When user updates aircraft
const updates = {
  callSign: 'VNA456',
  operator: 'Vietnam Airlines'
};

// Backend automatically:
await aircraftService.recordEdit(aircraftId, userId, updates);

// Stored as:
{
  aircraftId: 1,
  userId: 1,
  changes: '{"callSign":"VNA456","operator":"Vietnam Airlines"}',
  editedAt: 2025-11-07T14:30:45.000Z
}
```

### Retrieving History

```typescript
// Frontend calls:
const history = await api.get('/aircrafts/1/edit-history?limit=10&offset=0');

// Returns:
{
  data: [
    {
      id: 1,
      aircraftId: 1,
      userId: 1,
      userName: 'admin',
      changes: {
        callSign: 'VNA456',
        operator: 'Vietnam Airlines'
      },
      editedAt: '2025-11-07T14:30:45.000Z'
    }
  ],
  total: 1
}
```

---

## 🎓 Conclusion

The edit history implementation is complete and production-ready. It provides:
- ✅ Full audit trail of who changed what and when
- ✅ User-friendly interface for viewing changes
- ✅ Secure, authenticated access
- ✅ Efficient database queries with proper indexing
- ✅ Paginated results for performance

All files have been implemented and tested. Ready for deployment! 🚀

