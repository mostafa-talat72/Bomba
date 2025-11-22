# Performance Monitoring System

## Overview

The performance monitoring system tracks API response times, database query execution times, response sizes, and compression status to help identify performance bottlenecks and optimize the application.

## Features

### 1. Automatic Performance Tracking
- **API Response Times**: Tracks duration of all API requests
- **Database Query Times**: Monitors query execution times
- **Response Sizes**: Measures response payload sizes
- **Compression Status**: Tracks which responses are compressed

### 2. Performance Metrics Collection
- Stores last 1000 API calls and queries
- Tracks slow requests (> 1000ms)
- Tracks large responses (> 100KB)
- Automatic cleanup to prevent memory issues

### 3. Performance Dashboard
- Real-time performance statistics
- Health status calculation
- Performance recommendations
- Trend analysis

## API Endpoints

All endpoints require authentication and admin role.

### Get Performance Statistics
```
GET /api/performance/stats?timeRange=3600000
```

Returns aggregated performance statistics for the specified time range (default: last hour).

**Response:**
```json
{
  "success": true,
  "data": {
    "timeRange": "3600s",
    "totalApiCalls": 150,
    "totalQueries": 75,
    "apiPerformance": {
      "average": 245,
      "median": 180,
      "min": 45,
      "max": 1200,
      "p95": 850,
      "p99": 1100
    },
    "queryPerformance": {
      "average": 120,
      "median": 95,
      "min": 20,
      "max": 450,
      "p95": 320,
      "p99": 400
    },
    "endpointStats": {
      "/api/orders": {
        "count": 50,
        "averageDuration": 200
      }
    },
    "compressionStats": {
      "totalRequests": 150,
      "compressedRequests": 120,
      "compressionRate": 80
    }
  }
}
```

### Get Recent Metrics
```
GET /api/performance/metrics?limit=100
```

Returns the most recent performance metrics.

### Get Performance Dashboard
```
GET /api/performance/dashboard?timeRange=3600000
```

Returns comprehensive dashboard data including statistics, insights, and recommendations.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": { ... },
    "insights": {
      "healthStatus": {
        "status": "excellent",
        "score": 95,
        "avgApiTime": 245,
        "avgQueryTime": 120,
        "compressionRate": 80
      },
      "recommendations": [
        {
          "type": "success",
          "category": "Overall",
          "message": "الأداء ممتاز!",
          "suggestion": "استمر في مراقبة الأداء بانتظام"
        }
      ],
      "trends": {
        "trend": "stable",
        "message": "الأداء مستقر",
        "change": "2.5"
      }
    },
    "recentSlowRequests": [],
    "recentLargeResponses": []
  }
}
```

### Clear Metrics
```
DELETE /api/performance/metrics
```

Clears all stored performance metrics.

## Logging

### Performance Logs

The system automatically logs performance metrics to the console:

**API Performance Log:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "API Performance",
  "type": "performance",
  "method": "GET",
  "url": "/api/orders",
  "statusCode": 200,
  "duration": "245ms",
  "responseSize": "45.23 KB",
  "compressed": "yes",
  "compressionRatio": "65.2%"
}
```

**Query Performance Log:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Database Query Performance",
  "type": "performance",
  "endpoint": "/api/orders",
  "executionTime": "120ms",
  "recordCount": 50,
  "filters": { "status": "pending" },
  "page": 1,
  "limit": 50
}
```

### Warning Logs

The system automatically warns about performance issues:

**Slow Request Warning:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "WARN",
  "message": "Slow API response detected",
  "method": "GET",
  "url": "/api/orders",
  "duration": "1250ms",
  "statusCode": 200
}
```

**Large Uncompressed Response Warning:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "WARN",
  "message": "Large uncompressed response detected",
  "method": "GET",
  "url": "/api/bills",
  "responseSize": "250.45 KB"
}
```

## Performance Thresholds

### Response Time Thresholds
- **Excellent**: < 500ms
- **Good**: 500ms - 1000ms
- **Warning**: > 1000ms

### Query Time Thresholds
- **Excellent**: < 200ms
- **Good**: 200ms - 500ms
- **Warning**: > 500ms

### Response Size Thresholds
- **Normal**: < 100KB
- **Large**: > 100KB (should be compressed)

### Compression Rate Thresholds
- **Excellent**: > 70%
- **Good**: 50% - 70%
- **Poor**: < 50%

## Health Status Calculation

The system calculates an overall health score (0-100) based on:
- Average API response time (weight: 50%)
- Average query execution time (weight: 35%)
- Compression rate (weight: 15%)

**Health Status Levels:**
- **Excellent**: Score >= 80
- **Good**: Score 60-79
- **Fair**: Score 40-59
- **Poor**: Score < 40

## Recommendations

The system automatically generates recommendations based on performance metrics:

1. **Slow API Responses**: Suggests reviewing slow queries and adding database indexes
2. **Slow Queries**: Recommends checking indexes and using `.lean()` for read-only queries
3. **Low Compression Rate**: Suggests enabling gzip compression
4. **Many Slow Requests**: Recommends reviewing and optimizing slow endpoints
5. **Large Responses**: Suggests using pagination and field projection

## Best Practices

1. **Monitor Regularly**: Check the performance dashboard daily
2. **Set Alerts**: Configure alerts for slow requests and queries
3. **Optimize Queries**: Use indexes and field projection
4. **Enable Compression**: Ensure gzip compression is enabled
5. **Use Pagination**: Limit response sizes with pagination
6. **Cache When Possible**: Implement caching for frequently accessed data

## Integration with Existing Code

The performance monitoring system is automatically integrated with:
- All API endpoints (via `performanceMonitor` middleware)
- Order controller (`getOrders` function)
- Billing controller (`getBills` function)

To add monitoring to additional endpoints, simply import and use the performance metrics:

```javascript
import performanceMetrics from "../utils/performanceMetrics.js";

const queryStartTime = Date.now();
// ... your query code ...
const queryExecutionTime = Date.now() - queryStartTime;

performanceMetrics.recordQuery({
    endpoint: '/api/your-endpoint',
    executionTime: queryExecutionTime,
    recordCount: results.length,
});
```

## Troubleshooting

### High Memory Usage
If memory usage is high, the system automatically limits stored metrics to:
- 1000 API calls
- 1000 queries
- 100 slow requests
- 100 large responses

### Missing Metrics
Ensure the `performanceMonitor` middleware is loaded before route handlers in `server.js`.

### Inaccurate Compression Stats
Verify that the `compression` middleware is properly configured in `server.js`.
