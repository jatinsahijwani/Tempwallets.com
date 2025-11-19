"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Label } from "@repo/ui/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { walletApi, TokenBalance, ApiError, AnyChainAsset } from "@/lib/api";

interface SendCryptoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chain: string;
  userId: string;
  onSuccess?: () => void;
}

const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  tron: "Tron",
  bitcoin: "Bitcoin",
  solana: "Solana",
  ethereumErc4337: "Ethereum (ERC-4337)",
  baseErc4337: "Base (ERC-4337)",
  arbitrumErc4337: "Arbitrum (ERC-4337)",
  polygonErc4337: "Polygon (ERC-4337)",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  avalancheErc4337: "Avalanche (ERC-4337)",
  avalanche: "Avalanche",
  // Polkadot EVM Compatible chains
  moonbeamTestnet: "Moonbeam Testnet",
  astarShibuya: "Astar Shibuya",
  paseoPassetHub: "Paseo PassetHub",
  // Substrate/Polkadot chains
  polkadot: "Polkadot",
  hydrationSubstrate: "Hydration (Substrate)",
  bifrostSubstrate: "Bifrost (Substrate)",
  uniqueSubstrate: "Unique (Substrate)",
  paseo: "Paseo",
  paseoAssethub: "Paseo AssetHub",
};

// Address validation per chain type
const validateAddress = (address: string, chain: string): string | null => {
  if (!address || address.trim().length === 0) {
    return "Recipient address is required";
  }

  const trimmed = address.trim();

  // EVM chains (Ethereum, ERC-4337 chains, Base/Arbitrum/Polygon EOAs)
  if (["ethereum", "ethereumErc4337", "base", "baseErc4337", "arbitrum", "arbitrumErc4337", "polygon", "polygonErc4337", "avalanche", "avalancheErc4337"].includes(chain)) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return "Invalid Ethereum address format (must start with 0x and be 42 characters)";
    }
  }

  // Tron
  if (chain === "tron") {
    if (!/^T[A-Za-z1-9]{33}$/.test(trimmed)) {
      return "Invalid Tron address format (must start with T and be 34 characters)";
    }
  }

  // Bitcoin
  if (chain === "bitcoin") {
    if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(trimmed)) {
      return "Invalid Bitcoin address format";
    }
  }

  // Solana
  if (chain === "solana") {
    if (trimmed.length < 32 || trimmed.length > 44) {
      return "Invalid Solana address format (must be 32-44 characters)";
    }
  }

  // Substrate/Polkadot chains (SS58 format)
  const SUBSTRATE_CHAINS = ["polkadot", "hydrationSubstrate", "bifrostSubstrate", "uniqueSubstrate", "paseo", "paseoAssethub"];
  if (SUBSTRATE_CHAINS.includes(chain)) {
    // SS58 addresses are typically 48 characters, but can vary
    // Basic validation: should be alphanumeric and reasonable length
    if (trimmed.length < 32 || trimmed.length > 50 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
      return "Invalid Substrate address format (SS58 encoded, typically 32-50 characters)";
    }
  }

  return null;
};

/**
 * Format transaction hash for block explorer
 * Substrate chains need hash without 0x prefix for Subscan
 */
const formatTxHashForExplorer = (hash: string, isSubstrate: boolean = false): string => {
  if (!hash) return '';
  // Remove 0x prefix for Substrate chains (Subscan expects it without prefix)
  if (isSubstrate && hash.startsWith('0x')) {
    return hash.slice(2);
  }
  return hash;
};

const getExplorerUrl = (txHash: string, chain: string): string => {
  if (!txHash) return '#';

  // Determine if this is a testnet chain
  const isTestnet = chain === 'paseo' || chain === 'paseoAssethub' || 
                    chain === 'moonbeamTestnet' || chain === 'astarShibuya' ||
                    chain === 'paseoPassetHub';

  // EVM chains (testnet support)
  const evmExplorers: Record<string, { mainnet: string; testnet?: string }> = {
    ethereum: { mainnet: 'https://etherscan.io', testnet: 'https://sepolia.etherscan.io' },
    base: { mainnet: 'https://basescan.org', testnet: 'https://sepolia.basescan.org' },
    arbitrum: { mainnet: 'https://arbiscan.io', testnet: 'https://sepolia.arbiscan.io' },
    polygon: { mainnet: 'https://polygonscan.com', testnet: 'https://mumbai.polygonscan.com' },
    avalanche: { mainnet: 'https://snowtrace.io', testnet: 'https://testnet.snowtrace.io' },
    moonbeamTestnet: { mainnet: 'https://moonscan.io', testnet: 'https://moonbase.moonscan.io' },
    astarShibuya: { mainnet: 'https://astar.subscan.io', testnet: 'https://shibuya.subscan.io' },
    paseoPassetHub: { mainnet: 'https://assethub-polkadot.subscan.io', testnet: 'https://assethub-paseo.subscan.io' },
  };

  // Check if it's an EVM chain
  const evmChain = chain.replace('Erc4337', '');
  if (evmExplorers[evmChain]) {
    const explorer = isTestnet && evmExplorers[evmChain].testnet 
      ? evmExplorers[evmChain].testnet 
      : evmExplorers[evmChain].mainnet;
    return `${explorer}/tx/${txHash}`;
  }

  // Non-EVM chains
  const nonEvmExplorers: Record<string, string> = {
    tron: `https://tronscan.org/#/transaction/${txHash}`,
    bitcoin: `https://blockstream.info/tx/${txHash}`,
    solana: `https://solscan.io/tx/${txHash}`,
  };

  if (nonEvmExplorers[chain]) {
    return nonEvmExplorers[chain];
  }

  // Substrate/Polkadot chains - use Subscan
  const substrateExplorers: Record<string, { mainnet: string; testnet: string }> = {
    polkadot: { 
      mainnet: 'https://polkadot.subscan.io', 
      testnet: 'https://paseo.subscan.io' 
    },
    hydrationSubstrate: { 
      mainnet: 'https://hydradx.subscan.io', 
      testnet: 'https://hydradx-testnet.subscan.io' 
    },
    bifrostSubstrate: { 
      mainnet: 'https://bifrost.subscan.io', 
      testnet: 'https://bifrost-testnet.subscan.io' 
    },
    uniqueSubstrate: { 
      mainnet: 'https://unique.subscan.io', 
      testnet: 'https://unique-testnet.subscan.io' 
    },
    paseo: { 
      mainnet: 'https://paseo.subscan.io', 
      testnet: 'https://paseo.subscan.io' 
    },
    paseoAssethub: { 
      mainnet: 'https://assethub-polkadot.subscan.io', 
      testnet: 'https://assethub-paseo.subscan.io' 
    },
  };

  if (substrateExplorers[chain]) {
    const explorer = isTestnet ? substrateExplorers[chain].testnet : substrateExplorers[chain].mainnet;
    const formattedHash = formatTxHashForExplorer(txHash, true);
    return `${explorer}/extrinsic/${formattedHash}`;
  }

  return '#';
};

// Map internal chain identifiers to Zerion canonical chain ids used by assets-any
const mapToZerionChain = (chain: string): string => {
  const m: Record<string, string> = {
    ethereum: 'ethereum',
    ethereumErc4337: 'ethereum',
    base: 'base',
    baseErc4337: 'base',
    arbitrum: 'arbitrum',
    arbitrumErc4337: 'arbitrum',
    polygon: 'polygon',
    polygonErc4337: 'polygon',
    solana: 'solana',
    avalanche: 'avalanche',
    avalancheErc4337: 'avalanche',
  };
  return m[chain] || chain;
};

export function SendCryptoModal({ open, onOpenChange, chain, userId, onSuccess }: SendCryptoModalProps) {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; address?: string }>({});
  const [txHash, setTxHash] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load tokens when modal opens
  useEffect(() => {
    if (open && userId && chain) {
      loadTokens();
    } else {
      // Reset state when modal closes
      setTokens([]);
      setSelectedToken(null);
      setAmount("");
      setRecipientAddress("");
      setError(null);
      setFieldErrors({});
      setTxHash(null);
      setSuccess(false);
    }
  }, [open, userId, chain]);

  const loadTokens = async () => {
    setLoadingTokens(true);
    setError(null);
    try {
      // Check if this is a Substrate chain
      const SUBSTRATE_CHAINS = ["polkadot", "hydrationSubstrate", "bifrostSubstrate", "uniqueSubstrate", "paseo", "paseoAssethub"];
      const isSubstrate = SUBSTRATE_CHAINS.includes(chain);

      if (isSubstrate) {
        // Load Substrate balances
        const balances = await walletApi.getSubstrateBalances(userId, false);
        const chainBalance = balances[chain];
        
        if (chainBalance && chainBalance.address) {
          // Create a single token entry for native Substrate token
          const tokenList: TokenBalance[] = [{
            address: null, // Native token
            symbol: chainBalance.token,
            balance: chainBalance.balance,
            decimals: chainBalance.decimals,
          }];
          setTokens(tokenList);
          setSelectedToken(tokenList[0]);
        } else {
          setTokens([]);
          setError("No address found for this Substrate chain");
        }
      } else {
        // Load aggregated assets once and filter for the selected chain
        const allAssets: AnyChainAsset[] = await walletApi.getAssetsAny(userId);
        const zChain = mapToZerionChain(chain);
        const filtered = allAssets.filter(a => a.chain === zChain);
        // Transform to TokenBalance shape with actual decimals from Zerion
        const tokenList: TokenBalance[] = filtered.map(a => ({
          address: a.address,
          symbol: a.symbol,
          balance: a.balance, // smallest units (wei, satoshi, etc.)
          decimals: a.decimals, // actual token decimals (6 for USDC, 18 for ETH, etc.)
        }));

        // Keep native first, then others; native has address === null
        tokenList.sort((a, b) => (a.address === null ? -1 : b.address === null ? 1 : 0));

        setTokens(tokenList);
        if (tokenList.length > 0) {
          // Select first token (native token) by default
          const firstToken = tokenList[0];
          if (firstToken) {
            setSelectedToken(firstToken);
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof ApiError 
        ? err.message 
        : "Failed to load tokens. Please try again.";
      setError(errorMessage);
    } finally {
      setLoadingTokens(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: { amount?: string; address?: string } = {};

    // Validate amount
    if (!amount || amount.trim().length === 0) {
      errors.amount = "Amount is required";
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        errors.amount = "Amount must be a positive number";
      } else if (selectedToken) {
        // Convert balance from smallest units using actual token decimals
        const available = parseFloat(selectedToken.balance) / Math.pow(10, selectedToken.decimals);
        if (amountNum > available) {
          errors.amount = `Insufficient balance. Available: ${formatBalance(selectedToken.balance, selectedToken.decimals)} ${selectedToken.symbol}`;
        }
      }
    }

    // Validate recipient address
    const addressError = validateAddress(recipientAddress, chain);
    if (addressError) {
      errors.address = addressError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Convert balance from smallest units to human-readable using actual token decimals
  const formatBalance = (balance: string, decimals: number): string => {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0";
    return (num / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, "");
  };

  const handleSend = async () => {
    if (!validateForm() || !selectedToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if this is a Substrate chain
      const SUBSTRATE_CHAINS = ["polkadot", "hydrationSubstrate", "bifrostSubstrate", "uniqueSubstrate", "paseo", "paseoAssethub"];
      const isSubstrate = SUBSTRATE_CHAINS.includes(chain);

      let result: { txHash: string };

      if (isSubstrate) {
        // Convert human-readable amount to smallest units for Substrate
        const amountInSmallestUnits = (parseFloat(amount) * Math.pow(10, selectedToken.decimals)).toString();
        
        // Use Substrate send endpoint
        const substrateResult = await walletApi.sendSubstrateTransfer({
          userId,
          chain,
          to: recipientAddress.trim(),
          amount: amountInSmallestUnits, // Amount in smallest units
          useTestnet: false, // TODO: Add testnet toggle if needed
          transferMethod: 'transferAllowDeath', // Default transfer method
        });

        result = { txHash: substrateResult.txHash };
      } else {
        // Use regular EVM/other chain send endpoint
        result = await walletApi.sendCrypto({
          userId,
          chain,
          tokenAddress: selectedToken.address || undefined,
          tokenDecimals: selectedToken.decimals,
          amount: amount, // human-readable amount; server converts using ERC-20 decimals / Zerion
          recipientAddress: recipientAddress.trim(),
        });
      }

      setTxHash(result.txHash);
      setSuccess(true);

      // Call onSuccess callback after a short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        // Close modal after 3 seconds
        setTimeout(() => {
          onOpenChange(false);
        }, 3000);
      }, 1000);
    } catch (err) {
      let errorMessage = "Failed to send transaction. Please try again.";
      
      if (err instanceof ApiError) {
        errorMessage = err.message;
        
        // Parse specific error codes
        if (err.status === 422) {
          // Insufficient balance
          if (err.message.includes("balance")) {
            setFieldErrors({ amount: err.message });
            errorMessage = "";
          } else {
            errorMessage = err.message;
          }
        } else if (err.status === 400) {
          // Invalid input
          if (err.message.includes("address")) {
            setFieldErrors({ address: err.message });
            errorMessage = "";
          } else if (err.message.includes("amount")) {
            setFieldErrors({ amount: err.message });
            errorMessage = "";
          } else {
            errorMessage = err.message;
          }
        } else if (err.status === 503 || err.status === 408) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }

      if (errorMessage) {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const chainName = CHAIN_NAMES[chain] || chain;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send {chainName}</DialogTitle>
          <DialogDescription>
            Send crypto to a recipient address on {chainName} network
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Token Selection */}
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            {loadingTokens ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tokens...
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-sm text-destructive">No tokens available</div>
            ) : (
              <Select
                value={selectedToken?.address || "native"}
                onValueChange={(value) => {
                  const token = tokens.find(t => (t.address || "native") === value);
                  setSelectedToken(token ?? null);
                }}
              >
                <SelectTrigger id="token">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map((token) => (
                    <SelectItem key={token.address || "native"} value={token.address || "native"}>
                      {token.symbol} - {formatBalance(token.balance, token.decimals)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (fieldErrors.amount) {
                  setFieldErrors({ ...fieldErrors, amount: undefined });
                }
              }}
              disabled={loading || !selectedToken}
            />
            {fieldErrors.amount && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fieldErrors.amount}
              </p>
            )}
            {selectedToken && !fieldErrors.amount && (
              <p className="text-xs text-muted-foreground">
                Available: {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
              </p>
            )}
          </div>

          {/* Recipient Address Input */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="Enter recipient address"
              value={recipientAddress}
              onChange={(e) => {
                setRecipientAddress(e.target.value);
                if (fieldErrors.address) {
                  setFieldErrors({ ...fieldErrors, address: undefined });
                }
              }}
              disabled={loading}
            />
            {fieldErrors.address && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {fieldErrors.address}
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            </div>
          )}

          {/* Success Display */}
          {success && txHash && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3">
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                Transaction sent successfully!
              </p>
              <a
                href={getExplorerUrl(txHash, chain)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View on explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {success ? "Close" : "Cancel"}
          </Button>
          {!success && (
            <Button onClick={handleSend} disabled={loading || loadingTokens || !selectedToken}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
