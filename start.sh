#!/bin/bash

# Retirement Planner Web App - Startup Script

echo "🚀 Starting Retirement Planner Web App..."
echo ""
echo "The app will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Flask is installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Flask not found. Installing dependencies..."
    pip install -r requirements.txt --break-system-packages
fi

# Start the Flask app
python3 app.py
