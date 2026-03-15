#!/bin/bash
echo "Starting ITRMM Agent..."
source venv/bin/activate
cd backend
uvicorn main:app --port 8000 &
BACKEND_PID=$!

echo "ITRMM Agent is running on http://localhost:8000"
echo "Press Ctrl+C to stop the server"

trap "kill $BACKEND_PID; exit" INT
wait
