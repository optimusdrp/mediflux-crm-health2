import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';
import { Appointment } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');
  const date = searchParams.get('date');

  const db = getDatabase();
  let list = db.appointments.filter((a) => a.clinicId === auth.user!.clinicId);

  if (patientId) {
    list = list.filter((a) => a.patientId === patientId);
  }

  if (date) {
    list = list.filter((a) => a.date === date);
  }

  return NextResponse.json({ appointments: list });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { patientId, patientName, doctorName, specialty, date, time, procedure } = body;

    if (!patientId || !date || !time) {
      return NextResponse.json({ error: 'patientId, data e horário são obrigatórios.' }, { status: 400 });
    }

    const db = getDatabase();
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId: auth.user.clinicId,
      patientId,
      patientName: patientName || 'Paciente',
      doctorName: doctorName || 'Dr(a). Plantonista',
      specialty: specialty || 'Clínica Geral',
      date,
      time,
      procedure: procedure || 'Consulta Médica',
      status: 'agendado',
    };

    db.appointments.push(newAppointment);

    // Atualiza paciente para etapa 'agendado'
    const patient = db.getPatientById(patientId, auth.user.clinicId);
    if (patient) {
      patient.funnelStage = 'agendado';
    }

    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: auth.user.clinicId,
      action: 'AGENDAMENTO_CRIADO',
      target: `${newAppointment.id} (${newAppointment.patientName})`,
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { date, time, doctorName },
      lgpdCategory: 'alteracao_cadastral',
    });

    return NextResponse.json({ appointment: newAppointment });
  } catch (err) {
    console.error('Erro ao agendar consulta:', err);
    return NextResponse.json({ error: 'Erro ao criar agendamento.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const { id, status, ehrData } = body;

    const db = getDatabase();
    const appointment = db.appointments.find((a) => a.id === id && a.clinicId === auth.user!.clinicId);

    if (!appointment) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    if (status) appointment.status = status;
    if (ehrData) appointment.ehrData = { ...appointment.ehrData, ...ehrData };

    return NextResponse.json({ appointment });
  } catch (err) {
    console.error('Erro ao atualizar agendamento:', err);
    return NextResponse.json({ error: 'Erro ao atualizar agendamento.' }, { status: 500 });
  }
}
