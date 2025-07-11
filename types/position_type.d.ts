export interface IPositionType {
  name: string,
  key: string,
}

export default interface IPositionTypeCount {
  type: IPositionType;
  count: string; // Is bigint actually, but comes as string when serialized.
}
