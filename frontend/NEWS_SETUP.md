# News Feature Setup Guide

## Quick Start

The news feature has been integrated into the tracking application. Follow these steps to configure and use it:

## 1. Environment Configuration

Create a `.env.local` file in the `frontend` directory with the following content:

```bash
# News API Configuration
NEXT_PUBLIC_NEWS_API_URL=http://123.24.132.241:8000
```

**Note:** If you're deploying to production, update this URL to your production news API endpoint.

## 2. Files Created/Modified

### New Files:
- `frontend/src/stores/newsStore.ts` - News state management with Zustand
- `frontend/NEWS_INTEGRATION.md` - Detailed API documentation
- `frontend/NEWS_SETUP.md` - This setup guide

### Modified Files:
- `frontend/src/app/news/page.tsx` - Updated to use real API

## 3. Features

### Available Now:
- ✅ Fetch news from external API
- ✅ Search functionality (debounced)
- ✅ Filter by read/unread/bookmarked status
- ✅ Pagination
- ✅ View article details
- ✅ Display article images
- ✅ Link to original source
- ✅ Responsive grid layout

### Optimistic Updates (UI Only):
- 🟡 Toggle bookmark status
- 🟡 Toggle read status
- 🟡 Delete articles

**Note:** Bookmark, read status, and delete operations update the UI immediately but need backend API endpoints to persist changes.

## 4. Testing

### Start the Development Server:

```bash
cd frontend
npm run dev
```

### Navigate to News Page:

Open your browser and go to: `http://localhost:3000/news`

### Test Search:
1. Type in the search box
2. Wait 500ms for debounce
3. Results will update automatically

### Test Filters:
- Click "Tất cả" - Show all articles
- Click "Chưa đọc" - Show unread articles
- Click "Đã đọc" - Show read articles  
- Click "Đã lưu" - Show bookmarked articles

### Test Pagination:
- Use "← Trước" and "Sau →" buttons
- Page indicator shows current/total pages

### Test Article View:
1. Click "Xem" on any article
2. Article opens in modal
3. Automatically marked as read
4. Click "Xem nguồn ↗" to open original article

## 5. API Integration Details

### Current Implementation:
```typescript
// Direct API call to external service
const response = await fetch(`${API_URL}/api/news/GetAllByFilter`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    Page: 1,
    PageSize: 20,
    TextSearch: "search term",
    UserId: 1, // TODO: Get from auth
    ViewType: "grid",
    Filter: { /* filter options */ }
  })
});
```

### Default Filter Values:
```typescript
{
  IsRead: -1,        // -1 = all, 0 = unread, 1 = read
  IsBookmarked: -1,  // -1 = all, 0 = not bookmarked, 1 = bookmarked
  IsDelete: 0,       // 0 = not deleted
  AllTitle: 1,       // Search in titles
  AllContent: -1,    // Don't search in content by default
  // ... other filters
}
```

## 6. Customization

### Change Page Size:
Edit `frontend/src/stores/newsStore.ts`:
```typescript
pageSize: 20,  // Change to your preferred value (e.g., 50)
```

### Change Default View:
Edit `frontend/src/stores/newsStore.ts`:
```typescript
viewType: 'grid',  // Options: 'grid', 'table', 'list'
```

### Adjust Search Debounce:
Edit `frontend/src/app/news/page.tsx`:
```typescript
const timer = setTimeout(() => {
  setSearchQuery(localSearchTerm);
  // ...
}, 500);  // Change delay in milliseconds
```

## 7. Troubleshooting

### Issue: CORS Error

**Problem:** Browser shows CORS policy error when fetching news.

**Solution:**
1. Configure the news API server to allow CORS from your domain
2. Or proxy requests through your backend
3. Add to `next.config.ts`:

```typescript
async rewrites() {
  return [
    {
      source: '/api/news/:path*',
      destination: 'http://123.24.132.241:8000/api/news/:path*',
    },
  ];
}
```

Then update `newsStore.ts` to use `/api/news` instead of the full URL.

### Issue: No Articles Showing

**Checklist:**
- ✓ Check browser console for errors
- ✓ Verify API URL in environment variable
- ✓ Confirm API is accessible: `curl http://123.24.132.241:8000/api/news/GetAllByFilter`
- ✓ Check Network tab in browser DevTools
- ✓ Verify UserId exists in the news system

### Issue: Images Not Loading

**Cause:** Image URLs might be invalid or blocked by CORS.

**Solution:** Images will automatically hide on error (graceful degradation).

### Issue: Search Not Working

**Checklist:**
- ✓ Wait 500ms after typing (debounce delay)
- ✓ Check browser console for errors
- ✓ Verify search parameter is being sent in API request

## 8. Production Deployment

### Environment Variables:
1. Set `NEXT_PUBLIC_NEWS_API_URL` in your hosting platform
2. For Vercel/Netlify: Add in project settings
3. For Docker: Add to docker-compose.yml or .env file

### Security Considerations:
1. **API Authentication:** Add JWT token to requests
2. **Rate Limiting:** Implement on backend to prevent abuse
3. **Input Sanitization:** The API should sanitize HTML content
4. **HTTPS:** Use HTTPS for production API endpoint

### Performance Optimization:
1. Enable caching for API responses
2. Consider implementing infinite scroll
3. Lazy load images
4. Add service worker for offline support

## 9. Next Steps

### To Complete Full Integration:

1. **Backend API Endpoints:** Create endpoints for:
   - Toggle bookmark status
   - Toggle read status
   - Delete article
   - Create/edit articles

2. **Authentication:** 
   - Integrate with auth store
   - Use real user ID from logged-in user
   - Add JWT token to requests

3. **Real-time Updates:**
   - WebSocket integration for new articles
   - Notifications for breaking news

4. **Advanced Features:**
   - Article categories
   - Advanced filtering (date range, tags, etc.)
   - Export functionality
   - Share articles

## 10. Support

For issues or questions:
1. Check `NEWS_INTEGRATION.md` for detailed API documentation
2. Review browser console for errors
3. Test API endpoint directly with curl or Postman
4. Check network requests in browser DevTools

## Example API Test with curl:

```bash
curl -X POST http://123.24.132.241:8000/api/news/GetAllByFilter \
  -H "Content-Type: application/json" \
  -d '{
    "Page": 1,
    "PageSize": 10,
    "TextSearch": null,
    "UserId": 1,
    "ViewType": "grid",
    "Filter": {
      "IsRead": -1,
      "IsBookmarked": -1,
      "IsDelete": 0
    }
  }'
```

This should return a JSON response with news articles.

