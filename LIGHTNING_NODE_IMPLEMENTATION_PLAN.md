# Lightning Node: Fix Deposit/Transfer + Add Withdraw Implementation Plan

## Executive Summary

This plan fixes the current broken deposit/transfer functionality and implements the complete deposit → transfer → withdraw flow for your Lightning Node application using Yellow Network.

**CRITICAL BUGS FOUND:**
1. ❌ **Status Mismatch**: Backend uses 'open' status, frontend expects 'active' - buttons are ALWAYS disabled
2. ❌ **Invisible Disabled Buttons**: Disabled button styling (`disabled:bg-white/5 disabled:text-white/30`) makes them invisible
3. ❌ **Withdraw Not Implemented**: No withdraw endpoint or UI

**Current State:**
- ⚠️ Deposit: Code exists but buttons disabled due to status mismatch
- ⚠️ Transfer: Code exists but buttons disabled due to status mismatch
- ❌ **Withdraw: Lightning Node → Unified Balance (MISSING)**
- ✅ Close: Entire Lightning Node closure works

**What We'll Fix:**
1. Fix status mismatch (frontend 'active' → 'open' to match backend)
2. Improve disabled button visibility and add tooltips
3. Implement withdraw functionality (backend + frontend)

---

## Yellow Network Documentation References

**Key Documentation:**
- 📂 `/Users/monstu/Developer/crawl4Ai/yellow/` - Yellow Network official docs (crawled)
- 📂 `/Users/monstu/Developer/Docs/yellow-docs/` - Yellow Network documentation

**Important Files:**
- `docs_protocol_off-chain_channel-methods.md` - Channel creation, resize, close methods
- `docs_protocol_off-chain_transfers.md` - Direct transfers and peer-to-peer payments
- `docs_protocol_off-chain_app-sessions.md` - App session management (Lightning Nodes)
- `docs_protocol_on-chain_channel-lifecycle.md` - On-chain channel lifecycle
- `WALLET_INTEGRATION_GUIDE.md` - Complete wallet integration
- `YELLOW_NETWORK_ARCHITECTURE_EXPLAINED.md` - Architecture deep dive
- `YELLOW_NETWORK_NATIVE_FLOW.md` - Native flow patterns

**Yellow Network Concepts:**
- **App Sessions** = Lightning Nodes (multi-party state channels)
- **Unified Balance** = Off-chain balance managed by Yellow Network
- **Intent Types**: DEPOSIT, OPERATE (transfer), WITHDRAW, CLOSE
- **Protocol**: NitroRPC/0.4 for gasless off-chain operations

---

## Architecture Overview

**Yellow Network Flow:**
```
Deposit:   Unified Balance → Lightning Node (Intent: DEPOSIT)
Transfer:  Within Lightning Node (Intent: OPERATE)
Withdraw:  Lightning Node → Unified Balance (Intent: WITHDRAW)
Close:     Returns all funds (Intent: CLOSE)
```

All operations are **gasless** and **off-chain** using Yellow Network's NitroRPC/0.4 protocol.

**Reference:** See `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_app-sessions.md` for complete app session (Lightning Node) lifecycle.

---

## PART 0: FIX CRITICAL BUGS (DO THIS FIRST!)

### Bug #1: Status Mismatch - Backend 'open' vs Frontend 'active'

**Problem:**
- Backend checks: `if (lightningNode.status !== 'open')` (lightning-node.service.ts:1142)
- Frontend expects: `disabled={node.status !== 'active'}` (LightningNodeDetailModal.tsx:149)
- Frontend constants define: `active`, `pending`, `closing`, `closed` - NO 'open' status!
- **Result:** Buttons are ALWAYS disabled because status never matches

**Root Cause:**
The database stores status as 'open', but the frontend expects 'active'. The frontend constants don't even include 'open' as a valid status.

**Solution: Update Frontend to use 'open' (RECOMMENDED)**
- Less risky - backend is working correctly
- Only touch frontend files
- Align frontend constants with backend reality

#### Fix #1.1: Update Lightning Constants ✅ COMPLETED

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/utils/lightning-constants.ts`

```typescript
export const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-700 border-green-200',    // ✅ Changed from 'active'
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  closing: 'bg-orange-100 text-orange-700 border-orange-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const STATUS_TEXT: Record<string, string> = {
  open: 'Active',    // ✅ Changed from 'active', displays as 'Active'
  pending: 'Pending',
  closing: 'Closing',
  closed: 'Closed',
};
```

#### Fix #1.2: Update Detail Modal Button Conditions ⏳ IN PROGRESS

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodeDetailModal.tsx`

**Already fixed (lines 50-52):**
```typescript
const canInvite = node.participantCount < MAX_PARTICIPANTS && node.status === 'open';  // ✅
const canSend = parseFloat(node.yourBalance) > 0 && node.participantCount > 1 && node.status === 'open';  // ✅
const canClose = node.status === 'open' || node.status === 'closing';  // ✅
```

**Still need to fix (line 149):**
```typescript
// Before:
<Button
  onClick={onDeposit}
  disabled={node.status !== 'active'}  // ❌ WRONG
>

// After:
<Button
  onClick={onDeposit}
  disabled={node.status !== 'open'}  // ✅ CORRECT
>
```

#### Fix #1.3: Update Type Definitions ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/types/lightning-nodes.types.ts`

Change the status type:
```typescript
// Find and update:
status: 'active' | 'pending' | 'closing' | 'closed';  // ❌ REMOVE 'active'

// To:
status: 'open' | 'pending' | 'closing' | 'closed';  // ✅ ADD 'open'
```

---

### Bug #2: Invisible Disabled Buttons ⏳ TODO

**Problem:**
Disabled button styling makes buttons almost invisible:
```typescript
className="... disabled:bg-white/5 disabled:text-white/30 ..."
```
This is why the user said "I see no deposit button" - it's there but invisible!

**Solution:** Improve disabled button visibility and add tooltips

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodeDetailModal.tsx`

Update all action buttons (lines 146-172) to have better disabled styles and tooltips:

```typescript
{/* Action Buttons */}
<div className="grid grid-cols-3 gap-2">
  <Button
    onClick={onDeposit}
    disabled={node.status !== 'open'}
    className="bg-white/10 text-white hover:bg-white/20 disabled:bg-white/10 disabled:text-white/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-white/10"
    title={node.status !== 'open' ? `Lightning Node must be open to deposit (current status: ${node.status})` : 'Deposit funds to this Lightning Node'}
  >
    <Plus className="h-4 w-4" />
    Deposit
  </Button>

  <Button
    onClick={onSend}
    disabled={!canSend}
    className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/30 disabled:text-white/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    title={!canSend ? (
      parseFloat(node.yourBalance) <= 0
        ? 'You need a balance to send funds'
        : node.participantCount <= 1
          ? 'Need at least 2 participants to send funds'
          : 'Lightning Node must be open to send'
    ) : 'Send funds to a participant'}
  >
    <Send className="h-4 w-4" />
    Send
  </Button>

  <Button
    onClick={onInvite}
    disabled={!canInvite}
    variant="outline"
    className="border-white/20 text-white hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    title={!canInvite ? (
      node.participantCount >= MAX_PARTICIPANTS
        ? 'Maximum participants reached'
        : 'Lightning Node must be open to invite'
    ) : 'Invite participants to this Lightning Node'}
  >
    <UserPlus className="h-4 w-4" />
    Invite
  </Button>
</div>
```

**Key Changes:**
1. `disabled:opacity-60` - More visible than before
2. `disabled:cursor-not-allowed` - Shows it's disabled
3. `disabled:text-white/50` - Brighter than /30
4. `title` tooltips - Explain WHY button is disabled

---

## PART 1: Backend Withdraw Implementation

**Reference:** Follow the same pattern as existing `deposit()` and `transfer()` methods. Yellow Network's `withdrawFromLightningNode()` already exists in NitroliteClient.

**Yellow Network Docs:** See `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_app-sessions.md` - Section on WITHDRAW intent.

### 1.1 Create WithdrawFundsDto ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/dto/withdraw-funds.dto.ts` (CREATE NEW)

**Pattern:** Clone from `DepositFundsDto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for Withdrawing Funds from Lightning Node
 * Reference: Yellow Network WITHDRAW intent
 */
export class WithdrawFundsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  appSessionId: string; // Lightning Node session ID

  @IsString()
  @IsNotEmpty()
  amount: string; // Human-readable amount (e.g., "100.0")

  @IsString()
  @IsNotEmpty()
  asset: string; // USDC, USDT, etc.

  @IsString()
  @IsNotEmpty()
  participantAddress: string; // Withdrawer's address
}
```

### 1.2 Export DTO ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/dto/index.ts`

Add this line:
```typescript
export * from './withdraw-funds.dto.js';
```

### 1.3 Add Controller Endpoint ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/lightning-node.controller.ts`

**Location:** After `transfer()` method (~line 116), before `close()`

1. Add import:
```typescript
import { WithdrawFundsDto } from './dto/index.js';
```

2. Add endpoint:
```typescript
/**
 * POST /lightning-node/withdraw
 * Withdraw funds from Lightning Node back to unified balance (gasless)
 * Uses Yellow Network WITHDRAW intent
 */
@Post('withdraw')
@HttpCode(HttpStatus.OK)
async withdraw(@Body(ValidationPipe) dto: WithdrawFundsDto) {
  return await this.lightningNodeService.withdraw(dto);
}
```

### 1.4 Implement Service Method ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/lightning-node.service.ts`

**Location:** After `transfer()` method (~line 1538), before `close()`

**Pattern:** Follow exact pattern of `deposit()` method (lines 1406-1469)

**Yellow Network Method:** Uses `client.withdrawFromLightningNode()` which calls Yellow Network's API with WITHDRAW intent.

```typescript
/**
 * Withdraw funds from a Lightning Node back to unified balance (gasless) via Yellow.
 *
 * Yellow Network Flow:
 * 1. Get current app session allocations
 * 2. Call withdrawFromLightningNode() with WITHDRAW intent
 * 3. Update participant balances in local DB
 *
 * Reference: /Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_app-sessions.md
 */
async withdraw(dto: WithdrawFundsDto) {
  const node = await this.prisma.lightningNode.findUnique({
    where: { appSessionId: dto.appSessionId },
    include: { participants: true },
  });
  if (!node)
    throw new NotFoundException(
      `Lightning Node not found: ${dto.appSessionId}`,
    );

  const {
    address: userWalletAddress,
    isEOA,
    chainKey,
  } = await this.getUserWalletAddress(dto.userId, node.chain);

  const cacheKey = `${dto.userId}-${node.chain}-${userWalletAddress}`;

  await this.executeWithRetry(
    async (client) => {
      // Get current allocations from Yellow Network
      const remoteSession = await client.getLightningNode(
        node.appSessionId as `0x${string}`,
      );
      const currentAllocations: AppSessionAllocation[] =
        (remoteSession.allocations || []) as any;

      // Withdraw via Yellow Network (WITHDRAW intent)
      await client.withdrawFromLightningNode(
        node.appSessionId as `0x${string}`,
        dto.participantAddress as Address,
        dto.asset,
        dto.amount,
        currentAllocations,
      );

      // Refresh remote state and persist balances
      const updated = await client.getLightningNode(
        node.appSessionId as `0x${string}`,
      );
      const updatedAllocations: AppSessionAllocation[] = (updated.allocations ||
        []) as any;

      // Update local database with new balances
      for (const alloc of updatedAllocations) {
        await this.prisma.lightningNodeParticipant.updateMany({
          where: {
            lightningNodeId: node.id,
            address: (alloc as any).participant,
            asset: dto.asset,
          },
          data: { balance: (alloc as any).amount } as any,
        });
      }

      return { ok: true };
    },
    dto.userId,
    node.chain,
    userWalletAddress,
    isEOA,
    chainKey,
    cacheKey,
  );

  return { ok: true };
}
```

**Key Points:**
- Uses existing `executeWithRetry` helper (handles session expiry)
- Calls `client.withdrawFromLightningNode()` (already exists in NitroliteClient)
- Updates participant balances in database
- Returns `{ ok: true }` on success
- All operations gasless via Yellow Network

---

## PART 2: Frontend Withdraw Implementation

**Reference:** Follow patterns from `DepositLightningModal.tsx` and `SendToParticipantModal.tsx`

### 2.1 Create WithdrawLightningModal Component ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/WithdrawLightningModal.tsx` (CREATE NEW)

**Pattern:** Clone and modify `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/DepositLightningModal.tsx`

**Key Differences:**
- Icon: `ArrowUpFromLine` (instead of `ArrowDownToLine`)
- Title: "Withdraw from Lightning Node"
- Validation: Check against `node.yourBalance` (not unlimited)
- Info: Emphasize "returns to unified balance"
- New Balance Preview: Show decreased balance

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ArrowUpFromLine, Info } from 'lucide-react';
import type { LightningNode } from '@/types/lightning-nodes.types';

interface WithdrawLightningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: LightningNode | null;
  onWithdraw: (amount: string) => Promise<void>;
}

export function WithdrawLightningModal({
  open,
  onOpenChange,
  node,
  onWithdraw,
}: WithdrawLightningModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!node) return null;

  const yourBalance = parseFloat(node.yourBalance);

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);

    // Validation
    if (!amount.trim() || isNaN(amountNum)) {
      setError('Please enter a valid amount');
      return;
    }

    if (amountNum <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (amountNum > yourBalance) {
      setError(`Insufficient balance. You have ${node.yourBalance} ${node.token}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onWithdraw(amount);
      setSuccess(true);
      setTimeout(() => handleClose(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError(null);
    setSuccess(false);
    onOpenChange(false);
  };

  const handleMaxAmount = () => {
    setAmount(node.yourBalance);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5" />
            Withdraw from Lightning Node
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Move funds back to your unified balance (gasless transaction)
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-rubik-medium text-gray-900 mb-2">Withdrawal Successful!</p>
            <p className="text-sm text-gray-600">Funds returned to your unified balance</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Current Balance */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">Lightning Node Balance</p>
              <p className="text-2xl font-rubik-medium text-gray-900">
                {node.yourBalance} {node.token}
              </p>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount" className="text-gray-700">
                  Withdrawal Amount
                </Label>
                <button
                  onClick={handleMaxAmount}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  MAX
                </button>
              </div>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 pr-16 text-lg"
                  disabled={loading}
                  step="0.01"
                  min="0"
                  max={node.yourBalance}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
                  {node.token}
                </span>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {['10', '25', '50', '100'].map((value) => (
                <Button
                  key={value}
                  onClick={() => {
                    setAmount(value);
                    setError(null);
                  }}
                  variant="outline"
                  className="border-gray-300 text-gray-900 hover:bg-gray-50 text-sm"
                  disabled={loading || parseFloat(value) > yourBalance}
                >
                  {value}
                </Button>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-medium mb-1">Gasless withdrawal via Yellow Network</p>
                <p>
                  This will move {node.token} from your Lightning Node back to your unified balance.
                  No gas fees required. The transaction is instant and off-chain.
                </p>
              </div>
            </div>

            {/* New Balance Preview */}
            {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && parseFloat(amount) <= yourBalance && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="text-xs text-green-700 mb-1">New Lightning Node Balance</p>
                <p className="text-lg font-rubik-medium text-green-900">
                  {(yourBalance - parseFloat(amount)).toFixed(2)} {node.token}
                </p>
              </div>
            )}
          </div>
        )}

        {!success && (
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-gray-300 text-gray-900"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={loading || !amount.trim() || parseFloat(amount) > yourBalance}
              className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Withdraw Funds'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 2.2 Add Type Definition ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/types/lightning-nodes.types.ts`

Add:
```typescript
export interface WithdrawParams {
  channelId: string;
  amount: number;
}
```

Also update status type:
```typescript
status: 'open' | 'pending' | 'closing' | 'closed';  // Change 'active' to 'open'
```

### 2.3 Add Hook Method ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/hooks/useLightningNodes.ts`

Add import:
```typescript
import type { WithdrawParams } from '@/types/lightning-nodes.types';
```

Add method (after `depositToNode`):
```typescript
/**
 * Withdraw funds from a Lightning Node
 * Calls backend which uses Yellow Network WITHDRAW intent
 */
const withdrawFromNode = useCallback(async (params: WithdrawParams) => {
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  try {
    const payload = {
      channelId: params.channelId,
      userAddress: walletAddress,
      amount: params.amount,
    };

    await api.post('/lightning-node/withdraw', payload);

    setNotification?.('Withdrawal successful!', 'success');
    await fetchNodes(walletAddress);
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || 'Failed to withdraw funds';
    setNotification?.(errorMsg, 'error');
    throw new Error(errorMsg);
  }
}, [walletAddress, setNotification, fetchNodes]);
```

Add to return value:
```typescript
return {
  nodes,
  loading,
  error,
  createNode,
  joinNode,
  depositToNode,
  withdrawFromNode, // ADD THIS
  sendToParticipant,
  initiateClose,
  approveClose,
  rejectClose,
  refreshNodes: () => walletAddress && fetchNodes(walletAddress),
};
```

### 2.4 Wire Up Withdraw Button ⏳ TODO

**File:** `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodeDetailModal.tsx`

1. Add import:
```typescript
import { Copy, Users, Zap, Send, Plus, ArrowUpFromLine, UserPlus, XCircle, AlertCircle, X } from 'lucide-react';
```

2. Add to props:
```typescript
interface LightningNodeDetailModalProps {
  // ... existing props
  onWithdraw: () => void; // ADD THIS
}
```

3. Replace the 3-column button grid (lines 146-172) with 4-column:
```typescript
{/* Action Buttons */}
<div className="grid grid-cols-4 gap-2">
  <Button
    onClick={onDeposit}
    disabled={node.status !== 'open'}
    className="bg-white/10 text-white hover:bg-white/20 disabled:bg-white/10 disabled:text-white/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-white/10"
    title={node.status !== 'open' ? `Lightning Node must be open (current: ${node.status})` : 'Deposit funds to this Lightning Node'}
  >
    <Plus className="h-4 w-4" />
    Deposit
  </Button>

  <Button
    onClick={onWithdraw}
    disabled={node.status !== 'open' || parseFloat(node.yourBalance) <= 0}
    className="bg-white/10 text-white hover:bg-white/20 disabled:bg-white/10 disabled:text-white/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-white/10"
    title={
      node.status !== 'open'
        ? `Lightning Node must be open (current: ${node.status})`
        : parseFloat(node.yourBalance) <= 0
          ? 'You need a balance to withdraw funds'
          : 'Withdraw funds from Lightning Node'
    }
  >
    <ArrowUpFromLine className="h-4 w-4" />
    Withdraw
  </Button>

  <Button
    onClick={onSend}
    disabled={!canSend}
    className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/30 disabled:text-white/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    title={!canSend ? (
      parseFloat(node.yourBalance) <= 0
        ? 'You need a balance to send funds'
        : node.participantCount <= 1
          ? 'Need at least 2 participants to send funds'
          : 'Lightning Node must be open to send'
    ) : 'Send funds to a participant'}
  >
    <Send className="h-4 w-4" />
    Send
  </Button>

  <Button
    onClick={onInvite}
    disabled={!canInvite}
    variant="outline"
    className="border-white/20 text-white hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    title={!canInvite ? (
      node.participantCount >= MAX_PARTICIPANTS
        ? 'Maximum participants reached'
        : 'Lightning Node must be open to invite'
    ) : 'Invite participants to this Lightning Node'}
  >
    <UserPlus className="h-4 w-4" />
    Invite
  </Button>
</div>
```

**Note:** All buttons now use 'open' status instead of 'active', with improved disabled styling and tooltips.

### 2.5 Wire Up in Parent Component ⏳ TODO

**File:** Find where `LightningNodeDetailModal` is used (likely `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodesView.tsx`)

1. Add state:
```typescript
const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
```

2. Import the modal:
```typescript
import { WithdrawLightningModal } from './WithdrawLightningModal';
```

3. Add modal component:
```typescript
<WithdrawLightningModal
  open={withdrawModalOpen}
  onOpenChange={setWithdrawModalOpen}
  node={selectedNode}
  onWithdraw={async (amount) => {
    if (!selectedNode) return;
    await withdrawFromNode({
      channelId: selectedNode.channelId,
      amount: parseFloat(amount),
    });
  }}
/>
```

4. Update detail modal:
```typescript
<LightningNodeDetailModal
  // ... existing props
  onWithdraw={() => setWithdrawModalOpen(true)}
/>
```

---

## Implementation Checklist

### Phase 1: Fix Bugs (CRITICAL - DO FIRST!)
- [x] ✅ Update `lightning-constants.ts` - change 'active' → 'open'
- [x] ✅ Update `LightningNodeDetailModal.tsx` - fix status checks (lines 50-52)
- [ ] ⏳ Update `LightningNodeDetailModal.tsx` - fix deposit button (line 149)
- [ ] ⏳ Update `lightning-nodes.types.ts` - change status type
- [ ] ⏳ Improve button styling with tooltips

### Phase 2: Backend Withdraw
- [ ] ⏳ Create `WithdrawFundsDto.ts`
- [ ] ⏳ Export DTO in `index.ts`
- [ ] ⏳ Add controller endpoint
- [ ] ⏳ Implement service method

### Phase 3: Frontend Withdraw
- [ ] ⏳ Create `WithdrawLightningModal.tsx`
- [ ] ⏳ Add `WithdrawParams` type
- [ ] ⏳ Add `withdrawFromNode()` hook method
- [ ] ⏳ Wire up withdraw button (4-column grid)
- [ ] ⏳ Wire up in parent component

### Phase 4: Testing
- [ ] ⏳ Test deposit button works
- [ ] ⏳ Test transfer button works
- [ ] ⏳ Test withdraw functionality
- [ ] ⏳ Test complete flow: deposit → transfer → withdraw → close

---

## Files to Modify - Quick Reference

### PART 0: Bug Fixes (3 files)
1. ✅ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/utils/lightning-constants.ts`
2. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodeDetailModal.tsx`
3. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/types/lightning-nodes.types.ts`

### PART 1: Backend Withdraw (4 files)
1. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/dto/withdraw-funds.dto.ts` (CREATE)
2. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/dto/index.ts`
3. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/lightning-node.controller.ts`
4. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/backend/src/lightning-node/lightning-node.service.ts`

### PART 2: Frontend Withdraw (5 files)
1. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/WithdrawLightningModal.tsx` (CREATE)
2. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/types/lightning-nodes.types.ts`
3. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/hooks/useLightningNodes.ts`
4. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodeDetailModal.tsx`
5. ⏳ `/Users/monstu/Developer/Tempwallets.com/apps/frontend/src/components/lightning-nodes/LightningNodesView.tsx` (or parent component)

**Total: 12 files (3 bug fixes + 4 backend + 5 frontend)**

---

## Success Criteria

### Phase 1: Bug Fixes (Must-Have)
- ✅ Deposit button visible and enabled (when node is 'open')
- ✅ Transfer button visible and enabled (when conditions met)
- ⏳ Disabled buttons clearly visible with tooltips
- ⏳ Users can successfully deposit and transfer

### Phase 2: Withdraw Feature (Must-Have)
- ⏳ Users can withdraw funds from Lightning Node
- ⏳ Withdrawal is gasless (Yellow Network)
- ⏳ Balance updates in real-time
- ⏳ UI matches existing patterns
- ⏳ Complete flow works: Deposit → Transfer → Withdraw → Close

---

## Yellow Network References

### Key Concepts
- **App Sessions** = Your Lightning Nodes
- **Unified Balance** = Off-chain Yellow Network balance
- **Intents**: DEPOSIT, OPERATE, WITHDRAW, CLOSE
- **Gasless**: All operations are free (no gas)

### Documentation Files
- **App Sessions**: `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_app-sessions.md`
- **Transfers**: `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_transfers.md`
- **Channel Methods**: `/Users/monstu/Developer/crawl4Ai/yellow/docs_protocol_off-chain_channel-methods.md`
- **Architecture**: `/Users/monstu/Developer/Docs/yellow-docs/YELLOW_NETWORK_ARCHITECTURE_EXPLAINED.md`
- **Native Flow**: `/Users/monstu/Developer/Docs/yellow-docs/YELLOW_NETWORK_NATIVE_FLOW.md`

---

## Notes

- ✅ Yellow Network SDK method `withdrawFromLightningNode()` already exists in NitroliteClient
- ✅ All operations use Yellow Network's off-chain protocol (no gas fees)
- ✅ Database model `LightningNodeTransaction` already supports `type: "withdraw"`
- ✅ Follow exact patterns from `deposit()` and `transfer()` implementations
- ✅ Real-time updates handled by existing polling mechanism (4-second interval)
- ✅ Backend is correct - uses 'open' status consistently
- ⚠️ Frontend needs alignment - must use 'open' instead of 'active'

---

## Project Structure

```
/Users/monstu/Developer/
├── Tempwallets.com/              # Main project (CORRECT PATH)
│   ├── apps/
│   │   ├── backend/
│   │   │   └── src/
│   │   │       └── lightning-node/
│   │   │           ├── dto/
│   │   │           ├── lightning-node.controller.ts
│   │   │           └── lightning-node.service.ts
│   │   └── frontend/
│   │       └── src/
│   │           ├── components/
│   │           │   └── lightning-nodes/
│   │           ├── hooks/
│   │           ├── types/
│   │           └── utils/
├── crawl4Ai/yellow/              # Yellow Network docs (crawled)
└── Docs/yellow-docs/             # Yellow Network docs (additional)
```
