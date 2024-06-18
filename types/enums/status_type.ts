import type { IPositionType } from "~/types/position_type";

export enum StatusType {
  Defeated = "defeated",
  Active = "active",
  Executed = "executed",
  ToExecute = "to_execute",
  Canceled = "canceled",

  Permission = "permission",
  NAV = "nav",
  DirectExecution = "direct_execution",
}
export const StatusTypesMap: Record<string, IPositionType> = {
  [StatusType.Defeated]: {
    name: "Defeated",
    key: StatusType.Defeated,
  },
  [StatusType.Active]: {
    name: "Active",
    key: StatusType.Active,
  },
  [StatusType.Executed]: {
    name: "Executed",
    key: StatusType.Executed,
  },
  [StatusType.ToExecute]: {
    name: "To Execute",
    key: StatusType.ToExecute,
  },
  [StatusType.Canceled]: {
    name: "Canceled",
    key: StatusType.Canceled,
  },
  [StatusType.Permission]: {
    name: "Permission",
    key: StatusType.Permission,
  },
  [StatusType.NAV]: {
    name: "NAV",
    key: StatusType.NAV,
  },
  [StatusType.DirectExecution]: {
    name: "Direct Execution",
    key: StatusType.DirectExecution,
  },
};

export const StatusTypes = Object.entries(StatusTypesMap);
export const StatusTypeKeys = Object.values(StatusType);
