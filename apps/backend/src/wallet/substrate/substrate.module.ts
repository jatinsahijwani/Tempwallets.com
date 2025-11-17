import { Module, forwardRef } from '@nestjs/common';
import { SubstrateRpcService } from './services/substrate-rpc.service.js';
import { SubstrateTransactionService } from './services/substrate-transaction.service.js';
import { MetadataCacheService } from './services/metadata-cache.service.js';
import { NonceManager } from './managers/nonce.manager.js';
import { SubstrateAccountFactory } from './factories/substrate-account.factory.js';
import { SubstrateAddressManager } from './managers/substrate-address.manager.js';
import { SubstrateTestController } from './substrate-test.controller.js';
// Import dependencies - use forwardRef to avoid circular dependency
import { WalletModule } from '../wallet.module.js';

/**
 * Substrate Module
 * 
 * Encapsulates all Substrate/Polkadot wallet functionality
 * Separate from EVM/Solana wallet logic
 */
@Module({
  imports: [forwardRef(() => WalletModule)], // Import to get SeedManager (avoid circular dependency)
  controllers: [SubstrateTestController],
  providers: [
    // Services
    SubstrateRpcService,
    SubstrateTransactionService,
    MetadataCacheService,
    // Managers
    NonceManager,
    SubstrateAddressManager,
    // Factories
    SubstrateAccountFactory,
  ],
  exports: [
    SubstrateRpcService,
    SubstrateTransactionService,
    MetadataCacheService,
    NonceManager,
    SubstrateAddressManager,
    SubstrateAccountFactory,
  ],
})
export class SubstrateModule {}

