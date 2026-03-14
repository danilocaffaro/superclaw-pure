#!/bin/bash
# SuperClaw Pure Health Check
# Returns: exit 0 = healthy, exit 1 = unhealthy

ENDPOINT="http://localhost:4070/api/health"
TIMEOUT=5

response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$ENDPOINT" 2>/dev/null)

if [ "$response" = "200" ]; then
    # Also check Telegram webhook is reachable
    webhook_response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://localhost:4070/api/channels" 2>/dev/null)
    if [ "$webhook_response" = "200" ]; then
        echo "✅ SuperClaw Pure: healthy (HTTP 200, channels API OK)"
        exit 0
    else
        echo "⚠️ SuperClaw Pure: server up but channels API returned $webhook_response"
        exit 1
    fi
else
    echo "🔴 SuperClaw Pure: DOWN (HTTP $response)"
    exit 1
fi
