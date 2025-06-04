/**
 * Generate NAV permissions to allow manager to keep
 * updating NAV based on these methods
 * @param fundAddress
 * @param navExecutorAddress
 */
export const generateNAVPermission = (
  fundAddress: string,
  navExecutorAddress: string,
) => {
  // Default NAV entry permission
  const navEntryPermission: Record<string, any> = {
    value: [
      {
        isArray: false,
        data: "1",
        internalType: "uint16",
        name: "role",
      },
      {
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
      {
        isArray: false,
        data: null,
        internalType: "bytes4",
        name: "functionSig",
      },
      {
        isArray: true,
        data: [],
        internalType: "bool[]",
        name: "isParamScoped",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum ParameterType[]",
        name: "paramType",
      },
      {
        isArray: true,
        data: [],
        internalType: "enum Comparison[]",
        name: "paramComp",
      },
      {
        isArray: true,
        data: [],
        internalType: "bytes[]",
        name: "compValue",
      },
      {
        isArray: false,
        data: "1",
        internalType: "enum ExecutionOptions",
        name: "options",
      },
    ],
    valueMethodIdx: 19,
  };

  const recalculateNavEntryPermission: Record<string, any> = {
    value: [
      {
        idx: 0,
        isArray: false,
        // TODO: ASSUMES ROLE ID OF 1, BUT COULD BE ANY OTHER ID, NEED A WAY TO POPULATE IT SMARTLY
        data: "1",
        internalType: "uint16",
        name: "role",
      },
      {
        idx: 1,
        isArray: false,
        data: null,
        internalType: "address",
        name: "targetAddress",
      },
    ],
    valueMethodIdx: 24,
  };

  // Target address is admin contract
  navEntryPermission.value[1].data = fundAddress;
  // again, need to set target addr for scope target
  recalculateNavEntryPermission.value[1].data = fundAddress;

  // functionSig
  // TODO add comment, what functionSig is this one? 0xa61f5814
  navEntryPermission.value[2].data = "0xa61f5814";
  const navWords = ["0x000000000000000000000000" + navExecutorAddress.slice(2)];
  const navIsScoped = [true];
  const navTypeNComp = ["0"];

  // isParamScoped
  navEntryPermission.value[3].data = navIsScoped;
  // paramType
  navEntryPermission.value[4].data = navTypeNComp;
  // paramComp
  navEntryPermission.value[5].data = navTypeNComp;
  // compValue
  navEntryPermission.value[6].data = navWords;

  return [navEntryPermission, recalculateNavEntryPermission];
};

export const getMethodsPastNAVUpdateIndex = (
  methods: Record<string, any>[],
) => {
  return (
    methods.find((method) => "pastNAVUpdateIndex" in method)
      ?.pastNAVUpdateIndex ?? 0
  );
};
