# EVM WalletConnect Implementation Plan
## Customized for Tempwallets.com Codebase

This document provides a detailed, step-by-step plan for implementing EVM (Ethereum Virtual Machine) WalletConnect support, replicating the existing Substrate WalletConnect architecture with namespace isolation.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Backend Implementation](#backend-implementation)
3. [Frontend Implementation](#frontend-implementation)
4. [Namespace Isolation Strategy](#namespace-isolation-strategy)
5. [Testing Strategy](#testing-strategy)
6. [Migration & Rollout](#migration--rollout)

---

## Architecture Overview

### Current State
- **Substrate Module**: Located at `/apps/backend/src/wallet/substrate/`
  - Service: `substrate-walletconnect.service.ts`
  - Controller: `substrate-walletconnect.controller.ts`
  - DTOs: `substrate-walletconnect.dto.ts`
  - Module: `substrate.module.ts`

- **Frontend Hook**: `/apps/web/hooks/useSubstrateWalletConnect.ts`
- **Frontend Modal**: `/apps/web/components/dashboard/walletconnect-modal.tsx`

### Target State
Create a parallel EVM module structure that mirrors Substrate but handles the `eip155` namespace independently.

---

## Backend Implementation

### Step 1: Create EVM Module Directory Structure

Create the following directory structure:
```
/apps/backend/src/wallet/evm/
├── dto/
│   └── evm-walletconnect.dto.ts
├── services/
│   └── evm-walletconnect.service.ts
├── evm-walletconnect.controller.ts
└── evm.module.ts
```

### Step 2: Create EVM WalletConnect DTOs

**File**: `/apps/backend/src/wallet/evm/dto/evm-walletconnect.dto.ts`

Create DTOs for EVM-specific WalletConnect operations:

```typescript
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for signing an EVM transaction via WalletConnect
 * Supports both EIP-1559 and Legacy transaction formats
 */
export class EvmWalletConnectSignTransactionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format: eip155:<chain_id>:<address>

  @IsObject()
  @ValidateNested()
  @Type(() => EvmTransactionParams)
  transaction: EvmTransactionParams; // Full transaction object

  @IsBoolean()
  @IsOptional()
  useTestnet?: boolean;
}

/**
 * Transaction parameters for EVM transactions
 */
export class EvmTransactionParams {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  value?: string; // Hex string (wei)

  @IsString()
  @IsOptional()
  data?: string; // Hex string (contract call data)

  @IsString()
  @IsOptional()
  gas?: string; // Hex string

  @IsString()
  @IsOptional()
  gasPrice?: string; // Legacy transactions

  @IsString()
  @IsOptional()
  maxFeePerGas?: string; // EIP-1559 transactions

  @IsString()
  @IsOptional()
  maxPriorityFeePerGas?: string; // EIP-1559 transactions

  @IsString()
  @IsOptional()
  nonce?: string; // Hex string
}

/**
 * DTO for signing an EVM message via WalletConnect (personal_sign)
 */
export class EvmWalletConnectSignMessageDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format: eip155:<chain_id>:<address>

  @IsString()
  @IsNotEmpty()
  message: string; // Message to sign (hex-encoded or plain text)

  @IsBoolean()
  @IsOptional()
  useTestnet?: boolean;
}

/**
 * DTO for signing typed data via WalletConnect (eth_signTypedData)
 */
export class EvmWalletConnectSignTypedDataDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  accountId: string; // CAIP-10 format: eip155:<chain_id>:<address>

  @IsObject()
  @ValidateNested()
  @Type(() => EvmTypedData)
  typedData: EvmTypedData; // EIP-712 typed data structure

  @IsBoolean()
  @IsOptional()
  useTestnet?: boolean;
}

/**
 * EIP-712 Typed Data structure
 */
export class EvmTypedData {
  @IsObject()
  types: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  primaryType: string;

  @IsObject()
  domain: Record<string, any>;

  @IsObject()
  message: Record<string, any>;
}
```

### Step 3: Create EVM WalletConnect Service

**File**: `/apps/backend/src/wallet/evm/services/evm-walletconnect.service.ts`

This service will:
- Format EVM addresses to CAIP-10 format (`eip155:<chain_id>:<address>`)
- Parse CAIP-10 account IDs to extract chain ID and address
- Sign EVM transactions (supporting both EIP-1559 and Legacy)
- Sign messages using `personal_sign`
- Sign typed data using EIP-712 (`eth_signTypedData`)
- Get all EVM accounts formatted as CAIP-10

Key implementation details:

1. **CAIP-10 Formatting**: Use chain IDs instead of genesis hashes
   ```typescript
   formatAccountId(chainId: string, address: string): string {
     return `eip155:${chainId}:${address}`;
   }
   ```

2. **Chain ID Mapping**: Map internal chain names to EVM chain IDs
   - Ethereum Mainnet: `1`
   - Base: `8453`
   - Arbitrum: `42161`
   - Polygon: `137`
   - Avalanche: `43114`
   - Testnets: Sepolia `11155111`, Base Sepolia `84532`, etc.

3. **Transaction Signing**: 
   - Use `WalletService.sendCrypto()` or create a new method that signs without broadcasting
   - Support both EIP-1559 and Legacy transaction formats
   - Extract signature from signed transaction

4. **Message Signing**:
   - Use `ethers.js` or similar library to sign messages with `personal_sign` format
   - Message format: `\x19Ethereum Signed Message:\n{length}{message}`

5. **Typed Data Signing**:
   - Use `ethers.js` EIP-712 signing utilities
   - Validate typed data structure

6. **Account Verification**:
   - Verify that the address in the CAIP-10 account ID belongs to the requesting user
   - Use `AddressManager.getAddressForChain()` or similar

**Dependencies to inject**:
- `WalletService` (for transaction signing)
- `AddressManager` (for address retrieval)
- `AccountFactory` (for account creation)
- `SeedManager` (for seed phrase access)
- `ChainConfigService` (for chain configuration and chain ID mapping)
- `Logger` (NestJS logger)

**Required NPM Packages** (verify before implementation):
- `ethers` OR `viem` (for EVM signing, EIP-712, and transaction formatting)
  - Check existing codebase to see which is already in use
  - Both support EIP-712 typed data signing
  - Both support EIP-1559 and Legacy transaction formats

### Step 4: Create EVM WalletConnect Controller

**File**: `/apps/backend/src/wallet/evm/evm-walletconnect.controller.ts`

Create a NestJS controller with the following endpoints:

```typescript
@Controller('wallet/evm/walletconnect')
export class EvmWalletConnectController {
  /**
   * GET /wallet/evm/walletconnect/accounts?userId=xxx&useTestnet=false
   * Returns all EVM accounts formatted as CAIP-10 account IDs
   */
  @Get('accounts')
  async getAccounts(@Query('userId') userId: string, @Query('useTestnet') useTestnet?: string)

  /**
   * POST /wallet/evm/walletconnect/sign-transaction
   * Signs an EVM transaction and returns the signature
   */
  @Post('sign-transaction')
  async signTransaction(@Body() dto: EvmWalletConnectSignTransactionDto)

  /**
   * POST /wallet/evm/walletconnect/sign-message
   * Signs a message using personal_sign
   */
  @Post('sign-message')
  async signMessage(@Body() dto: EvmWalletConnectSignMessageDto)

  /**
   * POST /wallet/evm/walletconnect/sign-typed-data
   * Signs typed data using EIP-712
   */
  @Post('sign-typed-data')
  async signTypedData(@Body() dto: EvmWalletConnectSignTypedDataDto)
}
```

### Step 5: Create EVM Module

**File**: `/apps/backend/src/wallet/evm/evm.module.ts`

Create a NestJS module that:
- Imports required dependencies (`WalletModule` with `forwardRef` to avoid circular dependency)
- Provides `EvmWalletConnectService`
- Controllers: `EvmWalletConnectController`
- Exports `EvmWalletConnectService` for use in other modules

### Step 6: Register EVM Module in Wallet Module

**File**: `/apps/backend/src/wallet/wallet.module.ts`

Add `EvmModule` to the imports array (similar to how `SubstrateModule` is imported).

---

## Frontend Implementation

### Step 7: Create EVM WalletConnect Hook

**File**: `/apps/web/hooks/useEvmWalletConnect.ts`

Create a React hook that mirrors `useSubstrateWalletConnect.ts` but:
- Uses a **separate** global WalletConnect SignClient instance (critical for namespace isolation)
- Initializes with a different metadata name: `'Tempwallets EVM'`
- Filters sessions to only include those with `eip155` namespace
- Handles EVM-specific methods:
  - `eth_sendTransaction`
  - `eth_signTransaction`
  - `personal_sign`
  - `eth_signTypedData`
  - `eth_signTypedData_v4`

**Key Implementation Details**:

1. **Separate Global Client**: Use a different global variable:
   ```typescript
   let globalEvmSignClient: SignClient | null = null;
   ```

2. **Namespace Filtering**: Only include sessions with `eip155` namespace:
   ```typescript
   .filter(s => s.namespaces?.eip155 !== undefined)
   ```

3. **Method Constants**:
   ```typescript
   const EVM_WALLETCONNECT_METHODS = [
     'eth_sendTransaction',
     'eth_signTransaction',
     'personal_sign',
     'eth_signTypedData',
     'eth_signTypedData_v4',
   ];
   ```

4. **Request Handling**: In the `session_request` event handler:
   - `eth_sendTransaction`: Call API to sign and send transaction
   - `eth_signTransaction`: Call API to sign transaction (return signature)
   - `personal_sign`: Call API to sign message
   - `eth_signTypedData` / `eth_signTypedData_v4`: Call API to sign typed data

5. **Account Retrieval**: Call `walletApi.getEvmWalletConnectAccounts()` (to be created in Step 8)

6. **Error Handling**: Handle EVM-specific errors gracefully

### Step 8: Update API Client

**File**: `/apps/web/lib/api.ts`

Add new EVM WalletConnect API methods:

```typescript
/**
 * Get EVM WalletConnect accounts (CAIP-10 formatted)
 */
async getEvmWalletConnectAccounts(
  userId: string,
  useTestnet: boolean = false,
): Promise<{
  userId: string;
  useTestnet: boolean;
  accounts: Array<{
    accountId: string; // CAIP-10 format: eip155:<chain_id>:<address>
    chainId: string;
    address: string;
    chainName: string; // Internal chain name (ethereum, base, etc.)
  }>;
}>

/**
 * Sign an EVM transaction for WalletConnect
 */
async signEvmWalletConnectTransaction(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  transaction: {
    from: string;
    to?: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
  };
  useTestnet?: boolean;
}): Promise<{ signature: string } | { txHash: string }>

/**
 * Sign an EVM message for WalletConnect (personal_sign)
 */
async signEvmWalletConnectMessage(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  message: string;
  useTestnet?: boolean;
}): Promise<{ signature: string }>

/**
 * Sign EVM typed data for WalletConnect (eth_signTypedData)
 */
async signEvmWalletConnectTypedData(data: {
  userId: string;
  accountId: string; // CAIP-10 format
  typedData: {
    types: Record<string, any>;
    primaryType: string;
    domain: Record<string, any>;
    message: Record<string, any>;
  };
  useTestnet?: boolean;
}): Promise<{ signature: string }>
```

### Step 9: Create EVM WalletConnect Modal Component

**File**: `/apps/web/components/dashboard/evm-walletconnect-modal.tsx`

Create a modal component similar to `walletconnect-modal.tsx` but:
- Uses `useEvmWalletConnect` hook instead of `useSubstrateWalletConnect`
- Updates text to reference "Ethereum" or "EVM" instead of "Polkadot"
- Lists EVM dapps (Uniswap, Aave, OpenSea, etc.) instead of Polkadot dapps
- Shows `eip155` namespace information instead of `polkadot` namespace

**UI Differences**:
- Title: "Connect to Ethereum DApp"
- Description: "Connect to Ethereum ecosystem dapps like Uniswap, Aave, OpenSea, and more. Only your EVM wallets will be used for these connections."
- Example dapp links: Update to Ethereum dapps

### Step 10: Add EVM Chain ID Utilities

**File**: `/apps/web/lib/evm-chain-ids.ts` (optional utility file)

Create a utility file for mapping chain IDs to chain names:

```typescript
export const EVM_CHAIN_IDS: Record<string, { chainId: string; name: string; isTestnet: boolean }> = {
  ethereum: { chainId: '1', name: 'Ethereum', isTestnet: false },
  sepolia: { chainId: '11155111', name: 'Sepolia', isTestnet: true },
  base: { chainId: '8453', name: 'Base', isTestnet: false },
  baseSepolia: { chainId: '84532', name: 'Base Sepolia', isTestnet: true },
  arbitrum: { chainId: '42161', name: 'Arbitrum', isTestnet: false },
  polygon: { chainId: '137', name: 'Polygon', isTestnet: false },
  avalanche: { chainId: '43114', name: 'Avalanche', isTestnet: false },
  // Add more chains as needed
};

export function getChainIdForChain(chainName: string): string | null {
  return EVM_CHAIN_IDS[chainName]?.chainId || null;
}

export function getChainNameForChainId(chainId: string): string | null {
  const entry = Object.entries(EVM_CHAIN_IDS).find(
    ([_, config]) => config.chainId === chainId
  );
  return entry ? entry[1].name : null;
}
```

---

## Namespace Isolation Strategy

### Critical Requirements

1. **Separate WalletConnect Clients**:
   - Substrate: `globalSubstrateSignClient`
   - EVM: `globalEvmSignClient`
   - Use different storage keys/namespaces in WalletConnect core storage

2. **Separate Initialization Delays**:
   - Add delays between initializations to prevent storage conflicts
   - Substrate already has a 1-second delay; EVM should wait an additional 1-2 seconds if Substrate is initializing

3. **Namespace Filtering**:
   - Substrate hook filters: `s.namespaces?.polkadot !== undefined`
   - EVM hook filters: `s.namespaces?.eip155 !== undefined`

4. **Separate Metadata**:
   - Substrate: `'Tempwallets Substrate'`
   - EVM: `'Tempwallets EVM'`

5. **Separate Project IDs** (Optional):
   - Consider using different WalletConnect project IDs if needed for complete isolation
   - Currently both can share the same project ID as long as clients are separate

### Storage Conflict Prevention

In `useEvmWalletConnect.ts`, add initialization delay logic:

```typescript
// Wait longer if Substrate client is initializing
if (typeof isInitializingGlobal !== 'undefined' && isInitializingGlobal) {
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Then add additional delay for EVM client
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## Testing Strategy

### Backend Testing

1. **Unit Tests**:
   - Test CAIP-10 formatting and parsing
   - Test transaction signing (EIP-1559 and Legacy)
   - Test message signing
   - Test typed data signing
   - Test account verification

2. **Integration Tests**:
   - Test full transaction flow (sign + verify)
   - Test message signing flow
   - Test typed data signing flow
   - Test error handling (invalid account ID, address mismatch, etc.)

3. **E2E Tests**:
   - Test WalletConnect session proposal
   - Test transaction signing request
   - Test message signing request

### Frontend Testing

1. **Hook Testing**:
   - Test client initialization
   - Test session management
   - Test request handling
   - Test error handling

2. **Component Testing**:
   - Test modal UI
   - Test QR code scanning
   - Test URI input
   - Test session display

3. **Integration Testing**:
   - Test full connection flow (scan QR → approve → sign transaction)
   - Test multiple simultaneous sessions
   - Test session disconnection

### Test DApps

Use these test dapps for EVM:
- **WalletConnect Test DApp**: https://react-app.walletconnect.com/
- **Uniswap**: https://app.uniswap.org/ (with WalletConnect option)
- **Aave**: https://app.aave.com/ (with WalletConnect option)
- **OpenSea**: https://opensea.io/ (with WalletConnect option)

---

## Migration & Rollout

### Phase 1: Backend Implementation
1. Create EVM module structure
2. Implement service, controller, and DTOs
3. Write unit tests
4. Deploy backend changes

### Phase 2: Frontend Implementation
1. Create EVM hook
2. Update API client
3. Create EVM modal component
4. Write component tests

### Phase 3: Integration Testing
1. Test with WalletConnect Test DApp
2. Test with real EVM dapps (Uniswap, Aave, etc.)
3. Test namespace isolation (ensure Substrate and EVM don't interfere)

### Phase 4: UI Integration
1. Add EVM WalletConnect button/modal trigger to UI
2. Ensure both Substrate and EVM modals can coexist
3. Test user flows

### Phase 5: Documentation & Cleanup
1. Update API documentation
2. Add inline code comments
3. Update README with EVM WalletConnect instructions

---

## Future Enhancements (Optional)

### API Consolidation Potential

While the initial implementation requires separate API endpoints for Substrate and EVM signing operations, there is significant potential for API consolidation in the future:

#### Unified Signing Endpoint (Backend)

**Concept**: Create a generic `/wallet/walletconnect/sign` endpoint that:
- Detects the namespace from the CAIP-10 account ID (`polkadot:*` vs `eip155:*`)
- Detects the payload type (transaction, message, typed data) from the request structure
- Routes to the appropriate service method based on namespace and payload type

**Benefits**:
- Single endpoint for all WalletConnect signing operations
- Cleaner routing logic on the backend
- Easier to add new chain types in the future
- Reduced code duplication

**Implementation Approach**:
```typescript
@Post('sign')
async sign(@Body() dto: UnifiedWalletConnectSignDto) {
  // Parse CAIP-10 account ID to detect namespace
  const namespace = dto.accountId.split(':')[0]; // 'polkadot' or 'eip155'
  
  // Detect payload type from request structure
  if (dto.transaction) {
    // Transaction signing
    if (namespace === 'polkadot') {
      return this.substrateService.signTransaction(...);
    } else if (namespace === 'eip155') {
      return this.evmService.signTransaction(...);
    }
  } else if (dto.message) {
    // Message signing
    if (namespace === 'polkadot') {
      return this.substrateService.signMessage(...);
    } else if (namespace === 'eip155') {
      return this.evmService.signMessage(...);
    }
  } else if (dto.typedData) {
    // Typed data signing (EVM only)
    if (namespace === 'eip155') {
      return this.evmService.signTypedData(...);
    }
  }
}
```

**Considerations**:
- Requires careful DTO design to support both namespace formats
- May need separate DTOs for each namespace initially, then merge later
- Validation logic becomes more complex but more maintainable long-term
- Can be implemented as a refactoring step after initial separate endpoints are working

#### Multi-Chain WalletConnect Hook (Frontend)

**Concept**: Create a unified `useMultiChainWalletConnect` hook that:
- Manages both Substrate and EVM clients internally
- Aggregates sessions from both namespaces
- Provides a unified interface that abstracts away namespace differences
- Routes requests to the appropriate client based on namespace

**Benefits**:
- Single hook for all WalletConnect operations
- Cleaner component code (no need to manage two separate hooks)
- Unified session management
- Easier to add new chain types

**Implementation Approach**:
```typescript
export function useMultiChainWalletConnect(userId: string) {
  const substrate = useSubstrateWalletConnect(userId);
  const evm = useEvmWalletConnect(userId);
  
  return {
    // Unified session list
    sessions: [
      ...substrate.sessions.map(s => ({ ...s, namespace: 'polkadot' })),
      ...evm.sessions.map(s => ({ ...s, namespace: 'eip155' })),
    ],
    
    // Unified pair function (detects namespace from URI)
    pair: async (uri: string) => {
      // Detect namespace from session proposal
      // Route to appropriate client
    },
    
    // Unified disconnect
    disconnect: async (topic: string) => {
      // Try both clients
    },
    
    // Unified request handling
    handleRequest: async (request: WalletConnectRequest) => {
      const namespace = request.chainId?.split(':')[0];
      if (namespace === 'polkadot') {
        return substrate.handleRequest(request);
      } else if (namespace === 'eip155') {
        return evm.handleRequest(request);
      }
    },
  };
}
```

**File**: `/apps/web/hooks/useMultiChainWalletConnect.ts`

#### Unified WalletConnect Modal

Create a `MultiChainWalletConnect.tsx` component that:
- Shows both Substrate and EVM connection options in a single UI
- Displays sessions from both namespaces with clear labels
- Allows switching between chain types or showing both simultaneously
- Uses the unified `useMultiChainWalletConnect` hook

**File**: `/apps/web/components/dashboard/multi-chain-walletconnect-modal.tsx`

#### Migration Path

1. **Phase 1** (Current): Implement separate endpoints and hooks (Substrate and EVM)
2. **Phase 2** (Future): Create unified backend endpoint that routes based on namespace
3. **Phase 3** (Future): Create unified frontend hook that aggregates both clients
4. **Phase 4** (Future): Create unified UI component
5. **Phase 5** (Future): Deprecate separate endpoints/hooks (optional, can keep for backward compatibility)

**Note**: The unified approach should be considered a future enhancement. The initial implementation with separate endpoints is recommended for:
- Clear separation of concerns
- Easier debugging and testing
- Faster initial development
- Lower risk of namespace conflicts

---

## Key Implementation Differences Summary

| Feature | Substrate | EVM |
|---------|-----------|-----|
| **Namespace** | `polkadot` | `eip155` |
| **Account Format** | `polkadot:<genesis_hash>:<address>` | `eip155:<chain_id>:<address>` |
| **Key Identifier** | Genesis Hash | Chain ID |
| **Transaction Methods** | `polkadot_signTransaction` | `eth_sendTransaction`, `eth_signTransaction` |
| **Message Methods** | `polkadot_signMessage` | `personal_sign` |
| **Typed Data** | Not supported | `eth_signTypedData`, `eth_signTypedData_v4` |
| **Transaction Format** | Substrate extrinsic (hex) | EIP-1559 or Legacy transaction object |
| **Signing Library** | `@polkadot/keyring` | `ethers.js` or `viem` |
| **Client Global Variable** | `globalSubstrateSignClient` | `globalEvmSignClient` |

---

## Dependencies to Install

### Backend
**Required Dependencies**: Ensure the backend environment has necessary libraries for handling EVM signing utilities:

1. **EVM Signing Library** (choose one):
   - `ethers` (v5 or v6) - Comprehensive EVM library with EIP-712 and transaction signing support
   - `viem` - Modern, lightweight alternative with excellent TypeScript support
   
   **Check existing codebase**: Review `/apps/backend/src/wallet/` to see which library is already in use. If neither is present, add one:
   ```bash
   npm install ethers  # OR
   npm install viem
   ```

2. **EIP-712 Support**:
   - `ethers`: Built-in `_TypedDataEncoder` and `signTypedData()` methods
   - `viem`: Built-in `signTypedData()` function
   
   Both libraries support EIP-712 typed data signing out of the box.

3. **Transaction Format Support**:
   - Both libraries support EIP-1559 and Legacy transaction formats
   - `ethers`: `TransactionRequest` interface with `maxFeePerGas`/`maxPriorityFeePerGas` for EIP-1559
   - `viem`: `TransactionRequest` type with similar structure

**Verification Steps**:
- Check `package.json` in `/apps/backend/` for existing EVM libraries
- Review `AccountFactory` or `PimlicoAccountFactory` to see which library is used
- If using `viem`, ensure version supports EIP-712 (v1.0.0+)
- If using `ethers`, ensure version supports EIP-712 (v5.0.0+)

### Frontend
No new dependencies required (WalletConnect is already installed for Substrate).

---

## Notes

- **Security**: Always verify that the address in the CAIP-10 account ID belongs to the requesting user before signing
- **Error Handling**: Implement comprehensive error handling for all EVM-specific edge cases
- **Logging**: Add detailed logging for debugging WalletConnect sessions and requests
- **Performance**: Consider caching chain ID mappings and account information
- **Compatibility**: Ensure compatibility with both WalletConnect v2 and Reown (if applicable)

---

## Questions to Resolve

1. **Transaction Broadcasting**: Should `eth_sendTransaction` automatically broadcast, or just return the signature? (WalletConnect standard expects broadcasting, but we may want to return signature for user confirmation)
2. **Account Selection**: Should we support multiple EVM accounts per chain, or just the primary account (accountIndex 0)?
3. **Testnet Support**: Should testnet chains be included by default, or only when `useTestnet=true`?
4. **ERC-4337 Support**: Should we support ERC-4337 smart accounts for WalletConnect, or only EOA accounts?
5. **Chain Support**: Which EVM chains should be supported initially? (Ethereum, Base, Arbitrum, Polygon, Avalanche)

---

## Estimated Timeline

- **Backend Implementation**: 3-5 days
- **Frontend Implementation**: 3-5 days
- **Testing & Integration**: 2-3 days
- **Total**: ~2 weeks (depending on complexity of transaction signing implementation)

---

**End of Implementation Plan**

