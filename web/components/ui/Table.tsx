import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabela com rolagem horizontal no mobile. Números: `className="text-right tabular-nums"`.
 *
 * <Table>
 *   <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
 *   <TableBody><TableRow><TableCell>Fertilizantes</TableCell><TableCell className="text-right tabular-nums">918,20</TableCell></TableRow></TableBody>
 * </Table>
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="w-full overflow-x-auto rounded-xl border bg-card shadow-card">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot data-slot="table-footer" className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn("h-10 px-4 text-left align-middle text-[13px] font-medium whitespace-nowrap text-muted-foreground", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("px-4 py-3 text-[13px] text-muted-foreground", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
