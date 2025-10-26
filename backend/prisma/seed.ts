import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Deleting all data except admin account...');

  // Delete data in order to respect foreign key constraints
  await prisma.aircraftImage.deleteMany();
  await prisma.vesselImage.deleteMany();
  await prisma.aircraftPosition.deleteMany();
  await prisma.vesselPosition.deleteMany();
  await prisma.aisVesselHistory.deleteMany();
  await prisma.aisVesselLatest.deleteMany();
  await prisma.regionObjectHistory.deleteMany();
  await prisma.regionAlert.deleteMany();
  await prisma.userTrackedAircraft.deleteMany();
  await prisma.userTrackedVessel.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userFilters.deleteMany();
  await prisma.region.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.vessel.deleteMany();

  // Delete non-admin users
  await prisma.user.deleteMany({
    where: {
      NOT: {
        username: 'admin',
      },
    },
  });

  console.log('✅ All data deleted except admin account');

  // Create/recreate demo admin user
  const hashedPassword = await bcrypt.hash('password', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@tracking.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created/updated');

  // Seed system settings with default values
  const defaultSystemSettings = await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      clusterEnabled: true,
      minZoom: 4,
      maxZoom: 16,
      signalStaleMinutes: 10,
      vesselFlagColors: {
        VN: '#06b6d4',
        US: '#2563eb',
        CN: '#ef4444',
        JP: '#f59e0b',
        KR: '#10b981',
      },
      aircraftOperatorColors: {
        'VIETNAM AIRLINES': '#2563eb',
        'VIETJET AIR': '#ef4444',
        'BAMBOO AIRWAYS': '#10b981',
        EMIRATES: '#b91c1c',
        'SINGAPORE AIRLINES': '#f59e0b',
      },
    },
  });

  console.log('✅ System settings seeded:', defaultSystemSettings);

  // Seed ports from ports.json if not already imported (basic heuristic)
  // Use raw query to avoid type mismatch if client not regenerated
  const existingPortsRows = (await prisma.$queryRawUnsafe<any[]>(
    'SELECT COUNT(*)::int AS count FROM "ports"',
  )) as Array<{ count: number }>;
  const existingPorts = existingPortsRows?.[0]?.count || 0;
  if (existingPorts === 0) {
    try {
      const portsPath = path.resolve(__dirname, 'ports.json');
      const raw = fs.readFileSync(portsPath, 'utf8');
      const ports = JSON.parse(raw) as Array<{
        CITY: string;
        STATE?: string;
        COUNTRY?: string;
        LATITUDE: number;
        LONGITUDE: number;
      }>;
      // Batch insert to avoid huge payloads
      const batchSize = 2000;
      for (let i = 0; i < ports.length; i += batchSize) {
        const slice = ports.slice(i, i + batchSize);
        // Bulk insert via raw SQL for performance and compatibility
        // Insert via simple loop to keep code straightforward and avoid parameter index gymnastics
        for (const p of slice) {
          await prisma.$executeRawUnsafe(
            'INSERT INTO "ports" (city, state, country, latitude, longitude) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            p.CITY,
            p.STATE || null,
            p.COUNTRY || null,
            p.LATITUDE,
            p.LONGITUDE,
          );
        }
        console.log(`Inserted ports: ${Math.min(i + batchSize, ports.length)}/${ports.length}`);
      }
      console.log('✅ Ports seeded');
    } catch (e) {
      console.warn('⚠️ Failed to seed ports.json', e);
    }
  } else {
    console.log(`ℹ️ Ports already seeded: ${existingPorts}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
