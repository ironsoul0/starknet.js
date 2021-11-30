import axios from 'axios';

import {
  AddTransactionResponse,
  CallContractResponse,
  CallContractTransaction,
  CompiledContract,
  GetBlockResponse,
  GetCodeResponse,
  GetContractAddressesResponse,
  GetTransactionResponse,
  GetTransactionStatusResponse,
  Transaction,
} from '../types';
import { parse, stringify } from '../utils/json';
import { BigNumberish, toBN, toHex } from '../utils/number';
import { compressProgram, formatSignature, randomAddress } from '../utils/stark';
import { ProviderInterface } from './interface';

type NetworkName = 'alpha' | 'devnet';

interface ProviderOptions {
  network?: NetworkName;
}

function wait(delay: number) {
  return new Promise((res) => setTimeout(res, delay));
}

export class Provider implements ProviderInterface {
  public baseUrl: string;

  public feederGatewayUrl: string;

  public gatewayUrl: string;

  constructor(optionsOrProvider?: ProviderOptions | Provider) {
    if (optionsOrProvider instanceof Provider) {
      this.baseUrl = optionsOrProvider.baseUrl;
      this.feederGatewayUrl = optionsOrProvider.feederGatewayUrl;
      this.gatewayUrl = optionsOrProvider.gatewayUrl;
    } else {
      const { network = 'devnet' } = optionsOrProvider || {};
      const baseUrl = Provider.getNetworkFromName(network);
      this.baseUrl = baseUrl;
      this.feederGatewayUrl = `${baseUrl}/feeder_gateway`;
      this.gatewayUrl = `${baseUrl}/gateway`;
    }
  }

  protected static getNetworkFromName(name: NetworkName) {
    switch (name) {
      case 'alpha':
        return 'https://localhost:5000';
      case 'devnet':
        return 'http://localhost:5000';
      default:
        return 'http://localhost:5000';
    }
  }

  /**
   * Gets the smart contract address on the goerli testnet.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L13-L15)
   * @returns starknet smart contract addresses
   */
  public async getContractAddresses(): Promise<GetContractAddressesResponse> {
    const { data } = await axios.get<GetContractAddressesResponse>(
      `${this.feederGatewayUrl}/get_contract_addresses`
    );
    return data;
  }

  /**
   * Calls a function on the StarkNet contract.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L17-L25)
   *
   * @param invokeTx - transaction to be invoked
   * @param blockId
   * @returns the result of the function on the smart contract.
   */
  public async callContract(
    invokeTx: CallContractTransaction,
    blockId?: number
  ): Promise<CallContractResponse> {
    const { data } = await axios.post<CallContractResponse>(
      `${this.feederGatewayUrl}/call_contract?blockId=${blockId ?? 'null'}`,
      {
        signature: [],
        calldata: [],
        ...invokeTx,
      }
    );
    return data;
  }

  /**
   * Gets the block information from a block ID.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L27-L31)
   *
   * @param blockId
   * @returns the block object { block_id, previous_block_id, state_root, status, timestamp, transaction_receipts, transactions }
   */
  public async getBlock(blockId?: number): Promise<GetBlockResponse> {
    const { data } = await axios.get<GetBlockResponse>(
      `${this.feederGatewayUrl}/get_block?blockId=${blockId ?? 'null'}`
    );
    return data;
  }

  /**
   * Gets the code of the deployed contract.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L33-L36)
   *
   * @param contractAddress
   * @param blockId
   * @returns Bytecode and ABI of compiled contract
   */
  public async getCode(contractAddress: string, blockId?: number): Promise<GetCodeResponse> {
    const { data } = await axios.get<GetCodeResponse>(
      `${this.feederGatewayUrl}/get_code?contractAddress=${contractAddress}&blockId=${
        blockId ?? 'null'
      }`
    );
    return data;
  }

  // TODO: add proper type
  /**
   * Gets the contract's storage variable at a specific key.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L38-L46)
   *
   * @param contractAddress
   * @param key - from getStorageVarAddress('<STORAGE_VARIABLE_NAME>') (WIP)
   * @param blockId
   * @returns the value of the storage variable
   */
  public async getStorageAt(
    contractAddress: string,
    key: number,
    blockId?: number
  ): Promise<object> {
    const { data } = await axios.get<object>(
      `${
        this.feederGatewayUrl
      }/get_storage_at?contractAddress=${contractAddress}&key=${key}&blockId=${blockId ?? 'null'}`
    );
    return data;
  }

  /**
   * Gets the status of a transaction.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L48-L52)
   *
   * @param txHash
   * @returns the transaction status object { block_id, tx_status: NOT_RECEIVED | RECEIVED | PENDING | REJECTED | ACCEPTED_ONCHAIN }
   */
  public async getTransactionStatus(txHash: BigNumberish): Promise<GetTransactionStatusResponse> {
    const txHashBn = toBN(txHash);
    const { data } = await axios.get<GetTransactionStatusResponse>(
      `${this.feederGatewayUrl}/get_transaction_status?transactionHash=${toHex(txHashBn)}`
    );
    return data;
  }

  /**
   * Gets the transaction information from a tx id.
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/feeder_gateway/feeder_gateway_client.py#L54-L58)
   *
   * @param txHash
   * @returns the transacton object { transaction_id, status, transaction, block_id?, block_number?, transaction_index?, transaction_failure_reason? }
   */
  public async getTransaction(txHash: BigNumberish): Promise<GetTransactionResponse> {
    const txHashBn = toBN(txHash);
    const { data } = await axios.get<GetTransactionResponse>(
      `${this.feederGatewayUrl}/get_transaction?transactionHash=${toHex(txHashBn)}`
    );
    return data;
  }

  /**
   * Invoke a function on the starknet contract
   *
   * [Reference](https://github.com/starkware-libs/cairo-lang/blob/f464ec4797361b6be8989e36e02ec690e74ef285/src/starkware/starknet/services/api/gateway/gateway_client.py#L13-L17)
   *
   * @param tx - transaction to be invoked
   * @returns a confirmation of invoking a function on the starknet contract
   */
  public async addTransaction(tx: Transaction): Promise<AddTransactionResponse> {
    const signature = tx.type === 'INVOKE_FUNCTION' && formatSignature(tx.signature);
    const contract_address_salt = tx.type === 'DEPLOY' && toHex(toBN(tx.contract_address_salt));

    const { data } = await axios.post<AddTransactionResponse>(
      `${this.gatewayUrl}/add_transaction`,
      stringify({
        ...tx, // the tx can contain BigInts, so we use our own `stringify`
        ...(Array.isArray(signature) && { signature }), // not needed on deploy tx
        ...(contract_address_salt && { contract_address_salt }), // not needed on invoke tx
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    return data;
  }

  /**
   * Deploys a given compiled contract (json) to starknet
   *
   * @param contract - a json object containing the compiled contract
   * @param address - (optional, defaults to a random address) the address where the contract should be deployed (alpha)
   * @returns a confirmation of sending a transaction on the starknet contract
   */
  public deployContract(
    contract: CompiledContract | string,
    constructorCalldata: string[] = [],
    addressSalt: BigNumberish = randomAddress()
  ): Promise<AddTransactionResponse> {
    const parsedContract =
      typeof contract === 'string' ? (parse(contract) as CompiledContract) : contract;
    const contractDefinition = {
      ...parsedContract,
      program: compressProgram(parsedContract.program),
    };

    return this.addTransaction({
      type: 'DEPLOY',
      contract_address_salt: addressSalt,
      constructor_calldata: constructorCalldata,
      contract_definition: contractDefinition,
    });
  }

  /**
   * Invokes a function on starknet
   *
   * @param contractAddress - target contract address for invoke
   * @param entrypointSelector - target entrypoint selector for
   * @param calldata - (optional, default []) calldata
   * @param signature - (optional) signature to send along
   * @returns response from addTransaction
   */
  public invokeFunction(
    contractAddress: string,
    entrypointSelector: string,
    calldata?: string[],
    signature?: [BigNumberish, BigNumberish]
  ): Promise<AddTransactionResponse> {
    return this.addTransaction({
      type: 'INVOKE_FUNCTION',
      contract_address: contractAddress,
      entry_point_selector: entrypointSelector,
      calldata,
      signature,
    });
  }

  public async waitForTx(txHash: BigNumberish, retryInterval: number = 5000) {
    let onchain = false;
    let firstRun = true;
    while (!onchain) {
      // eslint-disable-next-line no-await-in-loop
      await wait(retryInterval);
      // eslint-disable-next-line no-await-in-loop
      const res = await this.getTransactionStatus(txHash);

      if (res.tx_status === 'ACCEPTED_ONCHAIN' || res.tx_status === 'PENDING') {
        onchain = true;
      } else if (res.tx_status === 'REJECTED') {
        throw Error('REJECTED');
      } else if (res.tx_status === 'NOT_RECEIVED' && !firstRun) {
        throw Error('NOT_RECEIVED');
      }
      firstRun = false;
    }
  }
}
