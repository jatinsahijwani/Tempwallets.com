# Substrate WalletConnect Architecture

## Overview

This document describes the complete architecture and file flow for Substrate wallet connections via WalletConnect/Reown protocol. The system enables Polkadot ecosystem dapps (Hydration, Unique Network, Bifrost, etc.) to connect to user wallets and request transaction signatures.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────────────┐ │
│  │  WalletConnectModal   │──────│  useSubstrateWalletConnect  │ │
│  │  (UI Component)       │      │  (React Hook)              │ │
│  └──────────────────────┘      └──────────────────────────────┘ │
│           │                              │                        │
│           │                              │                        │
│           │  User Actions:               │                        │
│           │  - Paste URI                 │                        │
│           │  - Scan QR Code              │                        │
│           │  - Approve/Reject Session    │                        │
│           │                              │                        │
│           └──────────┬───────────────────┘                        │
│                      │                                            │
│                      │ WalletConnect SDK                           │
│                      │ (@walletconnect/sign-client)               │
│                      │                                            │
└──────────────────────┼────────────────────────────────────────────┘
                       │
                       │ HTTP API Calls
                       │
┌──────────────────────┼────────────────────────────────────────────┐
│                      │         Backend Layer                       │
├──────────────────────┼────────────────────────────────────────────┤
│                      │                                            │
│  ┌───────────────────▼────────────────────────────────────────┐  │
│  │  SubstrateWalletConnectController                          │  │
│  │  /wallet/substrate/walletconnect/*                         │  │
│  └───────────────────┬────────────────────────────────────────┘  │
│                      │                                            │
│  ┌───────────────────▼────────────────────────────────────────┐  │
│  │  SubstrateWalletConnectService                              │  │
│  │  - formatAccountId()                                        │  │
│  │  - parseAccountId()                                          │  │
│  │  - signTransaction()                                        │  │
│  │  - signMessage()                                            │  │
│  │  - getFormattedAccounts()                                   │  │
│  └───────────────────┬────────────────────────────────────────┘  │
│                      │                                            │
│         ┌────────────┴────────────┐                              │
│         │                         │                              │
│  ┌──────▼──────┐        ┌─────────▼──────────┐                  │
│  │ Substrate   │        │ Substrate          │                  │
│  │ Manager     │        │ Transaction        │                  │
│  │             │        │ Service            │                  │
│  └──────┬──────┘        └─────────┬──────────┘                  │
│         │                         │                              │
│         └────────────┬────────────┘                              │
│                      │                                            │
│  ┌───────────────────▼────────────────────────────────────────┐  │
│  │  SubstrateAccountFactory                                  │  │
│  │  - Creates SR25519 keypairs from seed phrase              │  │
│  └───────────────────┬────────────────────────────────────────┘  │
│                      │                                            │
│  ┌───────────────────▼────────────────────────────────────────┐  │
│  │  SeedManager                                                │  │
│  │  - Retrieves user's seed phrase                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## File Flow

### Frontend Files

#### 1. `apps/web/components/dashboard/walletconnect-modal.tsx`
**Purpose**: UI component for WalletConnect connection interface

**Key Responsibilities**:
- Renders modal dialog for connecting to Polkadot dapps
- Provides URI input field and QR code scanner
- Displays active sessions and allows disconnection
- Handles user interactions (paste, scan, connect, disconnect)

**Key Features**:
- QR code scanning using `html5-qrcode`
- Clipboard paste functionality
- Session management UI
- Error handling and user feedback

**Dependencies**:
- `useSubstrateWalletConnect` hook
- `useBrowserFingerprint` hook
- `@walletconnect/sign-client` (via hook)

---

#### 2. `apps/web/hooks/useSubstrateWalletConnect.ts`
**Purpose**: React hook that manages WalletConnect client lifecycle and session handling

**Key Responsibilities**:
- Initializes WalletConnect SignClient (lazy initialization)
- Manages session proposals and approvals
- Handles transaction/message signing requests
- Maintains session state
- Formats accounts for WalletConnect (CAIP-10)

**Key Functions**:
- `initialize()`: Lazy initialization of SignClient
- `pair(uri)`: Pairs with dapp using WalletConnect URI
- `disconnect(topic)`: Disconnects a session
- `approveSession()`: Approves a session proposal
- `rejectSession()`: Rejects a session proposal

**Event Handlers**:
- `session_proposal`: Handles incoming connection requests
- `session_request`: Handles transaction/message signing requests
- `session_delete`: Handles session disconnections

**Account Formatting**:
- Uses CAIP-10 format: `polkadot:<genesis_hash>:<ss58_address>`
- Fetches accounts from backend API
- Filters accounts based on requested chains

**Backend API Calls**:
- `walletApi.getSubstrateWalletConnectAccounts()`: Get formatted accounts
- `walletApi.signSubstrateWalletConnectTransaction()`: Sign transactions
- `walletApi.signSubstrateWalletConnectMessage()`: Sign messages

---

#### 3. `apps/web/lib/api.ts`
**Purpose**: API client for backend communication

**Substrate WalletConnect Methods**:

```typescript
// Get CAIP-10 formatted accounts
getSubstrateWalletConnectAccounts(userId, useTestnet)

// Sign transaction
signSubstrateWalletConnectTransaction({
  userId,
  accountId,        // CAIP-10 format
  transactionPayload, // Hex-encoded
  useTestnet
})

// Sign message
signSubstrateWalletConnectMessage({
  userId,
  accountId,        // CAIP-10 format
  message,          // String or hex
  useTestnet
})
```

**Endpoints**:
- `GET /wallet/substrate/walletconnect/accounts`
- `POST /wallet/substrate/walletconnect/sign-transaction`
- `POST /wallet/substrate/walletconnect/sign-message`

---

### Backend Files

#### 4. `apps/backend/src/wallet/substrate/substrate-walletconnect.controller.ts`
**Purpose**: NestJS controller for Substrate WalletConnect endpoints

**Endpoints**:

1. **GET `/wallet/substrate/walletconnect/accounts`**
   - Query params: `userId`, `useTestnet`
   - Returns: Formatted accounts in CAIP-10 format
   - Calls: `SubstrateWalletConnectService.getFormattedAccounts()`

2. **POST `/wallet/substrate/walletconnect/sign-transaction`**
   - Body: `SubstrateWalletConnectSignTransactionDto`
   - Returns: `{ signature: string }`
   - Calls: `SubstrateWalletConnectService.signTransaction()`

3. **POST `/wallet/substrate/walletconnect/sign-message`**
   - Body: `SubstrateWalletConnectSignMessageDto`
   - Returns: `{ signature: string }`
   - Calls: `SubstrateWalletConnectService.signMessage()`

---

#### 5. `apps/backend/src/wallet/substrate/services/substrate-walletconnect.service.ts`
**Purpose**: Core service for Substrate WalletConnect operations

**Key Methods**:

1. **`formatAccountId(chain, address, useTestnet)`**
   - Formats Substrate address to CAIP-10 account ID
   - Format: `polkadot:<genesis_hash>:<ss58_address>`
   - Uses chain config to get genesis hash

2. **`parseAccountId(accountId)`**
   - Parses CAIP-10 account ID back to chain and address
   - Validates format and finds matching chain by genesis hash
   - Returns: `{ chain, address, genesisHash }`

3. **`signTransaction(userId, accountId, transactionPayload, useTestnet)`**
   - Parses accountId to get chain and address
   - Verifies address belongs to user
   - Decodes hex transaction payload
   - Signs transaction using `SubstrateTransactionService`
   - Returns signature in hex format

4. **`signMessage(userId, accountId, message, useTestnet)`**
   - Parses accountId to get chain and address
   - Verifies address belongs to user
   - Creates SR25519 keypair from seed phrase
   - Signs message with SR25519
   - Returns signature in hex format

5. **`getFormattedAccounts(userId, useTestnet)`**
   - Gets all Substrate addresses for user
   - Formats each as CAIP-10 account ID
   - Returns array of `{ accountId, chain, address }`

**Dependencies**:
- `SubstrateManager`: Address retrieval
- `SubstrateTransactionService`: Transaction signing
- `SubstrateAccountFactory`: Account creation
- `SeedManager`: Seed phrase access
- `substrate-chain.config.ts`: Chain configurations

---

#### 6. `apps/backend/src/wallet/substrate/dto/substrate-walletconnect.dto.ts`
**Purpose**: Data Transfer Objects for request validation

**DTOs**:

1. **`SubstrateWalletConnectSignTransactionDto`**
   ```typescript
   {
     userId: string;
     accountId: string;           // CAIP-10 format
     transactionPayload: string;  // Hex-encoded
     useTestnet?: boolean;
   }
   ```

2. **`SubstrateWalletConnectSignMessageDto`**
   ```typescript
   {
     userId: string;
     accountId: string;    // CAIP-10 format
     message: string;     // String or hex
     useTestnet?: boolean;
   }
   ```

---

#### 7. `apps/backend/src/wallet/substrate/config/substrate-chain.config.ts`
**Purpose**: Chain configuration with genesis hashes and RPC endpoints

**Key Data**:
- Chain configurations (Polkadot, Hydration, Bifrost, Unique, Paseo)
- Genesis hashes (used in CAIP-10 account IDs)
- RPC endpoints
- SS58 prefixes
- Token symbols and decimals
- WalletConnect IDs

**Supported Chains**:
- `polkadot`: Polkadot Relay Chain
- `hydration`: Hydration (HydraDX) Parachain
- `bifrost`: Bifrost Parachain
- `unique`: Unique Network Parachain
- `paseo`: Paseo Testnet
- `paseoAssethub`: Paseo AssetHub

---

#### 8. `apps/backend/src/wallet/substrate/managers/substrate.manager.ts`
**Purpose**: Manages Substrate chain operations and address retrieval

**Key Methods** (used by WalletConnect service):
- `getAddressForChain(userId, chain, useTestnet)`: Get address for specific chain
- `getAddresses(userId, useTestnet)`: Get all addresses
- `getEnabledChains()`: Get list of enabled chains

---

#### 9. `apps/backend/src/wallet/substrate/services/substrate-transaction.service.ts`
**Purpose**: Handles Substrate transaction signing

**Key Methods**:
- `signTransaction(userId, transaction, chain, accountIndex, useTestnet)`: Signs a transaction
- Returns signed transaction with signature

---

#### 10. `apps/backend/src/wallet/substrate/factories/substrate-account.factory.ts`
**Purpose**: Creates Substrate accounts from seed phrases

**Key Methods**:
- `createAccount(seedPhrase, chain, accountIndex)`: Creates SR25519 account
- Uses `@polkadot/keyring` for keypair generation

---

#### 11. `apps/backend/src/wallet/managers/seed.manager.ts`
**Purpose**: Manages seed phrase storage and retrieval

**Key Methods**:
- `getSeed(userId)`: Retrieves user's seed phrase
- `hasSeed(userId)`: Checks if seed exists
- `createOrImportSeed(userId, mode, mnemonic?)`: Creates or imports seed

---

## Connection Flow

### 1. Initialization Flow

```
User Opens Modal
    │
    ▼
WalletConnectModal renders
    │
    ▼
useSubstrateWalletConnect hook called
    │
    ▼
initialize() called (lazy)
    │
    ▼
SignClient.init() with project ID
    │
    ▼
Global client instance created
    │
    ▼
Existing sessions loaded
    │
    ▼
Event listeners registered:
  - session_proposal
  - session_request
  - session_delete
```

### 2. Pairing Flow

```
User Pastes/Scans URI
    │
    ▼
pair(uri) called
    │
    ▼
SignClient.pair({ uri })
    │
    ▼
WalletConnect Relay Server
    │
    ▼
DApp receives pairing request
    │
    ▼
DApp sends session_proposal
    │
    ▼
Frontend receives session_proposal event
    │
    ▼
User approves/rejects (window.confirm)
    │
    ├─ Reject → signClient.reject()
    │
    └─ Approve:
        │
        ▼
        walletApi.getSubstrateWalletConnectAccounts()
        │
        ▼
        Backend: SubstrateWalletConnectService.getFormattedAccounts()
        │
        ▼
        SubstrateManager.getAddresses()
        │
        ▼
        Format as CAIP-10: polkadot:<genesis_hash>:<address>
        │
        ▼
        Build namespaces with accounts, chains, methods, events
        │
        ▼
        signClient.approve({ id, namespaces })
        │
        ▼
        Session established
        │
        ▼
        Session added to sessions state
```

### 3. Transaction Signing Flow

```
DApp requests transaction signature
    │
    ▼
WalletConnect Relay Server
    │
    ▼
Frontend receives session_request event
    │
    ├─ Method: polkadot_signTransaction
    │   │
    │   ▼
    │   User confirms (window.confirm)
    │   │
    │   ▼
    │   walletApi.signSubstrateWalletConnectTransaction({
    │     userId,
    │     accountId,        // CAIP-10
    │     transactionPayload, // Hex
    │     useTestnet
    │   })
    │   │
    │   ▼
    │   Backend: SubstrateWalletConnectService.signTransaction()
    │   │
    │   ▼
    │   Parse accountId → { chain, address }
    │   │
    │   ▼
    │   Verify address belongs to user
    │   │
    │   ▼
    │   Get API connection for chain
    │   │
    │   ▼
    │   Decode transaction payload
    │   │
    │   ▼
    │   SubstrateTransactionService.signTransaction()
    │   │
    │   ▼
    │   Extract signature from signed transaction
    │   │
    │   ▼
    │   Return { signature: string }
    │   │
    │   ▼
    │   Frontend: signClient.respond({ topic, response })
    │   │
    │   ▼
    │   DApp receives signature
    │
    └─ Method: polkadot_signMessage
        │
        ▼
        User confirms (window.confirm)
        │
        ▼
        walletApi.signSubstrateWalletConnectMessage({
          userId,
          accountId,    // CAIP-10
          message,      // String
          useTestnet
        })
        │
        ▼
        Backend: SubstrateWalletConnectService.signMessage()
        │
        ▼
        Parse accountId → { chain, address }
        │
        ▼
        Verify address belongs to user
        │
        ▼
        Get seed phrase
        │
        ▼
        Create SR25519 keypair
        │
        ▼
        Sign message with SR25519
        │
        ▼
        Return { signature: string }
        │
        ▼
        Frontend: signClient.respond({ topic, response })
        │
        ▼
        DApp receives signature
```

### 4. Disconnection Flow

```
User clicks disconnect
    │
    ▼
disconnect(topic) called
    │
    ▼
signClient.disconnect({ topic, reason })
    │
    ▼
WalletConnect Relay Server
    │
    ▼
DApp receives disconnect event
    │
    ▼
Frontend receives session_delete event
    │
    ▼
Session removed from sessions state
```

## CAIP-10 Account ID Format

The system uses CAIP-10 (Chain Agnostic Improvement Proposal 10) format for account identification:

**Format**: `polkadot:<genesis_hash>:<ss58_address>`

**Example**:
```
polkadot:91b171bb158e2d3848fa23a9f1c25182:5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
```

**Components**:
- `polkadot`: Namespace (always "polkadot" for Substrate chains)
- `91b171bb158e2d3848fa23a9f1c25182`: Genesis hash (identifies the chain)
- `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`: SS58 address

**Genesis Hashes** (from config):
- Polkadot: `0x91b171bb158e2d3848fa23a9f1c25182`
- Hydration: `0xaf9326e6615b9c21ef01ba1763c475c04057270bf6b6aeb1dd1bd0f3722ab861`
- Bifrost: `0x262e1b2ad728475fd6fe88e62fb47b7f6c73d6e2a6fc3389a95ff8e6e3de7e89`
- Unique: `0x84322d9cddbf35088f1e54e9a85c967a41a56a4f43445768125e61af166c7d31`
- Paseo: `0xd5d32db5e6c12cdc1a94a4b58a19c59aaab54dfcc6d11ad26dc9db8d5c858ad2`

## Security Considerations

1. **Address Verification**: Backend verifies that the address in the accountId belongs to the requesting user
2. **User Confirmation**: All transaction and message signing requires user confirmation via `window.confirm()`
3. **Seed Phrase Security**: Seed phrases are stored encrypted and only accessed when needed
4. **Session Management**: Sessions are tracked and can be disconnected by the user
5. **Namespace Filtering**: Only Polkadot namespace sessions are accepted (EVM chains are excluded)

## Error Handling

### Frontend Errors
- Initialization failures: Displayed in modal
- Pairing failures: Shown as error message
- Signing failures: Sent as error response to dapp

### Backend Errors
- Invalid accountId format: Returns 400 Bad Request
- Address mismatch: Returns 403 Forbidden
- Transaction decode failure: Returns 400 Bad Request
- Signing failures: Returns 500 Internal Server Error

## Supported Methods

The system supports the following WalletConnect methods:

1. **`polkadot_signTransaction`**
   - Signs Substrate transactions
   - Returns signature in hex format
   - Used for transfers, staking, etc.

2. **`polkadot_signMessage`**
   - Signs arbitrary messages
   - Uses SR25519 signature scheme
   - Returns signature in hex format

## Supported Events

1. **`chainChanged`**: Notifies when chain changes
2. **`accountsChanged`**: Notifies when accounts change

## Dependencies

### Frontend
- `@walletconnect/sign-client`: WalletConnect SDK
- `@walletconnect/types`: TypeScript types
- `html5-qrcode`: QR code scanning
- `lucide-react`: Icons

### Backend
- `@polkadot/keyring`: Keypair generation
- `@polkadot/api`: Substrate API connection
- `@nestjs/common`: NestJS framework
- `class-validator`: DTO validation

## Environment Variables

### Frontend
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project ID

### Backend
- No specific environment variables required (uses existing Substrate RPC endpoints)

## Testing Flow

1. **Connect to DApp**:
   - Visit a Polkadot dapp (e.g., https://app.hydration.net)
   - Click "Connect Wallet" → "WalletConnect"
   - Copy the WalletConnect URI

2. **Pair in Modal**:
   - Open WalletConnect modal in Tempwallets
   - Paste URI or scan QR code
   - Approve connection

3. **Test Transaction**:
   - Initiate a transaction in the dapp
   - Confirm in browser dialog
   - Transaction should be signed and submitted

4. **Test Message Signing**:
   - Request message signature in dapp
   - Confirm in browser dialog
   - Message should be signed

## Future Improvements

1. **Better UI**: Replace `window.confirm()` with custom modal dialogs
2. **Transaction Preview**: Show decoded transaction details before signing
3. **Session Persistence**: Better handling of session restoration
4. **Multi-chain Support**: Support for additional Substrate chains
5. **Testnet Detection**: Automatic testnet detection from chainId
6. **Error Recovery**: Better error messages and recovery flows

