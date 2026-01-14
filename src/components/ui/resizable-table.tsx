import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizableColumnConfig {
  id: string;
  label: string;
  minWidth?: number;
  defaultWidth?: number;
  align?: "left" | "center" | "right";
}

interface ResizableTableProps {
  columns: ResizableColumnConfig[];
  children: React.ReactNode;
  className?: string;
}

interface ResizableTableContextValue {
  columnWidths: Record<string, number>;
  handleResizeStart: (columnId: string, e: React.MouseEvent) => void;
  resizingColumn: string | null;
}

const ResizableTableContext = React.createContext<ResizableTableContextValue | null>(null);

export const ResizableTable = React.forwardRef<HTMLTableElement, ResizableTableProps>(
  ({ columns, children, className }, ref) => {
    const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
      const initial: Record<string, number> = {};
      columns.forEach((col) => {
        initial[col.id] = col.defaultWidth || 150;
      });
      return initial;
    });
    const [resizingColumn, setResizingColumn] = React.useState<string | null>(null);
    const startXRef = React.useRef(0);
    const startWidthRef = React.useRef(0);

    const handleResizeStart = React.useCallback((columnId: string, e: React.MouseEvent) => {
      e.preventDefault();
      setResizingColumn(columnId);
      startXRef.current = e.clientX;
      startWidthRef.current = columnWidths[columnId] || 150;
    }, [columnWidths]);

    React.useEffect(() => {
      if (!resizingColumn) return;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startXRef.current;
        const column = columns.find(c => c.id === resizingColumn);
        const minWidth = column?.minWidth || 50;
        const newWidth = Math.max(minWidth, startWidthRef.current + delta);
        
        setColumnWidths((prev) => ({
          ...prev,
          [resizingColumn]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        setResizingColumn(null);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [resizingColumn, columns]);

    const contextValue = React.useMemo(
      () => ({ columnWidths, handleResizeStart, resizingColumn }),
      [columnWidths, handleResizeStart, resizingColumn]
    );

    return (
      <ResizableTableContext.Provider value={contextValue}>
        <div className={cn("relative w-full overflow-auto", resizingColumn && "select-none")}>
          <table
            ref={ref}
            className={cn("w-full caption-bottom text-sm", className)}
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              {columns.map((col) => (
                <col key={col.id} style={{ width: columnWidths[col.id] }} />
              ))}
            </colgroup>
            {children}
          </table>
        </div>
      </ResizableTableContext.Provider>
    );
  }
);
ResizableTable.displayName = "ResizableTable";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
  resizable?: boolean;
}

export const ResizableTableHead = React.forwardRef<HTMLTableCellElement, ResizableTableHeadProps>(
  ({ className, columnId, resizable = true, children, ...props }, ref) => {
    const context = React.useContext(ResizableTableContext);
    
    if (!context) {
      throw new Error("ResizableTableHead must be used within a ResizableTable");
    }

    const { handleResizeStart, resizingColumn } = context;

    return (
      <th
        ref={ref}
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground relative group",
          "[&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      >
        <div className="truncate pr-2">{children}</div>
        {resizable && (
          <div
            className={cn(
              "absolute right-0 top-0 h-full w-1 cursor-col-resize",
              "hover:bg-primary/50 active:bg-primary",
              "transition-colors",
              resizingColumn === columnId && "bg-primary"
            )}
            onMouseDown={(e) => handleResizeStart(columnId, e)}
          />
        )}
      </th>
    );
  }
);
ResizableTableHead.displayName = "ResizableTableHead";

export const ResizableTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
ResizableTableHeader.displayName = "ResizableTableHeader";

export const ResizableTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
ResizableTableBody.displayName = "ResizableTableBody";

export const ResizableTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
      className
    )}
    {...props}
  />
));
ResizableTableRow.displayName = "ResizableTableRow";

export const ResizableTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0 truncate", className)}
    {...props}
  />
));
ResizableTableCell.displayName = "ResizableTableCell";
