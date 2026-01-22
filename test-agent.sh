#!/bin/bash

# Quick test script for agent endpoint
# Usage: ./test-agent.sh

echo "🔍 Testing Agent Endpoint..."
echo ""

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
    curl -s http://localhost:3000/health | jq .
else
    echo "❌ Backend is NOT running!"
    echo "   Start it with: cd backend && npm run dev"
    exit 1
fi

echo ""
echo "2️⃣ Testing /api/agent/chat endpoint..."
echo ""

response=$(curl -s -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test message"}')

echo "Response:"
echo "$response" | jq . 2>/dev/null || echo "$response"

echo ""
echo "3️⃣ Checking for common issues..."
echo ""

# Check if API key is set (in backend directory)
if [ -f "backend/.env" ]; then
    if grep -q "OPENAI_API_KEY" backend/.env; then
        echo "✅ OPENAI_API_KEY found in .env"
        key_preview=$(grep "OPENAI_API_KEY" backend/.env | cut -d'=' -f2 | cut -c1-7)
        echo "   Key preview: $key_preview..."
    else
        echo "❌ OPENAI_API_KEY NOT found in backend/.env"
        echo "   Add it: echo 'OPENAI_API_KEY=sk-your-key' >> backend/.env"
    fi
else
    echo "❌ backend/.env file not found"
    echo "   Create it with: echo 'OPENAI_API_KEY=sk-your-key' > backend/.env"
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Check backend terminal for detailed logs"
echo "   2. Check browser console (F12) for frontend errors"
echo "   3. Check Network tab for request/response details"

