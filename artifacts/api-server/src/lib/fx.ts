import { db, fxRatesTable } from "@workspace/db";
import { eq, and, lte, desc } from "drizzle-orm";

export const BASE_CURRENCY = "CAD";

export async function convertToBase(
  amount: number,
  fromCurrency: string,
  date: string,
): Promise<number | null> {
  if (!fromCurrency || fromCurrency === BASE_CURRENCY) return amount;

  const rows = await db
    .select()
    .from(fxRatesTable)
    .where(
      and(
        eq(fxRatesTable.fromCurrency, fromCurrency),
        eq(fxRatesTable.toCurrency, BASE_CURRENCY),
        lte(fxRatesTable.effectiveDate, date),
      ),
    )
    .orderBy(desc(fxRatesTable.effectiveDate))
    .limit(1);

  if (rows.length === 0) {
    console.warn(`[FX] No rate found for ${fromCurrency}→${BASE_CURRENCY} on ${date}`);
    return null;
  }

  return amount * parseFloat(rows[0].rate);
}

export async function getAllRates(): Promise<typeof fxRatesTable.$inferSelect[]> {
  return db.select().from(fxRatesTable).orderBy(fxRatesTable.fromCurrency, fxRatesTable.effectiveDate);
}
