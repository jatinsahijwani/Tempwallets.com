# Production Issues Diagnosis & Fix
**Date**: January 13, 2026  
**Status**: 🔴 CRITICAL - Multiple Production Issues

---

## 🚨 Issues Identified

### 1. **Zerion Balance Loading Failure**
**Symptom**: Balances not loading from Zerion API  
**Root Cause**: Missing or invalid `ZERION_API_KEY` environment variable

**Evidence**:
```typescript
// apps/backend/src/wallet/zerion.service.ts:191
this.apiKey = this.configService.get<string>('ZERION_API_KEY') || '';

if (!this.apiKey) {
  this.logger.warn(
    'ZERION_API_KEY not found in environment variables. Zerion API calls will fail.',
  );
}
```

**Impact**: 
- No token balances displayed to users
- Cannot fetch transaction history
- Users see empty wallet screens

---

### 2. **Send Functionality Not Working**
**Symptom**: Users cannot send crypto transactions  
**Root Cause**: Multiple potential issues:
  - Gas estimation errors in native EOA sends
  - Missing EIP-7702 configuration in production
  - Zerion API failure blocking decimal lookups

**Evidence**:
```typescript
// apps/backend/src/wallet/wallet.service.ts:2070
// Falling back to Zerion API for token decimals
const tokenInfo = await this.getZerionTokenInfo(
  tokenAddress,
  chain,
  walletAddress,
);
// If Zerion fails, send will fail
```

**Impact**:
- Users cannot transfer funds
- Critical core functionality broken
- High severity user-facing issue

---

### 3. **Lightning Node / Yellow Network Connection Failure**
**Symptom**: Cannot connect to Yellow Network Clearnode  
**Root Cause**: Missing `YELLOW_NETWORK_WS_URL` environment variable

**Evidence**:
```typescript
// apps/backend/src/lightning-node/lightning-node.service.ts:78-82
this.wsUrl = this.configService.get<string>('YELLOW_NETWORK_WS_URL') || '';
if (!this.wsUrl) {
  this.logger.warn(
    'YELLOW_NETWORK_WS_URL not configured. Lightning Node operations will fail.',
  );
}
```

**Impact**:
- Lightning Node features completely broken
- Cannot create/fund/withdraw from channels
- Gasless transaction feature unavailable

---

## 🔍 Root Cause Analysis

All three issues stem from **missing environment variables in production (Railway)**:

1. ❌ `ZERION_API_KEY` - Not set or invalid
2. ❌ `YELLOW_NETWORK_WS_URL` - Not configured
3. ⚠️  `ENABLE_EIP7702` - Not enabled (optional but recommended)
4. ⚠️  `EIP7702_CHAINS` - Not configured
5. ⚠️  `EIP7702_DELEGATION_ADDRESS` - Not set

---

## ✅ Solution: Environment Variable Configuration

### **Required Railway Environment Variables**

Add these to your Railway project settings:

```bash
# ========================================
# Critical - Zerion API (Balance & Transactions)
# ========================================
ZERION_API_KEY=your_zerion_api_key_here

# Get your key from: https://developers.zerion.io
# Without this, NO balances will load


# ========================================
# Critical - Yellow Network (Lightning Node)
# ========================================
YELLOW_NETWORK_WS_URL=wss://clearnode.yellow.org

# Yellow Network Testnet Clearnode WebSocket endpoint
# Without this, Lightning Node features will NOT work


# ========================================
# Recommended - EIP-7702 Gasless Transactions
# ========================================
ENABLE_EIP7702=true
EIP7702_CHAINS=ethereum,sepolia,base,arbitrum,optimism,polygon,avalanche
EIP7702_DELEGATION_ADDRESS=0xe6Cae83BdE06E4c305530e199D7217f42808555B

# Enables gasless transactions for better UX
# Users can send without worrying about gas reserves


# ========================================
# Existing Required Variables (verify these are set)
# ========================================
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
WALLET_ENC_KEY=your_32_byte_hex_key
PIMLICO_API_KEY=your_pimlico_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=https://tempwallets.com
```

---

## 🛠️ How to Add Environment Variables in Railway

### **Method 1: Railway Dashboard (Recommended)**
1. Go to https://railway.app
2. Select your project → `Tempwallets.com`
3. Click on your backend service
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add each variable one by one:
   - Variable Name: `ZERION_API_KEY`
   - Value: `your_actual_api_key`
7. Click **Deploy** to restart with new variables

### **Method 2: Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Set variables
railway variables set ZERION_API_KEY=your_key
railway variables set YELLOW_NETWORK_WS_URL=wss://clearnode.yellow.org
railway variables set ENABLE_EIP7702=true
railway variables set EIP7702_CHAINS=ethereum,sepolia,base,arbitrum,optimism
railway variables set EIP7702_DELEGATION_ADDRESS=0xe6Cae83BdE06E4c305530e199D7217f42808555B

# Redeploy
railway up
```

---

## 🔑 Getting Required API Keys

### **1. Zerion API Key**
```bash
# Visit: https://developers.zerion.io
# Sign up for free developer account
# Navigate to API Keys section
# Create new API key
# Copy key to Railway environment variables
```

**Note**: Zerion has a generous free tier suitable for development/testing.

### **2. Yellow Network WebSocket**
```bash
# Testnet Clearnode (Free, no auth required):
YELLOW_NETWORK_WS_URL=wss://clearnode.yellow.org

# Mainnet (requires Yellow Network account):
# Contact: https://yellow.org
```

---

## 🧪 Testing After Fix

### **1. Test Zerion Balance Loading**
```bash
# Test endpoint
curl -X GET "https://your-backend.railway.app/wallet/assets-any?userId=test-user" \
  -H "Content-Type: application/json"

# Expected: Array of token balances with symbols, amounts, chains
# Should NOT be empty array
```

### **2. Test Send Functionality**
```bash
# Test native send (0.001 ETH on Base)
curl -X POST "https://your-backend.railway.app/wallet/send" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "chain": "base",
    "recipientAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "amount": "0.001"
  }'

# Expected: { "txHash": "0x..." }
```

### **3. Test Lightning Node Connection**
```bash
# Test channel creation
curl -X POST "https://your-backend.railway.app/lightning-node/create" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "chain": "base",
    "asset": "usdc"
  }'

# Expected: { "lightningNode": { "id": ..., "appSessionId": "0x..." } }
```

---

## 📊 Verification Checklist

After adding environment variables and redeploying:

- [ ] **Zerion Balance Loading**
  - [ ] Check Railway logs for "ZERION_API_KEY not found" warnings
  - [ ] Test `/wallet/assets-any` endpoint
  - [ ] Verify balances appear in frontend
  
- [ ] **Send Functionality**
  - [ ] Test native send (ETH on Base)
  - [ ] Test token send (USDC on Base)
  - [ ] Verify transaction hash returned
  - [ ] Check transaction on block explorer
  
- [ ] **Lightning Node**
  - [ ] Check Railway logs for "YELLOW_NETWORK_WS_URL not configured" warnings
  - [ ] Test `/lightning-node/create` endpoint
  - [ ] Verify channel creation succeeds
  - [ ] Test `/lightning-node/fund-channel` endpoint

---

## 🚀 Deployment Commands

```bash
# 1. Add environment variables in Railway Dashboard
# 2. Trigger manual redeploy
git commit --allow-empty -m "chore: Trigger rebuild with new env vars"
git push origin yellow

# Or use Railway CLI
railway up
```

---

## 📝 Code Changes Needed (Optional Improvements)

### **1. Add Better Error Messages for Missing Env Vars**

```typescript
// apps/backend/src/wallet/zerion.service.ts
constructor(private configService: ConfigService) {
  this.apiKey = this.configService.get<string>('ZERION_API_KEY') || '';

  if (!this.apiKey) {
    throw new Error(
      '❌ CRITICAL: ZERION_API_KEY environment variable is missing! ' +
      'Get your API key from https://developers.zerion.io and add it to Railway environment variables. ' +
      'Without this, balance loading will FAIL.'
    );
  }
}
```

### **2. Add Health Check Endpoint**

```typescript
// apps/backend/src/app.controller.ts
@Get('health')
getHealth() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      zerionConfigured: !!process.env.ZERION_API_KEY,
      yellowNetworkConfigured: !!process.env.YELLOW_NETWORK_WS_URL,
      eip7702Enabled: process.env.ENABLE_EIP7702 === 'true',
      database: !!process.env.DATABASE_URL,
      pimlico: !!process.env.PIMLICO_API_KEY,
    }
  };
}
```

---

## 🎯 Priority Action Items

### **URGENT (Do Now)**
1. ✅ Add `ZERION_API_KEY` to Railway
2. ✅ Add `YELLOW_NETWORK_WS_URL` to Railway
3. ✅ Redeploy backend service
4. ✅ Test all three functionalities

### **HIGH (Do Today)**
1. Add EIP-7702 environment variables
2. Implement health check endpoint
3. Add better error messages for missing env vars
4. Test gasless transactions

### **MEDIUM (Do This Week)**
1. Add monitoring for API failures
2. Implement retry logic for Zerion API
3. Add rate limiting protection
4. Document all environment variables in README

---

## 📚 Related Documentation

- [Zerion API Docs](https://developers.zerion.io)
- [Yellow Network Docs](https://docs.yellow.org)
- [EIP-7702 Implementation](/Docs/EIP7702_INTEGRATION_PLAN.md)
- [Production Fix Guide](PRODUCTION_FIX_QUICK_GUIDE.md)

---

## ❓ Troubleshooting

### **Issue: "Still not working after adding env vars"**
```bash
# 1. Verify variables are set in Railway
railway variables

# 2. Check Railway deployment logs
railway logs

# 3. Look for startup errors related to API keys
grep -i "zerion\|yellow" railway_logs.txt
```

### **Issue: "Zerion API returns 401 Unauthorized"**
```bash
# Your API key is invalid or expired
# 1. Generate new key at https://developers.zerion.io
# 2. Update Railway environment variable
# 3. Redeploy
```

### **Issue: "Cannot connect to Yellow Network"**
```bash
# Check WebSocket URL is correct
echo $YELLOW_NETWORK_WS_URL
# Should be: wss://clearnode.yellow.org

# Test connection manually
wscat -c wss://clearnode.yellow.org
```

---

## 🔗 Quick Links

- **Railway Dashboard**: https://railway.app/project/your-project-id
- **Zerion API Console**: https://developers.zerion.io
- **Yellow Network**: https://yellow.org
- **Production Frontend**: https://tempwallets.com

---

**Last Updated**: January 13, 2026  
**Next Review**: After environment variables are added and tested
