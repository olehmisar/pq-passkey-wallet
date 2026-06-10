import type { Address, Hex } from "viem";
import type { AppPublicClient } from "../../utils";
import { BaseError, bytesToHex, encodeFunctionData } from "viem";
import {
  entryPoint09Abi,
  getUserOperationHash,
  toSmartAccount,
  type SmartAccount,
  type SmartAccountImplementation,
  type UserOperation,
} from "viem/account-abstraction";
import type { UnionPartialBy } from "viem";
import { decodeFunctionData } from "viem/utils";
import { getBytecode, readContract } from "viem/actions";
import type { AaDeploymentConfig } from "../../config/aa";
import { ML_DSA_SIGNATURE_BYTES } from "../../config/aa";
import { pqSimpleAccountAbi, pqSimpleAccountFactoryAbi } from "../../contracts/abis";

export type PqSigner = {
  signUserOperationHash(userOpHash: Hex): Promise<Hex>;
};

export type ToPqSimpleSmartAccountParameters = {
  client: AppPublicClient;
  deployment: Pick<
    AaDeploymentConfig,
    "entryPointAddress" | "entryPointVersion" | "pqAccountFactoryAddress" | "accountSalt"
  >;
  pkPointer: Address;
  signer: PqSigner;
  address?: Address;
};

type PqCall = {
  to: Address;
  value?: bigint;
  data?: Hex;
};

export type PqSimpleSmartAccountImplementation = SmartAccountImplementation<
  typeof entryPoint09Abi,
  "0.9",
  {
    abi: typeof pqSimpleAccountAbi;
    factory: { abi: typeof pqSimpleAccountFactoryAbi; address: Address };
    pkPointer: Address;
    signer: PqSigner;
  }
>;

export type PqSimpleSmartAccount = SmartAccount<PqSimpleSmartAccountImplementation>;

/**
 * ERC-4337 smart account using eth-infinitism SimpleAccountFactory layout + ML-DSA validation.
 * @see https://viem.sh/account-abstraction/accounts/smart/toSmartAccount
 */
export async function toPqSimpleSmartAccount(
  parameters: ToPqSimpleSmartAccountParameters,
): Promise<PqSimpleSmartAccount> {
  const { client, pkPointer, signer, address } = parameters;
  const factoryAddress = parameters.deployment.pqAccountFactoryAddress;
  if (!factoryAddress) {
    throw new BaseError(
      "pqAccountFactoryAddress is required — deploy PqSimpleAccountFactory or set VITE_PQ_ACCOUNT_FACTORY",
    );
  }

  const entryPoint = {
    abi: entryPoint09Abi,
    address: parameters.deployment.entryPointAddress,
    version: parameters.deployment.entryPointVersion,
  } as const;

  const salt = parameters.deployment.accountSalt ?? 0n;
  const factory = {
    abi: pqSimpleAccountFactoryAbi,
    address: factoryAddress,
  } as const;

  async function resolveAddress(): Promise<Address> {
    if (address) return address;
    return readContract(client, {
      ...factory,
      functionName: "getAddress",
      args: [pkPointer, salt],
    });
  }

  const implementation = {
    client,
    entryPoint,
    extend: { abi: pqSimpleAccountAbi, factory, pkPointer, signer },

    async decodeCalls(data: Hex) {
      const result = decodeFunctionData({ abi: pqSimpleAccountAbi, data });
      if (result.functionName === "execute") {
        return [{ to: result.args[0], value: result.args[1], data: result.args[2] }];
      }
      if (result.functionName === "executeBatch") {
        return result.args[0].map((arg: { target: Address; value: bigint; data: Hex }) => ({
          to: arg.target,
          value: arg.value,
          data: arg.data,
        }));
      }
      throw new BaseError(`unable to decode calls for "${result.functionName}"`);
    },

    async encodeCalls(calls: readonly PqCall[]) {
      if (calls.length === 1) {
        return encodeFunctionData({
          abi: pqSimpleAccountAbi,
          functionName: "execute",
          args: [calls[0].to, calls[0].value ?? 0n, calls[0].data ?? "0x"],
        });
      }
      return encodeFunctionData({
        abi: pqSimpleAccountAbi,
        functionName: "executeBatch",
        args: [
          calls.map((call) => ({
            target: call.to,
            value: call.value ?? 0n,
            data: call.data ?? "0x",
          })),
        ],
      });
    },

    async getAddress() {
      return resolveAddress();
    },

    async getFactoryArgs() {
      const addr = await resolveAddress();
      const code = await getBytecode(client, { address: addr });
      if (code && code !== "0x") return undefined;

      const factoryData = encodeFunctionData({
        abi: factory.abi,
        functionName: "createAccount",
        args: [pkPointer, salt],
      });
      return { factory: factory.address, factoryData };
    },

    async getStubSignature() {
      return bytesToHex(new Uint8Array(ML_DSA_SIGNATURE_BYTES));
    },

    async signUserOperation(
      parameters: UnionPartialBy<UserOperation, "sender"> & { chainId?: number },
    ) {
      const { chainId = client.chain!.id, ...userOperation } = parameters;
      const sender = await resolveAddress();
      const userOpHash = getUserOperationHash({
        chainId,
        entryPointAddress: entryPoint.address,
        entryPointVersion: entryPoint.version,
        userOperation: {
          ...userOperation,
          sender,
        },
      });
      return signer.signUserOperationHash(userOpHash);
    },
  };

  // viem SmartAccountImplementation generics are wider than our PQ account surface.
  return (await toSmartAccount(
    implementation as unknown as SmartAccountImplementation,
  )) as PqSimpleSmartAccount;
}
