/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  Addressable,
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedListener,
  TypedContractMethod,
} from "../../../../common";

export interface IAvatarInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "disableModule"
      | "enableModule"
      | "execTransactionFromModule"
      | "execTransactionFromModuleReturnData"
      | "getModulesPaginated"
      | "isModuleEnabled"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "disableModule",
    values: [AddressLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "enableModule",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "execTransactionFromModule",
    values: [AddressLike, BigNumberish, BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "execTransactionFromModuleReturnData",
    values: [AddressLike, BigNumberish, BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getModulesPaginated",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "isModuleEnabled",
    values: [AddressLike]
  ): string;

  decodeFunctionResult(
    functionFragment: "disableModule",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "enableModule",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "execTransactionFromModule",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "execTransactionFromModuleReturnData",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getModulesPaginated",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "isModuleEnabled",
    data: BytesLike
  ): Result;
}

export interface IAvatar extends BaseContract {
  connect(runner?: ContractRunner | null): IAvatar;
  attach(target: string | Addressable): IAvatar;
  waitForDeployment(): Promise<this>;

  interface: IAvatarInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  disableModule: TypedContractMethod<
    [prevModule: AddressLike, module: AddressLike],
    [void],
    "nonpayable"
  >;

  enableModule: TypedContractMethod<
    [module: AddressLike],
    [void],
    "nonpayable"
  >;

  execTransactionFromModule: TypedContractMethod<
    [
      to: AddressLike,
      value: BigNumberish,
      data: BytesLike,
      operation: BigNumberish
    ],
    [boolean],
    "nonpayable"
  >;

  execTransactionFromModuleReturnData: TypedContractMethod<
    [
      to: AddressLike,
      value: BigNumberish,
      data: BytesLike,
      operation: BigNumberish
    ],
    [[boolean, string] & { success: boolean; returnData: string }],
    "nonpayable"
  >;

  getModulesPaginated: TypedContractMethod<
    [start: AddressLike, pageSize: BigNumberish],
    [[string[], string] & { array: string[]; next: string }],
    "view"
  >;

  isModuleEnabled: TypedContractMethod<
    [module: AddressLike],
    [boolean],
    "view"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "disableModule"
  ): TypedContractMethod<
    [prevModule: AddressLike, module: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "enableModule"
  ): TypedContractMethod<[module: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "execTransactionFromModule"
  ): TypedContractMethod<
    [
      to: AddressLike,
      value: BigNumberish,
      data: BytesLike,
      operation: BigNumberish
    ],
    [boolean],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "execTransactionFromModuleReturnData"
  ): TypedContractMethod<
    [
      to: AddressLike,
      value: BigNumberish,
      data: BytesLike,
      operation: BigNumberish
    ],
    [[boolean, string] & { success: boolean; returnData: string }],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "getModulesPaginated"
  ): TypedContractMethod<
    [start: AddressLike, pageSize: BigNumberish],
    [[string[], string] & { array: string[]; next: string }],
    "view"
  >;
  getFunction(
    nameOrSignature: "isModuleEnabled"
  ): TypedContractMethod<[module: AddressLike], [boolean], "view">;

  filters: {};
}
