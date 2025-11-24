/**
 * EVM Chain ID mapping utilities for WalletConnect
 * Maps internal chain names to EVM chain IDs and vice versa
 */

export const EVM_CHAIN_IDS: Record<string, { chainId: string; name: string; isTestnet: boolean }> = {
  ethereum: { chainId: '1', name: 'Ethereum', isTestnet: false },
  base: { chainId: '8453', name: 'Base', isTestnet: false },
  arbitrum: { chainId: '42161', name: 'Arbitrum', isTestnet: false },
  polygon: { chainId: '137', name: 'Polygon', isTestnet: false },
  avalanche: { chainId: '43114', name: 'Avalanche', isTestnet: false },
  moonbeamTestnet: { chainId: '420420422', name: 'Moonbeam Testnet', isTestnet: true },
  astarShibuya: { chainId: '81', name: 'Astar Shibuya', isTestnet: true },
  paseoPassetHub: { chainId: '420420422', name: 'Paseo PassetHub', isTestnet: true },
  hydration: { chainId: '222222', name: 'Hydration', isTestnet: false },
  unique: { chainId: '8880', name: 'Unique', isTestnet: false },
  bifrost: { chainId: '3068', name: 'Bifrost', isTestnet: false },
  bifrostTestnet: { chainId: '49088', name: 'Bifrost Testnet', isTestnet: true },
};

/**
 * Get chain ID for a given chain name
 */
export function getChainIdForChain(chainName: string): string | null {
  return EVM_CHAIN_IDS[chainName]?.chainId || null;
}

/**
 * Get chain name for a given chain ID
 */
export function getChainNameForChainId(chainId: string): string | null {
  const entry = Object.entries(EVM_CHAIN_IDS).find(
    ([_, config]) => config.chainId === chainId
  );
  return entry ? entry[1].name : null;
}

/**
 * Get internal chain key for a given chain ID
 */
export function getChainKeyForChainId(chainId: string): string | null {
  const entry = Object.entries(EVM_CHAIN_IDS).find(
    ([_, config]) => config.chainId === chainId
  );
  return entry ? entry[0] : null;
}

/**
 * Check if a chain is a testnet
 */
export function isTestnetChain(chainName: string): boolean {
  return EVM_CHAIN_IDS[chainName]?.isTestnet || false;
}

/**
 * Get all mainnet chain IDs
 */
export function getMainnetChainIds(): string[] {
  return Object.entries(EVM_CHAIN_IDS)
    .filter(([_, config]) => !config.isTestnet)
    .map(([_, config]) => config.chainId);
}

/**
 * Get all testnet chain IDs
 */
export function getTestnetChainIds(): string[] {
  return Object.entries(EVM_CHAIN_IDS)
    .filter(([_, config]) => config.isTestnet)
    .map(([_, config]) => config.chainId);
}

