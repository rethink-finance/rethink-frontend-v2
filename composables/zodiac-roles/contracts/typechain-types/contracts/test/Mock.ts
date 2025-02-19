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
} from "../../common";

export interface MockInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "DEFAULT_FALLBACK_VALUE"
      | "MOCKS_LIST_END"
      | "MOCKS_LIST_END_HASH"
      | "MOCKS_LIST_START"
      | "SENTINEL_ANY_MOCKS"
      | "exec"
      | "givenAnyReturn"
      | "givenAnyReturnAddress"
      | "givenAnyReturnBool"
      | "givenAnyReturnUint"
      | "givenAnyRevert"
      | "givenAnyRevertWithMessage"
      | "givenAnyRunOutOfGas"
      | "givenCalldataReturn"
      | "givenCalldataReturnAddress"
      | "givenCalldataReturnBool"
      | "givenCalldataReturnUint"
      | "givenCalldataRevert"
      | "givenCalldataRevertWithMessage"
      | "givenCalldataRunOutOfGas"
      | "givenMethodReturn"
      | "givenMethodReturnAddress"
      | "givenMethodReturnBool"
      | "givenMethodReturnUint"
      | "givenMethodRevert"
      | "givenMethodRevertWithMessage"
      | "givenMethodRunOutOfGas"
      | "invocationCount"
      | "invocationCountForCalldata"
      | "invocationCountForMethod"
      | "reset"
      | "updateInvocationCount"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "DEFAULT_FALLBACK_VALUE",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "MOCKS_LIST_END",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "MOCKS_LIST_END_HASH",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "MOCKS_LIST_START",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "SENTINEL_ANY_MOCKS",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "exec",
    values: [AddressLike, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyReturn",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyReturnAddress",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyReturnBool",
    values: [boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyReturnUint",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyRevert",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyRevertWithMessage",
    values: [string]
  ): string;
  encodeFunctionData(
    functionFragment: "givenAnyRunOutOfGas",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataReturn",
    values: [BytesLike, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataReturnAddress",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataReturnBool",
    values: [BytesLike, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataReturnUint",
    values: [BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataRevert",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataRevertWithMessage",
    values: [BytesLike, string]
  ): string;
  encodeFunctionData(
    functionFragment: "givenCalldataRunOutOfGas",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodReturn",
    values: [BytesLike, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodReturnAddress",
    values: [BytesLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodReturnBool",
    values: [BytesLike, boolean]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodReturnUint",
    values: [BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodRevert",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodRevertWithMessage",
    values: [BytesLike, string]
  ): string;
  encodeFunctionData(
    functionFragment: "givenMethodRunOutOfGas",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "invocationCount",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "invocationCountForCalldata",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "invocationCountForMethod",
    values: [BytesLike]
  ): string;
  encodeFunctionData(functionFragment: "reset", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "updateInvocationCount",
    values: [BytesLike, BytesLike]
  ): string;

  decodeFunctionResult(
    functionFragment: "DEFAULT_FALLBACK_VALUE",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "MOCKS_LIST_END",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "MOCKS_LIST_END_HASH",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "MOCKS_LIST_START",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "SENTINEL_ANY_MOCKS",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "exec", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyReturn",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyReturnAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyReturnBool",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyReturnUint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyRevert",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyRevertWithMessage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenAnyRunOutOfGas",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataReturn",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataReturnAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataReturnBool",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataReturnUint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataRevert",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataRevertWithMessage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenCalldataRunOutOfGas",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodReturn",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodReturnAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodReturnBool",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodReturnUint",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodRevert",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodRevertWithMessage",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "givenMethodRunOutOfGas",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "invocationCount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "invocationCountForCalldata",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "invocationCountForMethod",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "reset", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "updateInvocationCount",
    data: BytesLike
  ): Result;
}

export interface Mock extends BaseContract {
  connect(runner?: ContractRunner | null): Mock;
  attach(target: string | Addressable): Mock;
  waitForDeployment(): Promise<this>;

  interface: MockInterface;

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

  DEFAULT_FALLBACK_VALUE: TypedContractMethod<[], [string], "view">;

  MOCKS_LIST_END: TypedContractMethod<[], [string], "view">;

  MOCKS_LIST_END_HASH: TypedContractMethod<[], [string], "view">;

  MOCKS_LIST_START: TypedContractMethod<[], [string], "view">;

  SENTINEL_ANY_MOCKS: TypedContractMethod<[], [string], "view">;

  exec: TypedContractMethod<
    [to: AddressLike, value: BigNumberish, data: BytesLike],
    [void],
    "nonpayable"
  >;

  givenAnyReturn: TypedContractMethod<
    [response: BytesLike],
    [void],
    "nonpayable"
  >;

  givenAnyReturnAddress: TypedContractMethod<
    [response: AddressLike],
    [void],
    "nonpayable"
  >;

  givenAnyReturnBool: TypedContractMethod<
    [response: boolean],
    [void],
    "nonpayable"
  >;

  givenAnyReturnUint: TypedContractMethod<
    [response: BigNumberish],
    [void],
    "nonpayable"
  >;

  givenAnyRevert: TypedContractMethod<[], [void], "nonpayable">;

  givenAnyRevertWithMessage: TypedContractMethod<
    [message: string],
    [void],
    "nonpayable"
  >;

  givenAnyRunOutOfGas: TypedContractMethod<[], [void], "nonpayable">;

  givenCalldataReturn: TypedContractMethod<
    [call: BytesLike, response: BytesLike],
    [void],
    "nonpayable"
  >;

  givenCalldataReturnAddress: TypedContractMethod<
    [call: BytesLike, response: AddressLike],
    [void],
    "nonpayable"
  >;

  givenCalldataReturnBool: TypedContractMethod<
    [call: BytesLike, response: boolean],
    [void],
    "nonpayable"
  >;

  givenCalldataReturnUint: TypedContractMethod<
    [call: BytesLike, response: BigNumberish],
    [void],
    "nonpayable"
  >;

  givenCalldataRevert: TypedContractMethod<
    [call: BytesLike],
    [void],
    "nonpayable"
  >;

  givenCalldataRevertWithMessage: TypedContractMethod<
    [call: BytesLike, message: string],
    [void],
    "nonpayable"
  >;

  givenCalldataRunOutOfGas: TypedContractMethod<
    [call: BytesLike],
    [void],
    "nonpayable"
  >;

  givenMethodReturn: TypedContractMethod<
    [call: BytesLike, response: BytesLike],
    [void],
    "nonpayable"
  >;

  givenMethodReturnAddress: TypedContractMethod<
    [call: BytesLike, response: AddressLike],
    [void],
    "nonpayable"
  >;

  givenMethodReturnBool: TypedContractMethod<
    [call: BytesLike, response: boolean],
    [void],
    "nonpayable"
  >;

  givenMethodReturnUint: TypedContractMethod<
    [call: BytesLike, response: BigNumberish],
    [void],
    "nonpayable"
  >;

  givenMethodRevert: TypedContractMethod<
    [call: BytesLike],
    [void],
    "nonpayable"
  >;

  givenMethodRevertWithMessage: TypedContractMethod<
    [call: BytesLike, message: string],
    [void],
    "nonpayable"
  >;

  givenMethodRunOutOfGas: TypedContractMethod<
    [call: BytesLike],
    [void],
    "nonpayable"
  >;

  invocationCount: TypedContractMethod<[], [bigint], "nonpayable">;

  invocationCountForCalldata: TypedContractMethod<
    [call: BytesLike],
    [bigint],
    "nonpayable"
  >;

  invocationCountForMethod: TypedContractMethod<
    [call: BytesLike],
    [bigint],
    "nonpayable"
  >;

  reset: TypedContractMethod<[], [void], "nonpayable">;

  updateInvocationCount: TypedContractMethod<
    [methodId: BytesLike, originalMsgData: BytesLike],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "DEFAULT_FALLBACK_VALUE"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "MOCKS_LIST_END"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "MOCKS_LIST_END_HASH"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "MOCKS_LIST_START"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "SENTINEL_ANY_MOCKS"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "exec"
  ): TypedContractMethod<
    [to: AddressLike, value: BigNumberish, data: BytesLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenAnyReturn"
  ): TypedContractMethod<[response: BytesLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyReturnAddress"
  ): TypedContractMethod<[response: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyReturnBool"
  ): TypedContractMethod<[response: boolean], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyReturnUint"
  ): TypedContractMethod<[response: BigNumberish], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyRevert"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyRevertWithMessage"
  ): TypedContractMethod<[message: string], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenAnyRunOutOfGas"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenCalldataReturn"
  ): TypedContractMethod<
    [call: BytesLike, response: BytesLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenCalldataReturnAddress"
  ): TypedContractMethod<
    [call: BytesLike, response: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenCalldataReturnBool"
  ): TypedContractMethod<
    [call: BytesLike, response: boolean],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenCalldataReturnUint"
  ): TypedContractMethod<
    [call: BytesLike, response: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenCalldataRevert"
  ): TypedContractMethod<[call: BytesLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenCalldataRevertWithMessage"
  ): TypedContractMethod<
    [call: BytesLike, message: string],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenCalldataRunOutOfGas"
  ): TypedContractMethod<[call: BytesLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenMethodReturn"
  ): TypedContractMethod<
    [call: BytesLike, response: BytesLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenMethodReturnAddress"
  ): TypedContractMethod<
    [call: BytesLike, response: AddressLike],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenMethodReturnBool"
  ): TypedContractMethod<
    [call: BytesLike, response: boolean],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenMethodReturnUint"
  ): TypedContractMethod<
    [call: BytesLike, response: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenMethodRevert"
  ): TypedContractMethod<[call: BytesLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "givenMethodRevertWithMessage"
  ): TypedContractMethod<
    [call: BytesLike, message: string],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "givenMethodRunOutOfGas"
  ): TypedContractMethod<[call: BytesLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "invocationCount"
  ): TypedContractMethod<[], [bigint], "nonpayable">;
  getFunction(
    nameOrSignature: "invocationCountForCalldata"
  ): TypedContractMethod<[call: BytesLike], [bigint], "nonpayable">;
  getFunction(
    nameOrSignature: "invocationCountForMethod"
  ): TypedContractMethod<[call: BytesLike], [bigint], "nonpayable">;
  getFunction(
    nameOrSignature: "reset"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "updateInvocationCount"
  ): TypedContractMethod<
    [methodId: BytesLike, originalMsgData: BytesLike],
    [void],
    "nonpayable"
  >;

  filters: {};
}
