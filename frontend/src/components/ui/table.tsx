import React from 'react';
import { cn } from '@/lib/utils';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

const Table: React.FC<TableProps> = ({ children, className, ...props }) => {
  return (
    <div className="w-full overflow-x-auto [background:linear-gradient(to_right,hsl(var(--background))_30%,transparent)_0_0/40px_100%_no-repeat,linear-gradient(to_left,hsl(var(--background))_30%,transparent)_100%_0/40px_100%_no-repeat] [background-attachment:local,local]">
      <table className={`w-full border-collapse text-left ${className || ''}`} {...props}>
        {children}
      </table>
    </div>
  );
};

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

const TableHeader: React.FC<TableHeaderProps> = ({ children, className, ...props }) => {
  return (
    <thead className={`bg-slate-100 text-slate-700 font-semibold ${className || ''}`} {...props}>
      {children}
    </thead>
  );
};

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

const TableBody: React.FC<TableBodyProps> = ({ children, className, ...props }) => {
  return (
    <tbody className={`divide-y divide-slate-200 ${className || ''}`} {...props}>
      {children}
    </tbody>
  );
};

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
}

const TableRow: React.FC<TableRowProps> = ({ children, className, ...props }) => {
  return (
    <tr className={`border-b border-slate-200 ${className || ''}`} {...props}>
      {children}
    </tr>
  );
};

interface TableHeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

const TableHead: React.FC<TableHeadProps> = ({ children, className, ...props }) => {
  return (
    <th className={cn('px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  );
};

interface TableCellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  colSpan?: number;
}

const TableCell: React.FC<TableCellProps> = ({ children, className, colSpan, ...props }) => {
  return (
    <td
      className={cn('px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap', className)}
      colSpan={colSpan}
      {...props}
    >
      {children}
    </td>
  );
};

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  children: React.ReactNode;
}

const TableCaption: React.FC<TableCaptionProps> = ({ children, className, ...props }) => {
  return (
    <caption className={`caption-bottom mt-4 text-sm text-gray-500 ${className || ''}`} {...props}>
      {children}
    </caption>
  );
};

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
