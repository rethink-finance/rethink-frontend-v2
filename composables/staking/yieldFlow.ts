/**
 * Geometry for the yield flow diagram: one deposit node on the left, a node
 * per venue in the middle, a position node per venue on the right. Heights
 * are in px; x is left to the component. Pure, so it can be tested.
 */

export interface FlowBand {
  /** Top and bottom of this venue's slice of the deposit node. */
  from: [number, number];
  /** Top and bottom of the venue node (and its position node). */
  to: [number, number];
}

/**
 * Stacks the venues down the deposit node by weight, and spreads their own
 * nodes over the same height with `gap` between them, so each ribbon fans
 * out from a slice of the deposit into its own node.
 */
export const yieldFlowBands = (weights: number[], height: number, gap: number): FlowBand[] => {
  const total = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (!weights.length || total <= 0) return [];
  const usable = Math.max(height - gap * (weights.length - 1), 0);
  let from = 0;
  let to = 0;
  return weights.map((weight) => {
    const share = Math.max(weight, 0) / total;
    const band: FlowBand = {
      from: [from, from + share * height],
      to: [to, to + share * usable],
    };
    from += share * height;
    to += share * usable + gap;
    return band;
  });
};

/**
 * A filled ribbon from x0 to x1: its top edge runs from y0[0] to y1[0] and
 * its bottom edge from y0[1] to y1[1], with horizontal tangents at both ends.
 */
export const ribbonPath = (
  x0: number,
  x1: number,
  y0: [number, number],
  y1: [number, number],
) => {
  const xm = (x0 + x1) / 2;
  const f = (n: number) => n.toFixed(2);
  return [
    `M${f(x0)},${f(y0[0])}`,
    `C${f(xm)},${f(y0[0])} ${f(xm)},${f(y1[0])} ${f(x1)},${f(y1[0])}`,
    `L${f(x1)},${f(y1[1])}`,
    `C${f(xm)},${f(y1[1])} ${f(xm)},${f(y0[1])} ${f(x0)},${f(y0[1])}`,
    "Z",
  ].join(" ");
};
