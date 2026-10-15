import { redirect } from "next/navigation";

/** A entrada do sistema é o Hoje. */
export default function HomePage() {
  redirect("/dia");
}
