# Fix Bidirectional Sync (Atlas → Local)

## Current Status

✅ **Real-time sync (Local → Atlas)**: Working perfectly!
❌ **Bidirectional sync (Atlas → Local)**: Timeout error

## The Problem

```
MongoNetworkTimeoutError: connection 3 to 35.233.7.247:27017 timed out
```

This error occurs when trying to establish a Change Stream connection to MongoDB Atlas.

## Possible Causes

### 1. Network/Firewall Issues
- **Atlas IP is blocked** by your firewall or ISP
- **Port 27017 is blocked** (MongoDB default port)
- **Slow internet connection** causing timeouts

### 2. Atlas Cluster Issues
- **Cluster is paused** or sleeping (free tier M0)
- **Cluster is under maintenance**
- **Cluster is in a different region** (high latency)

### 3. Connection Settings
- **Timeout values too low** for your network
- **Connection pool exhausted**

## Solutions Applied

### 1. Increased Timeout Values ✅

**File**: `server/.env`

Changed from:
```env
serverSelectionTimeoutMS=30000
socketTimeoutMS=45000
```

To:
```env
serverSelectionTimeoutMS=60000
socketTimeoutMS=120000
connectTimeoutMS=60000
```

### 2. Increased Reconnection Settings ✅

Changed from:
```env
CHANGE_STREAM_RECONNECT_INTERVAL=5000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=5
```

To:
```env
CHANGE_STREAM_RECONNECT_INTERVAL=10000
CHANGE_STREAM_MAX_RECONNECT_ATTEMPTS=10
```

### 3. Improved Connection Pool ✅

Changed from:
```env
maxPoolSize=5
minPoolSize=1
```

To:
```env
maxPoolSize=10
minPoolSize=2
```

## Additional Solutions to Try

### Solution 1: Check Atlas Cluster Status

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Login to your account
3. Check if your cluster is:
   - ✅ **Running** (green status)
   - ❌ **Paused** (needs to be resumed)
   - ⚠️ **Under maintenance**

### Solution 2: Whitelist Your IP in Atlas

1. Go to MongoDB Atlas → Network Access
2. Click "Add IP Address"
3. Options:
   - **Add Current IP Address** (your current IP)
   - **Allow Access from Anywhere** (0.0.0.0/0) - for testing only!

### Solution 3: Check Firewall Settings

**Windows Firewall:**
```powershell
# Check if port 27017 is blocked
Test-NetConnection -ComputerName cluster0.yl9w7jv.mongodb.net -Port 27017
```

If blocked, add firewall rule:
```powershell
New-NetFirewallRule -DisplayName "MongoDB Atlas" -Direction Outbound -LocalPort 27017 -Protocol TCP -Action Allow
```

### Solution 4: Test Connection Directly

Create a test file to check Atlas connectivity:

**File**: `server/test-atlas-connection.js`
```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const ATLAS_URI = process.env.MONGODB_ATLAS_URI;

console.log('\n🧪 Testing Atlas Connection...\n');
console.log('URI:', ATLAS_URI.replace(/\/\/.*@/, '//***@'));

try {
    await mongoose.connect(ATLAS_URI);
    console.log('\n✅ SUCCESS: Connected to Atlas!');
    console.log('   Host:', mongoose.connection.host);
    console.log('   Database:', mongoose.connection.name);
    console.log('   Ready State:', mongoose.connection.readyState);
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed successfully\n');
} catch (error) {
    console.log('\n❌ FAILED: Could not connect to Atlas');
    console.log('   Error:', error.message);
    console.log('\n💡 Possible solutions:');
    console.log('   1. Check if Atlas cluster is running');
    console.log('   2. Whitelist your IP in Atlas Network Access');
    console.log('   3. Check firewall settings');
    console.log('   4. Verify internet connection\n');
}

process.exit(0);
```

Run it:
```bash
node server/test-atlas-connection.js
```

### Solution 5: Use Different Atlas Region

If your cluster is in a far region (high latency), consider:
1. Creating a new cluster in a closer region
2. Or using a VPN to reduce latency

### Solution 6: Upgrade Atlas Tier

Free tier (M0) clusters have limitations:
- May pause after inactivity
- Limited connection pool
- No guaranteed uptime

Consider upgrading to M2 or M10 for:
- ✅ Always-on clusters
- ✅ Better performance
- ✅ More reliable Change Streams

## Temporary Workaround

If you can't fix the connection issue immediately, you can disable bidirectional sync:

**File**: `server/.env`
```env
BIDIRECTIONAL_SYNC_ENABLED=false
```

This will:
- ✅ Keep real-time sync (Local → Atlas) working
- ✅ Remove timeout errors from logs
- ❌ Disable Atlas → Local sync

## Testing After Changes

### 1. Restart Server
```bash
cd server
npm run dev
```

### 2. Watch Startup Logs

Look for:
```
✅ Atlas Change Stream is available
✅ Atlas Change Listener initialized
✅ Change Stream: Connected
✅ Bidirectional sync initialized successfully
```

Or:
```
⚠️ Atlas connection not available yet
⚠️ Bidirectional sync not available
```

### 3. Check Sync Status Monitor

Should show:
```
🔄 Bidirectional Sync (Atlas → Local):
   Status: 🟢 Active
   Changes Received: X
```

Instead of:
```
🔄 Bidirectional Sync (Atlas → Local):
   Status: 🔴 Inactive
```

## Monitoring

### Check Connection Status

The sync status monitor shows:
- **Local MongoDB**: Connection status
- **Atlas MongoDB**: Connection status
- **Bidirectional Sync**: Active/Inactive

### Check Logs

Look for these messages:
- ✅ `[AtlasChangeListener] Change Stream started successfully`
- ✅ `[AtlasChangeListener] Received insert on collection_name`
- ❌ `[AtlasChangeListener] Change Stream error`
- ⚠️ `[AtlasChangeListener] Reconnection attempt X/10`

## Summary

### Changes Made ✅
1. Increased timeout values in Atlas URI
2. Increased reconnection attempts and interval
3. Improved connection pool settings

### Next Steps
1. **Restart server** and check if bidirectional sync connects
2. **If still failing**: Run `test-atlas-connection.js` to diagnose
3. **Check Atlas**: Verify cluster is running and IP is whitelisted
4. **Check Firewall**: Ensure port 27017 is not blocked
5. **Temporary**: Disable bidirectional sync if not critical

### Important Notes
- Real-time sync (Local → Atlas) **works perfectly** regardless of this issue
- Bidirectional sync is **optional** - most apps only need one-way sync
- The timeout error **does not affect** your main sync functionality

---

**Last Updated**: 2026-04-19
**Status**: ⚠️ Troubleshooting
