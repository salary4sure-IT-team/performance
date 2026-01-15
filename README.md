# Google Sheets Leaderboard - Express App

A real-time leaderboard application built with Express.js that connects to **published** Google Sheets and updates automatically. **No Google Cloud Console setup required!**

## Features

- ✅ Real-time updates via WebSocket (Socket.IO)
- ✅ Automatic data refresh every 5 seconds
- ✅ Beautiful, responsive UI
- ✅ Google Sheets integration (using published sheets - no authentication!)
- ✅ REST API endpoint for manual data fetching
- ✅ Fallback polling mechanism
- ✅ **No Google Cloud Console or Service Account needed**

## Prerequisites

- Node.js (v14 or higher)
- A **published** Google Sheet (see setup below)

## Setup Instructions

### 1. Publish Your Google Sheet

1. Open your Google Sheet
2. Click **File** > **Share** > **Publish to web**
3. Select the sheet/tab you want to publish
4. Choose **CSV** format
5. Click **Publish**
6. Copy the published URL (it will look like: `https://docs.google.com/spreadsheets/d/e/.../pub?output=csv&gid=0`)

**Note:** Your sheet must be published for this to work. The app reads from the published CSV endpoint, which doesn't require authentication.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

The `.env` file is already configured with your published sheet URL. If you need to change it:

```env
PUBLISHED_SHEET_URL=https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?output=csv&gid=0
PORT=3000
```

**How to get your Published Sheet URL:**
- After publishing your sheet (step 1), copy the CSV URL
- It should look like: `https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv&gid=0`
- The `gid=0` parameter specifies which sheet/tab to use (0 = first sheet)

### 4. Run the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The app will be available at `http://localhost:3000`

## Google Sheet Format

Your Google Sheet should have:
- **First row**: Column headers (e.g., Name, Score, Points, etc.)
- **Subsequent rows**: Data rows

Example:
| Name | Score | Team | Date |
|------|-------|------|------|
| John Doe | 1500 | Team A | 2024-01-15 |
| Jane Smith | 1200 | Team B | 2024-01-15 |

The app will automatically:
- Sort by score/points (if detected) in descending order
- Add rank numbers
- Format numbers with commas
- Update in real-time

## API Endpoints

### GET `/api/leaderboard`
Returns the current leaderboard data as JSON.

**Response:**
```json
[
  {
    "Name": "John Doe",
    "Score": "1500",
    "Team": "Team A"
  },
  ...
]
```

## Real-time Updates

The app uses Socket.IO for real-time updates:
- Updates automatically every 5 seconds
- WebSocket connection status is shown in the header
- Falls back to REST API polling if WebSocket fails

## How It Works

Instead of using the Google Sheets API (which requires authentication), this app:
1. Reads from your **published** Google Sheet's CSV endpoint
2. Parses the CSV data into JSON
3. Serves it via REST API and WebSocket
4. Updates automatically every 5 seconds

**Advantages:**
- ✅ No Google Cloud Console setup
- ✅ No Service Account needed
- ✅ No authentication required
- ✅ Simple and fast
- ✅ Works with any published sheet

**Limitations:**
- ⚠️ Sheet must be published (publicly accessible)
- ⚠️ Read-only access (can't write to the sheet)
- ⚠️ Slight delay (up to 5 seconds) for updates

## Customization

### Change Update Interval

Edit `server.js` and modify the `UPDATE_INTERVAL`:
```javascript
const UPDATE_INTERVAL = 5000; // Change to desired milliseconds
```

### Modify Styling

Edit `public/styles.css` to customize the appearance.

### Change Sheet URL

Update the `PUBLISHED_SHEET_URL` in `.env` file.

## Troubleshooting

### "Failed to fetch leaderboard data"
- Verify your sheet is **published** (File > Share > Publish to web)
- Check that the `PUBLISHED_SHEET_URL` in `.env` is correct
- Ensure the URL ends with `&output=csv&gid=0` (or correct gid for your sheet)
- Try opening the CSV URL directly in your browser to verify it works

### "No data available"
- Check that your sheet has data rows (not just headers)
- Verify the `gid` parameter matches your sheet tab (0 = first sheet, 1 = second, etc.)
- Ensure the CSV URL is accessible (try it in a browser)

### Connection Issues
- Check that the server is running
- Verify the port isn't already in use
- Check browser console for errors

### Sheet Not Updating
- Make sure your sheet is published
- Check that you're editing the same sheet that's published
- The app updates every 5 seconds - wait a moment for changes to appear

## License

ISC
