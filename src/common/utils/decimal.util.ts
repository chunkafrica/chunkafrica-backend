import { Prisma } from '@prisma/client';

export function toDecimal(value?: number | string | Prisma.Decimal | null): Prisma.Decimal | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Prisma.Decimal(value);
}