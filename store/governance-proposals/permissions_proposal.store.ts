import { defineStore } from "pinia";
import type { IRawTrx } from "~/types/zodiac-roles/role";
import { rolesInterface } from "~/store/role/role.store";
import { roleModFunctionNameIndexMap, roleModFunctions } from "~/types/enums/delegated_permission";

interface IState {
  rawTransactions: IRawTrx[];
}

export const usePermissionsProposalStore = defineStore({
  id: "permissionsProposalStore",
  state: (): IState => ({
    rawTransactions: [],
  }),
  getters: {
    rawTransactionsEncoded(): string[] {
      return this.rawTransactions.map(
        trx => rolesInterface.encodeFunctionData(trx.funcName as any, trx.args as any),
      );
    },
    rawTransactionsJson(): string {
      // Export data in the form to be imported as RAW JSON.
      const rawTransactionsJson: any[] = [];
      this.rawTransactions.forEach((rawTrx, index) => {
        const func = rolesInterface.getFunction(rawTrx.funcName as any);
        const methodIdx = roleModFunctionNameIndexMap[func.name];
        rawTransactionsJson.push(
          {
            idx: index,
            valueMethodIdx: methodIdx,
            value: rawTrx.args.map((arg, argIdx) => {
              const input = func.inputs[argIdx];
              return {
                idx: argIdx,
                isArray: input.baseType === "array",
                data: arg,
                // NOTE: this could be done cleaner, if we would only use type instead of internalType.
                internalType: roleModFunctions[methodIdx].inputs[argIdx].internalType,
                name: input.name,
              }
            }),
          },
        )
      })

      return JSON.stringify(rawTransactionsJson, null, 2);
    },
  },
  actions: {
  },
});
