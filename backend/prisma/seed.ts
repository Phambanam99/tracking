import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create demo admin user
  const hashedPassword = await bcrypt.hash('password', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@tracking.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  // Create demo operator user
  const operatorUser = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      username: 'operator',
      email: 'operator@tracking.com',
      password: hashedPassword,
      role: 'OPERATOR',
    },
  });

  // Create demo viewer user
  const viewerUser = await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {},
    create: {
      username: 'viewer',
      email: 'viewer@tracking.com',
      password: hashedPassword,
      role: 'VIEWER',
    },
  });

  // Create sample aircraft
  const aircraft1 = await prisma.aircraft.upsert({
    where: { flightId: 'VN123' },
    update: {},
    create: {
      flightId: 'VN123',
      callSign: 'VNA123',
      registration: 'VN-A123',
      aircraftType: 'A320',
      operator: 'Vietnam Airlines',
    },
  });

  // Add position for aircraft
  await prisma.aircraftPosition.create({
    data: {
      aircraftId: aircraft1.id,
      latitude: 21.0285,
      longitude: 105.8542,
      altitude: 35000,
      speed: 450,
      heading: 90,
      timestamp: new Date(),
    },
  });

  // Create sample vessel
  const vessel1 = await prisma.vessel.upsert({
    where: { mmsi: '123456789' },
    update: {},
    create: {
      mmsi: '123456789',
      vesselName: 'Cargo Ship 1',
      vesselType: 'Cargo',
      flag: 'Vietnam',
      operator: 'Vietnam Shipping',
      length: 200,
      width: 30,
    },
  });

  // Add position for vessel
  await prisma.vesselPosition.create({
    data: {
      vesselId: vessel1.id,
      latitude: 20.8648,
      longitude: 106.6998,
      speed: 15,
      course: 180,
      heading: 180,
      status: 'Under way using engine',
      timestamp: new Date(),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
