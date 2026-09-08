import { z } from "zod";
export const sourceSchema = z.object({
  kind: z.enum(["pdf", "youtube"]),
  sourceName: z.string().min(1).max(255),
  text: z.string().min(1).max(60000),
  characters: z.number().nonnegative(),
});
