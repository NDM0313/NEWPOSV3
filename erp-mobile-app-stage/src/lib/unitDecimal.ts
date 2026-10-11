/** True when the product's unit has allow_decimal enabled in inventory settings. */
export function unitAllowsDecimal(flag?: boolean | null): boolean {
  return flag === true;
}
