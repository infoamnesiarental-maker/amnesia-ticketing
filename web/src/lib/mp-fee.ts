/** Cargo que absorbe el comprador al pagar con Mercado Pago (cobro instantáneo). */
export const MP_INSTANT_FEE_RATE = 0.08;

export const MP_INSTANT_FEE_LABEL = "Cargo Mercado Pago (8%)";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MpInstantFeeBreakdown {
  baseArs: number;
  feeArs: number;
  chargeArs: number;
}

/** 8% sobre el total de entradas: charge = base + fee. */
export function applyMpInstantFee(baseArs: number): MpInstantFeeBreakdown {
  const base = roundMoney(baseArs);
  const feeArs = roundMoney(base * MP_INSTANT_FEE_RATE);
  const chargeArs = roundMoney(base + feeArs);
  return { baseArs: base, feeArs, chargeArs };
}
