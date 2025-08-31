#!/bin/bash
# Development server startup script

echo "🚀 Starting Eatinator FastAPI Development Environment"
echo "======================================================"

# Check if Python dependencies are installed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing Python dependencies..."
    cd api && pip install -r requirements.txt
    cd ..
fi

# Start FastAPI backend in background
echo "🔧 Starting FastAPI backend on port 5694..."
cd api
python3 main.py &
FASTAPI_PID=$!
cd ..

# Give the backend time to start
sleep 3

# Start frontend proxy server
echo "🌐 Starting frontend proxy server on port 8000..."
python3 proxy_server.py &
PROXY_PID=$!

echo ""
echo "✅ Development environment started!"
echo "   Frontend: http://localhost:8000"
echo "   Backend API: http://localhost:5694"
echo "   Health check: http://localhost:5694/health"
echo ""
echo "Press Ctrl+C to stop all services..."

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $FASTAPI_PID 2>/dev/null
    kill $PROXY_PID 2>/dev/null
    echo "👋 Development environment stopped"
    exit 0
}

# Set up signal trap
trap cleanup INT TERM

# Wait for processes
wait