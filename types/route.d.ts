export default interface IRoute {
  to: string;
  title: string;
  text: string;
  exactMatch: boolean;
  matchPrefix?: string;
  disabled?: boolean;
  /** Short mono tag rendered next to the title, e.g. "SOON". */
  badge?: string;
  isExternal?: boolean;
  icon?: string;
  color?: string;
  isHidden?: boolean;
}
