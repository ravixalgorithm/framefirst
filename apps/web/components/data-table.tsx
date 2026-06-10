type DataTableProps = {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  empty?: string;
};

export function DataTable({ columns, rows, empty = "No rows yet." }: DataTableProps) {
  if (rows.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg border-dashed">{empty}</div>;
  }

  return (
    <table className="w-full text-sm text-left table-fixed">
      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
        <tr>
          {columns.map((column, index) => (
            <th key={column} className={`px-4 py-3 font-medium ${index === 0 ? "w-[60%]" : "w-[20%] text-right"}`}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-muted/30">
            {row.map((cell, cellIndex) => (
              <td 
                className={`px-4 py-3 ${cellIndex === 0 ? "truncate font-medium text-foreground" : "text-right text-muted-foreground"}`} 
                key={cellIndex}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
