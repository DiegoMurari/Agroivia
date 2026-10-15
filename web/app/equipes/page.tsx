import { CalendarioDeEquipes } from "@/components/equipes/CalendarioDeEquipes";
import { EscalaDeEquipes } from "@/components/equipes/EscalaDeEquipes";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { getDb } from "@/lib/db";
import { armazensDoBoletim } from "@/lib/boletim/servico";
import { schema } from "@/lib/db";
import { lerEscala, resumoDoMes, sugestoesDeChapas, ultimaEscalaAntes } from "@/lib/equipes/servico";
import { diasDaSemana } from "@/lib/equipes/semana";
import { hojeISO } from "@/lib/relogio";

export default async function Page({ searchParams }: { searchParams: Promise<{ data?: string; mes?: string }> }) {
  const { data, mes: pedido } = await searchParams;
  const db = getDb();
  const hoje = hojeISO();
  // O mês manda: o dia vem do clique no calendário; sem clique, hoje (no mês atual) ou o dia 1
  const mes = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data.slice(0, 7) : pedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) ? pedido : hoje.slice(0, 7);
  const dia = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : mes === hoje.slice(0, 7) ? hoje : `${mes}-01`;
  const armazens = armazensDoBoletim(db).map((a) => ({ id: a.id, nome: a.nome }));
  // Os horários da folha semanal são os da grade de descargas
  const horarios = db.select().from(schema.horarioGrade).all().sort((a, b) => a.ordem - b.ordem).map((h) => h.hora);
  const semana = diasDaSemana(dia).map((d) => ({ data: d, equipes: lerEscala(db, d) }));
  return (
    <PageWrapper title="Escala de equipes" size="wide" className="print:max-w-none print:p-0 print:animate-none" description="Monte as equipes do dia, escreva o nome de cada funcionário e imprima para a parede.">
      <div className="grid items-start gap-5 lg:grid-cols-2 print:block">
        <div className="print:hidden">
          <CalendarioDeEquipes mes={mes} selecionado={dia} hoje={hoje} resumo={resumoDoMes(db, mes)} />
        </div>
          <EscalaDeEquipes
            key={dia}
            data={dia}
            equipes={lerEscala(db, dia)}
            sugestoes={sugestoesDeChapas(db).map((s) => s.nome)}
            ultimaEscala={ultimaEscalaAntes(db, dia)}
            armazens={armazens}
            semana={semana}
            horarios={horarios}
            hoje={hoje}
          />
      </div>
    </PageWrapper>
  );
}
