import { notFound } from "next/navigation";

/** Any path below a language segment that is not a page is a branded 404. */
export default function Missing() {
  notFound();
}
