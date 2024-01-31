export default interface INAVUpdate {
  date: string;
  value: string;
  details: {
      nav_liquid: string;
      nav_illiquid: string;
  };
}
