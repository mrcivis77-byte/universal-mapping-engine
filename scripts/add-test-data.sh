#!/bin/bash
# Add test drivers and customers to sandbox

echo "Adding test drivers..."
for i in $(seq 1 10); do
  zone="moto"
  [ $((i % 2)) -eq 0 ] && zone="bus"
  curl -s -X POST http://localhost:8091/api/collections/drivers/records \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Driver $i\",\"phone\":\"+1-555-000$i\",\"vehicle_type\":\"$zone\",\"zone\":\"$zone\"}" \
    -u "sandbox:yucatanmx.com:sandbox123" 2>&1 | head -c 100
done

echo ""
echo "Adding test customers..."
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:8091/api/collections/customers/records \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Customer $i\",\"phone\":\"+1-555-100$i\"}" \
    -u "sandbox:yucatanmx.com:sandbox123" 2>&1 | head -c 100
done

echo ""
echo "Test data added!"
