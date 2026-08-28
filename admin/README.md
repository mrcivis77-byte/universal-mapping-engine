# Bidding System Dashboard

This is a no-code admin interface for managing your universal-mapping-engine bidding system in **the_beach** sandbox! 🌊

## How to Use

### 1. Open the Dashboard
Simply open `admin/bidding-dashboard.html` in any web browser. No server needed - it's a static HTML file.

### 2. Adjust Pricing
Use the **Pricing Calculator** to see how prices are calculated:
- **Distance (km)**: How far you're traveling
- **Time (minutes)**: How long the trip takes
- **Rate per km**: Currently 1 peso/kilometer
- **Rate per min**: Currently 2 pesos/minute

The formula is:
```
Total = (Distance × 1) + (Time × 2) + 30 (maintenance) + 10 (license)
```

### 3. Configure Each App
Click the toggle switches to enable/disable features:

**For each app (Moto Taxi, Drive, etc.):**
- ✅ **Enable Bidding**: Allow drivers to submit bids
- 📍 **Requires Destination**: User must enter destination (MOTO/TAXI/DRIVE apps)
- 🚌 **Fixed Route**: No destination needed (BUS apps)
- 💰 **Min Bid Amount**: Minimum price drivers can offer

### 4. Save Changes
Click "Save All Changes" to apply new configurations. Changes will be reflected when the app restarts.

## What You Can Manage

| Feature | What It Does |
|---------|--------------|
| Destination Required | Prevents ride requests without destination |
| Driver Bidding | Allows drivers to offer price quotes |
| Pricing Formula | Fair calculation: distance + time + fees |
| App Names | Customize how apps appear to users |

## Bidding Flow (No-Code Documentation)

```
1. CUSTOMER
   ↓ (Clicks "Client" role)
2. REQUEST RIDES
   ✓ Needs destination for Moto/Drive
   ↓
3. DRIVER
   ↓ (Clicks "Driver" role → goes ON DUTY)
4. SEES REQUESTS
   ✓ Requests appear with destination
   ↓
5. SUBMITS BID
   ✓ Price auto-calculated
   ↓
6. CUSTOMER SELECTS
   ✓ Chooses best bid
   ↓
7. DRIVER COMPLETES
   ✓ Marks ride complete
```

## Need Help?

- Check the `PROJECT_SUMMARY.md` file
- Look at `QUICKSTART.md` for getting started
- Or contact support for technical assistance