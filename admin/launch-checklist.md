# 🚀 Launch Checklist

Check off each item as you verify it works!

## ✅ Pre-Launch Verification

### Destination Requirement
- [ ] Moto Taxi app shows "Destino (obligatorio)"
- [ ] Drive app shows "Destino (obligatorio)"  
- [ ] Express Delivery shows "Destino (obligatorio)"
- [ ] Bus app shows "Destino (opcional)"
- [ ] Can't request ride without destination (for non-bus apps)

### Bidding System
- [ ] Driver sees ride requests on map
- [ ] Driver can "Submit Bid" or "Skip"
- [ ] Bid price auto-calculated with formula: (distance × 1) + (time × 2) + 30 + 10
- [ ] Customer sees list of bids with driver info
- [ ] Customer can select a bid

### Pricing Calculator
- [ ] 5km, 10min = 60 pesos (5 + 20 + 30 + 10)
- [ ] 10km, 15min = 95 pesos (10 + 30 + 30 + 10)
- [ ] 3km, 5min = 50 pesos (3 + 10 + 30 + 10)

### Driver Flow
- [ ] Driver can go "ON DUTY"
- [ ] Driver sees incoming ride requests
- [ ] Driver receives bid notification
- [ ] Driver can accept/reject bids
- [ ] Driver marks ride as "Completed"

### Admin Dashboard
- [ ] Can adjust pricing rates
- [ ] Can enable/disable bidding per app
- [ ] Can set destination requirement per app

## 🔧 Technical Checks

### Database (PocketBase)
- [ ] `bids` collection exists
- [ ] `rides_requests.bidding_status` field exists
- [ ] `drivers.avatar` field exists
- [ ] All app configs have APP_NAME set

### API Endpoints
- [ ] `/api/bids` - Create/retrieve bids
- [ ] `/api/requests` - Ride requests with destination validation
- [ ] `/api/drivers` - Driver status updates

### Localization
- [ ] English locale has all bidding strings
- [ ] Spanish locale has all bidding strings
- [ ] App names display correctly in each language

## 📱 App Testing

### Moto Taxi App
- [ ] Request ride with destination works
- [ ] Driver can see request
- [ ] Driver submits bid
- [ ] Customer accepts bid
- [ ] Driver completes ride

### Community Bus App
- [ ] Request ride WITHOUT destination works
- [ ] No bidding required

### Personal Driver App
- [ ] Request ride with destination works
- [ ] Driver bidding flow works

## ✅ After Launch

Monitor these metrics:
- Average bid acceptance time
- Ride completion rate
- Average distance/time
- Driver availability

---

## Need Help?

Open `PROJECT_SUMMARY.md` for detailed documentation
Check `QUICKSTART.md` for getting started
Run `./scripts/verify-bidding.js` to check configuration