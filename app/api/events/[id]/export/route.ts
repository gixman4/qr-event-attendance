import { getDb } from '@/lib/db';
import ExcelJS from 'exceljs';

// GET /api/events/[id]/export — download attendees as Excel
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const eventResult = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id],
  });

  if (eventResult.rows.length === 0) {
    return Response.json({ error: 'Event not found.' }, { status: 404 });
  }

  const event = eventResult.rows[0] as unknown as { id: string; name: string; date: string; created_at: string };

  const attendeesResult = await db.execute({
    sql: 'SELECT * FROM attendees WHERE event_id = ? ORDER BY registered_at ASC',
    args: [id],
  });

  const attendees = attendeesResult.rows as unknown as Array<{
    id: string; event_id: string; first_name: string; last_name: string; registered_at: string;
  }>;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendees');

  sheet.columns = [
    { header: '#',             key: 'num',           width: 6  },
    { header: 'First Name',    key: 'first_name',    width: 20 },
    { header: 'Last Name',     key: 'last_name',     width: 20 },
    { header: 'Registered At', key: 'registered_at', width: 24 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  attendees.forEach((a, i) => {
    sheet.addRow({
      num:           i + 1,
      first_name:    a.first_name,
      last_name:     a.last_name,
      registered_at: a.registered_at,
    });
  });

  sheet.spliceRows(1, 0, [`Event: ${event.name}`], [`Date: ${event.date}`], []);
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(2).font = { italic: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = String(event.name).replace(/[^a-z0-9]/gi, '_').toLowerCase();

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_attendees.xlsx"`,
    },
  });
}
