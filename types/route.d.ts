export default interface IRoute {
  to: string;
  title: string;
  text: string;
  exactMatch: boolean;
  matchPrefix?: string;
  disabled?: boolean;
  isExternal?: boolean;
  icon?: string;
  color?: string;
}
