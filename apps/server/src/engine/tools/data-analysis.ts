import { readFileSync } from 'fs';
import Database from 'better-sqlite3';
import type { Tool, ToolInput, ToolOutput, ToolDefinition, ToolContext } from './types.js';

export class DataAnalysisTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'data_analysis',
    description:
      'Analyze data from CSV, JSON files, or SQLite databases. Can parse, query, summarize, and generate chart specifications.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['parse_csv', 'parse_json', 'query_sqlite', 'summarize', 'chart'],
          description: 'The analysis action to perform',
        },
        filePath: { type: 'string', description: 'Path to the data file' },
        query: { type: 'string', description: 'SQL query (for query_sqlite action)' },
        column: { type: 'string', description: 'Column name for summarize action' },
        chartType: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'scatter'],
          description: 'Chart type for chart action',
        },
        xColumn: { type: 'string', description: 'X-axis column for chart' },
        yColumn: { type: 'string', description: 'Y-axis column for chart' },
        limit: { type: 'number', description: 'Max rows to return (default 100)' },
      },
      required: ['action'],
    },
  };

  async execute(input: ToolInput, _ctx?: ToolContext): Promise<ToolOutput> {
    const action = input['action'] as string;
    const filePath = input['filePath'] as string | undefined;
    const limit = (input['limit'] as number) || 100;

    try {
      switch (action) {
        case 'parse_csv': {
          if (!filePath) return { success: false, error: 'filePath required for parse_csv' };
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          if (lines.length === 0) return { success: true, result: 'Empty file' };
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const rows = lines.slice(1, limit + 1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
            return row;
          });
          return {
            success: true,
            result: {
              type: 'csv',
              headers,
              rowCount: lines.length - 1,
              sample: rows,
              showing: Math.min(limit, lines.length - 1),
            },
          };
        }

        case 'parse_json': {
          if (!filePath) return { success: false, error: 'filePath required for parse_json' };
          const content = readFileSync(filePath, 'utf-8');
          const data: unknown = JSON.parse(content);
          const isArray = Array.isArray(data);
          const sample = isArray ? (data as unknown[]).slice(0, limit) : data;
          const length = isArray
            ? (data as unknown[]).length
            : Object.keys(data as Record<string, unknown>).length;
          const keys =
            isArray && (data as unknown[]).length > 0
              ? Object.keys((data as Record<string, unknown>[])[0])
              : Object.keys(data as Record<string, unknown>);
          return {
            success: true,
            result: {
              type: 'json',
              isArray,
              length,
              keys,
              sample,
              showing: isArray ? Math.min(limit, (data as unknown[]).length) : 'full',
            },
          };
        }

        case 'query_sqlite': {
          const dbPath = filePath || ':memory:';
          const query = input['query'] as string;
          if (!query) return { success: false, error: 'query required for query_sqlite' };
          try {
            const db = new Database(dbPath, { readonly: true });
            const isSelect = query.trim().toLowerCase().startsWith('select');
            if (isSelect) {
              const rows = db.prepare(query).all() as Record<string, unknown>[];
              db.close();
              return {
                success: true,
                result: {
                  type: 'query_result',
                  rowCount: rows.length,
                  columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                  rows: rows.slice(0, limit),
                },
              };
            } else {
              db.close();
              return { success: false, error: 'Only SELECT queries allowed in read-only mode' };
            }
          } catch (e) {
            return { success: false, error: `SQL Error: ${(e as Error).message}` };
          }
        }

        case 'summarize': {
          if (!filePath) return { success: false, error: 'filePath required for summarize' };
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const targetCol = (input['column'] as string) || headers[0];
          const colIdx = headers.indexOf(targetCol);
          if (colIdx === -1) {
            return {
              success: false,
              error: `Column "${targetCol}" not found. Available: ${headers.join(', ')}`,
            };
          }

          const values = lines
            .slice(1)
            .map(l => l.split(',')[colIdx]?.trim().replace(/^"|"$/g, ''))
            .filter((v): v is string => Boolean(v));

          const numValues = values.map(Number).filter(n => !isNaN(n));
          const isNumeric = numValues.length > values.length * 0.5;

          if (isNumeric) {
            const sorted = [...numValues].sort((a, b) => a - b);
            const sum = numValues.reduce((a, b) => a + b, 0);
            return {
              success: true,
              result: {
                column: targetCol,
                type: 'numeric',
                count: numValues.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                mean: +(sum / numValues.length).toFixed(2),
                median: sorted[Math.floor(sorted.length / 2)],
                sum: +sum.toFixed(2),
                nullCount: values.length - numValues.length,
              },
            };
          }

          // Categorical
          const freq: Record<string, number> = {};
          values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
          const topValues = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
          return {
            success: true,
            result: {
              column: targetCol,
              type: 'categorical',
              count: values.length,
              unique: Object.keys(freq).length,
              top: topValues.map(([value, count]) => ({ value, count })),
              nullCount: lines.length - 1 - values.length,
            },
          };
        }

        case 'chart': {
          if (!filePath) return { success: false, error: 'filePath required for chart' };
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const chartType = (input['chartType'] as string) || 'bar';
          const xCol = (input['xColumn'] as string) || headers[0];
          const yCol = (input['yColumn'] as string) || headers[1];

          const data = lines.slice(1, 21).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            return {
              x: vals[headers.indexOf(xCol)] || '',
              y: parseFloat(vals[headers.indexOf(yCol)] ?? '0') || 0,
            };
          });

          return {
            success: true,
            result: {
              type: 'chart_spec',
              chartType,
              title: `${yCol} by ${xCol}`,
              xAxis: xCol,
              yAxis: yCol,
              data,
              suggestion:
                'To render this chart, create an HTML file with an SVG or use a charting library.',
            },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown action: ${action}. Available: parse_csv, parse_json, query_sqlite, summarize, chart`,
          };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
