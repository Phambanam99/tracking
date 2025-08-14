import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

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
  console.log('✅ Admin user created:', adminUser.username);

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
  console.log('✅ Operator user created:', operatorUser.username);

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
  console.log('✅ Viewer user created:', viewerUser.username);

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

  // Seed a demo vessel and its historical track from prisma/track.json
  // The track.json appears to store Web Mercator meters mislabeled as LATITUDE (x) and LONGITUDE (y)
  // We convert from EPSG:3857 to WGS84 lat/lon.
  const webMercatorToWGS84 = (xMeters: number, yMeters: number): { lat: number; lon: number } => {
    const originShift = 20037508.34; // meters
    const lon = (xMeters / originShift) * 180;
    let lat = (yMeters / originShift) * 180;
    lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    return { lat, lon };
  };

  const trackFilePath = path.resolve(__dirname, 'track.json');
  if (fs.existsSync(trackFilePath)) {
    const raw = fs.readFileSync(trackFilePath, 'utf8');
    try {
      const json = JSON.parse(raw) as {
        track?: Array<{
          LATITUDE: number; // actually X in meters
          LONGITUDE: number; // actually Y in meters
          PORT?: string;
          COURSE?: number;
          SPEED?: number;
          TSTAMP?: number; // unix seconds
          DRAUGHT?: number;
        }>;
      };

      const points = Array.isArray(json.track) ? json.track : [];
      if (points.length > 0) {
        const demoVessel = await prisma.vessel.upsert({
          where: { mmsi: '999000111' },
          update: {},
          create: {
            mmsi: '999000111',
            vesselName: 'Demo Track Vessel',
            vesselType: 'Cargo',
            flag: 'VN',
            operator: 'Demo Line',
            length: 180,
            width: 28,
          },
        });

        // Clean old positions if reseeding
        await prisma.vesselPosition.deleteMany({
          where: { vesselId: demoVessel.id },
        });

        // Compute timestamp shift so the last point aligns with now
        const unixTimestamps = points
          .map((p) => (typeof p.TSTAMP === 'number' ? p.TSTAMP : undefined))
          .filter((v): v is number => typeof v === 'number');
        const maxTs = unixTimestamps.length > 0 ? Math.max(...unixTimestamps) : undefined;
        const shiftMs = maxTs ? Date.now() - maxTs * 1000 : 0;

        // Map and batch insert positions to avoid enormous single payloads
        const batchSize = 1000;
        let batch: {
          vesselId: number;
          latitude: number;
          longitude: number;
          speed?: number | null;
          course?: number | null;
          heading?: number | null;
          status?: string | null;
          timestamp: Date;
        }[] = [];

        for (const p of points) {
          // Interpret LONGITUDE as X meters (eastings) and LATITUDE as Y meters (northings)
          const { lat, lon } = webMercatorToWGS84(p.LONGITUDE, p.LATITUDE);
          const speed = typeof p.SPEED === 'number' ? p.SPEED : null;
          const course = typeof p.COURSE === 'number' ? Math.round(p.COURSE) : null;
          const timestamp =
            typeof p.TSTAMP === 'number' ? new Date(p.TSTAMP * 1000 + shiftMs) : new Date();

          batch.push({
            vesselId: demoVessel.id,
            latitude: lat,
            longitude: lon,
            speed,
            course,
            heading: course,
            status: speed && speed > 0 ? 'Under way using engine' : 'Moored',
            timestamp,
          });

          if (batch.length >= batchSize) {
            await prisma.vesselPosition.createMany({ data: batch });
            batch = [];
          }
        }
        if (batch.length > 0) {
          await prisma.vesselPosition.createMany({ data: batch });
        }
      }
    } catch (err) {
      console.warn('Failed to parse prisma/track.json; skipping track seed.', err);
    }
  }

  // Massive synthetic dataset for performance testing
  // Controlled via env; defaults to 200k each as requested

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
