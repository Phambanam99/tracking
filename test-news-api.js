/**
 * Test script for News API integration
 * 
 * Usage: node test-news-api.js
 * 
 * This script tests the connection to the external news API
 * and displays sample results.
 */

const API_URL = 'http://123.24.132.241:8000';

async function testNewsAPI() {
  console.log('🧪 Testing News API Integration\n');
  console.log(`📡 API URL: ${API_URL}/api/news/GetAllByFilter\n`);

  const requestBody = {
    Page: 1,
    PageSize: 5,
    TextSearch: null,
    UserId: 1,
    ViewType: 'grid',
    Filter: {
      GroupNewsId: null,
      LinkId: null,
      FolderId: 0,
      IsRead: -1,
      IsBookmarked: -1,
      Option: 0,
      StartDate: null,
      EndDate: null,
      IsTag: -1,
      IsNote: -1,
      AllTitle: 1,
      AllContent: -1,
      IsDelete: 0,
      TagCategoryId: 0,
      IsSystemTag: -1,
      IsFolder: 0,
      NewsId: 0,
      TimeOrder: 0,
      IsNer: false,
      NerWordsId: 0,
      NerDateOption: 1,
      IsShare: null,
      IsMe: false,
      LanguageId: 0,
    },
  };

  console.log('📤 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n⏳ Sending request...\n');

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/news/GetAllByFilter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`✅ Success! (${duration}ms)\n`);
    console.log(`📊 Results:`);
    console.log(`   Total Articles: ${data.TotalCount || 0}`);
    console.log(`   Current Page: ${data.Page || 1}`);
    console.log(`   Page Size: ${data.PageSize || 0}`);
    console.log(`   Articles Returned: ${data.Data?.length || 0}\n`);

    if (data.Data && data.Data.length > 0) {
      console.log('📰 Sample Articles:\n');
      data.Data.forEach((article, index) => {
        console.log(`${index + 1}. ${article.Title || 'No title'}`);
        console.log(`   ID: ${article.Id}`);
        console.log(`   Source: ${article.SourceName || 'Unknown'}`);
        console.log(`   Published: ${article.PublishedDate || 'N/A'}`);
        console.log(`   Read: ${article.IsRead ? 'Yes' : 'No'}`);
        console.log(`   Bookmarked: ${article.IsBookmarked ? 'Yes' : 'No'}`);
        if (article.ImageUrl) {
          console.log(`   Image: ${article.ImageUrl.substring(0, 50)}...`);
        }
        console.log('');
      });
    }

    console.log('✨ API Test Completed Successfully!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Create frontend/.env.local with:');
    console.log(`      NEXT_PUBLIC_NEWS_API_URL=${API_URL}`);
    console.log('   2. Start the frontend: cd frontend && npm run dev');
    console.log('   3. Navigate to: http://localhost:3000/news');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check if API server is running');
    console.error('   2. Verify the API URL is correct');
    console.error('   3. Check network connectivity');
    console.error('   4. Try the API with curl:');
    console.error(`      curl -X POST ${API_URL}/api/news/GetAllByFilter \\`);
    console.error('        -H "Content-Type: application/json" \\');
    console.error(`        -d '${JSON.stringify(requestBody)}'`);
    return false;
  }
}

// Run the test
testNewsAPI();

