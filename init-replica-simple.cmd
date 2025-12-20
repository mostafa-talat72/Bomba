@echo off
echo ========================================
echo Initializing MongoDB Replica Set
echo ========================================
echo.

echo Connecting to MongoDB and initializing replica set...
echo.

"C:\Program Files\MongoDB\Server\8.2\bin\mongosh.exe" --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"

echo.
echo ========================================
echo Done! Check the output above.
echo If you see "ok": 1, it worked!
echo ========================================
echo.
pause
