import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { estaAutenticado, senhaAtiva } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await estaAutenticado())) redirect("/entrar");
  return (
    <div className="min-h-dvh">
      <Nav senhaAtiva={senhaAtiva()} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
