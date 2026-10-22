import { ethers } from "ethers";

/**
 * Signing Hyperliquid exchange actions, for the two the app sends: approving
 * a short-lived agent, and switching an address between HyperEVM's block
 * sizes (see bigBlocks.ts for why the one needs the other).
 *
 * Hyperliquid signs in two styles:
 *  - "User-signed" actions (approveAgent among them) are plain EIP-712 over
 *    the action's own fields, under any chain id the wallet likes — the
 *    action names it in `signatureChainId`, and `hyperliquidChain` keeps a
 *    mainnet signature from being replayed on testnet.
 *  - "L1" actions (evmUserModify, orders, …) sign a hash of the msgpack'd
 *    action under a fixed chain id, 1337. Browser wallets refuse to sign for
 *    a chain they are not on, so from a browser only an agent key held by the
 *    page can sign these. That is how Hyperliquid's own app works, and how
 *    the big-block toggle at hyperevm-block-toggle.vercel.app works.
 *
 * Ported from Hyperliquid's Python SDK (hyperliquid/utils/signing.py:
 * action_hash, construct_phantom_agent, l1_payload, user_signed_payload).
 * The tests reproduce that SDK's own published vectors, so a byte out of
 * place here fails there rather than at the exchange.
 */

/**
 * What msgpack has to carry for an exchange action. Hyperliquid sends prices
 * and sizes as strings, so there are no floats; and nothing negative.
 */
export type MsgpackValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | MsgpackValue[]
  | { [key: string]: MsgpackValue };

const utf8 = new TextEncoder();

/**
 * msgpack, as Python's msgpack.packb writes it for the values above: the
 * smallest form of each, maps in insertion order. Insertion order matters —
 * the exchange hashes the bytes, so {"a", "b"} and {"b", "a"} are different
 * actions.
 */
export const encodeMsgpack = (value: MsgpackValue): Uint8Array => {
  const out: number[] = [];

  const pushBigEndian = (n: bigint, bytes: number) => {
    for (let i = bytes - 1; i >= 0; i--) out.push(Number((n >> BigInt(8 * i)) & 0xffn));
  };

  // fix form, then 16- and 32-bit lengths: shared by strings, arrays, maps.
  const pushLength = (
    length: number,
    fixPrefix: number,
    fixMax: number,
    prefix16: number,
    prefix32: number,
  ) => {
    if (length <= fixMax) out.push(fixPrefix | length);
    else if (length <= 0xffff) {
      out.push(prefix16);
      pushBigEndian(BigInt(length), 2);
    } else {
      out.push(prefix32);
      pushBigEndian(BigInt(length), 4);
    }
  };

  const write = (item: MsgpackValue | undefined): void => {
    if (item === undefined) {
      throw new Error("msgpack: undefined has no encoding; leave the key out instead");
    }
    if (item === null) {
      out.push(0xc0);
      return;
    }
    if (typeof item === "boolean") {
      out.push(item ? 0xc3 : 0xc2);
      return;
    }
    if (typeof item === "number" || typeof item === "bigint") {
      if (typeof item === "number" && !Number.isSafeInteger(item)) {
        throw new TypeError(`msgpack: ${item} is not a safe integer`);
      }
      const n = BigInt(item);
      if (n < 0n || n > 0xffffffffffffffffn) {
        throw new RangeError(`msgpack: ${n} is outside 0 … 2^64 - 1`);
      }
      if (n <= 0x7fn) out.push(Number(n));
      else if (n <= 0xffn) {
        out.push(0xcc);
        pushBigEndian(n, 1);
      } else if (n <= 0xffffn) {
        out.push(0xcd);
        pushBigEndian(n, 2);
      } else if (n <= 0xffffffffn) {
        out.push(0xce);
        pushBigEndian(n, 4);
      } else {
        out.push(0xcf);
        pushBigEndian(n, 8);
      }
      return;
    }
    if (typeof item === "string") {
      const bytes = utf8.encode(item);
      // str8 (0xd9) sits between fixstr and str16 for strings.
      if (bytes.length > 31 && bytes.length <= 0xff) out.push(0xd9, bytes.length);
      else pushLength(bytes.length, 0xa0, 31, 0xda, 0xdb);
      for (const byte of bytes) out.push(byte);
      return;
    }
    if (Array.isArray(item)) {
      pushLength(item.length, 0x90, 15, 0xdc, 0xdd);
      item.forEach(write);
      return;
    }
    const entries = Object.entries(item);
    pushLength(entries.length, 0x80, 15, 0xde, 0xdf);
    for (const [key, entry] of entries) {
      write(key);
      write(entry);
    }
  };

  write(value);
  return Uint8Array.from(out);
};

/**
 * The hash an L1 action is signed over: msgpack(action), the nonce as eight
 * big-endian bytes, then a zero byte for "not on behalf of a vault or
 * sub-account". (Hyperliquid's optional expiry would follow; the app sets
 * none.)
 */
export const l1ActionHash = (action: MsgpackValue, nonce: number): string =>
  ethers.keccak256(
    ethers.concat([encodeMsgpack(action), ethers.toBeHex(nonce, 8), "0x00"]),
  );

/** The fixed EIP-712 domain of every L1 action, whatever chain is in use. */
export const L1_ACTION_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 1337,
  verifyingContract: ethers.ZeroAddress,
};

/** The "phantom agent" an L1 action's hash is wrapped in for signing. */
export const L1_ACTION_TYPES = {
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
};

/** A signature the way the exchange takes it. */
export interface IHyperCoreSignature {
  r: string;
  s: string;
  v: number;
}

/** Any 65-byte signature, v as 27/28 whatever the wallet returned. */
export const splitSignature = (signature: string): IHyperCoreSignature => {
  const { r, s, v } = ethers.Signature.from(signature);
  return { r, s, v };
};

/**
 * Sign an L1 action. Only ever with a key the page holds (an agent): see the
 * module comment for why a browser wallet cannot.
 */
export const signL1Action = async (
  signer: ethers.Signer,
  action: MsgpackValue,
  nonce: number,
  isMainnet = true,
): Promise<IHyperCoreSignature> =>
  splitSignature(
    await signer.signTypedData(L1_ACTION_DOMAIN, L1_ACTION_TYPES, {
      source: isMainnet ? "a" : "b",
      connectionId: l1ActionHash(action, nonce),
    }),
  );

/** The EIP-712 domain of a user-signed action, under the wallet's own chain. */
export const userSignedDomain = (signatureChainId: number) => ({
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: signatureChainId,
  verifyingContract: ethers.ZeroAddress,
});

/** The fields of approveAgent, in the order Hyperliquid hashes them. */
export const APPROVE_AGENT_FIELDS: ethers.TypedDataField[] = [
  { name: "hyperliquidChain", type: "string" },
  { name: "agentAddress", type: "address" },
  { name: "agentName", type: "string" },
  { name: "nonce", type: "uint64" },
];

export const APPROVE_AGENT_PRIMARY_TYPE = "HyperliquidTransaction:ApproveAgent";

/**
 * The EIP-712 parts of a user-signed action: the domain, the one struct
 * type, and the message cut down to that type's fields. The action itself
 * carries more (its `type`, `signatureChainId`) that is posted but never
 * signed, and a wallet shows whatever is in the message.
 */
export const userSignedTypedData = (
  primaryType: string,
  fields: ethers.TypedDataField[],
  action: Record<string, unknown>,
  signatureChainId: number,
) => ({
  domain: userSignedDomain(signatureChainId),
  types: { [primaryType]: fields },
  primaryType,
  message: Object.fromEntries(fields.map(({ name }) => [name, action[name]])),
});

/**
 * The eth_signTypedData_v4 request for typed data built above. By hand, as
 * safeTransactionService.ts does it, so the domain's chainId goes out as a
 * number: wallets compare it with their active chain, and not all of them
 * read hex there.
 */
export const typedDataRequest = (
  typedData: ReturnType<typeof userSignedTypedData>,
) => {
  const types: Record<string, ethers.TypedDataField[]> = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    ...typedData.types,
  };
  return {
    types,
    primaryType: typedData.primaryType,
    domain: typedData.domain,
    message: typedData.message,
  };
};

export interface IApproveAgentAction {
  type: "approveAgent";
  /** The chain the wallet signed under, as hex. */
  signatureChainId: string;
  hyperliquidChain: "Mainnet";
  agentAddress: string;
  /** Names a slot of its own, beside the one Hyperliquid's app uses. */
  agentName: string;
  nonce: number;
}

/**
 * Approve `agentAddress` to act for the signing account under `agentName`.
 * Approving the zero address under the same name empties that slot again.
 */
export const approveAgentAction = (
  agentAddress: string,
  agentName: string,
  nonce: number,
  signatureChainId: number,
): IApproveAgentAction => ({
  type: "approveAgent",
  signatureChainId: ethers.toQuantity(signatureChainId),
  hyperliquidChain: "Mainnet",
  agentAddress,
  agentName,
  nonce,
});

/** Route the address's HyperEVM transactions to big blocks, or back to standard ones. */
export const evmUserModifyAction = (usingBigBlocks: boolean) => ({
  type: "evmUserModify",
  usingBigBlocks,
});
