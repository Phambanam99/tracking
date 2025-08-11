import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

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
  const targetAircraft = Number(process.env.SEED_AIRCRAFT_COUNT || 200_000);
  const targetVessels = Number(process.env.SEED_VESSEL_COUNT || 200_000);
  const doHeavySeed = (process.env.SEED_HEAVY || 'true').toLowerCase() !== 'false';

  if (doHeavySeed) {
    const batchSize = 5_000;

    // Helpers
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const pad = (num: number, len: number) => num.toString().padStart(len, '0');

    // Aircrafts
    const existingAircraft = await prisma.aircraft.count();
    const needAircraft = Math.max(0, targetAircraft - existingAircraft);
    if (needAircraft > 0) {
      console.log(`Seeding aircrafts: need ${needAircraft} (existing=${existingAircraft})`);
      for (let offset = 0; offset < needAircraft; offset += batchSize) {
        const size = Math.min(batchSize, needAircraft - offset);
        const startIndex = existingAircraft + offset + 1;
        const data = Array.from({ length: size }, (_, i) => {
          const n = startIndex + i;
          return {
            flightId: `FL${pad(n, 7)}`,
            callSign: `CS${pad(n, 6)}`,
            registration: `REG-${pad(n % 999999, 6)}`,
            aircraftType: ['A320', 'A321', 'B737', 'B787', 'A350'][n % 5],
            operator: ['Vietnam Airlines', 'Bamboo', 'VietJet', 'Jetstar', 'AirAsia'][n % 5],
          } as const;
        });
        await prisma.aircraft.createMany({ data, skipDuplicates: true });

        // Insert one current position for each (for map rendering)
        const ids = await prisma.aircraft.findMany({
          where: { flightId: { in: data.map((d) => d.flightId) } },
          select: { id: true, flightId: true },
        });
        const idMap = new Map(ids.map((x) => [x.flightId, x.id] as const));
        const posBatch = data.map((d) => ({
          aircraftId: idMap.get(d.flightId)!,
          latitude: randomInRange(-70, 70),
          longitude: randomInRange(-179, 179),
          altitude: Math.round(randomInRange(0, 40000)),
          speed: Math.round(randomInRange(200, 520)),
          heading: Math.round(randomInRange(0, 359)),
          timestamp: new Date(),
        }));
        await prisma.aircraftPosition.createMany({ data: posBatch });
        console.log(`  Inserted aircraft batch ${offset + size}/${needAircraft}`);
      }
    } else {
      console.log('Aircraft dataset already satisfies target; skipping aircraft seed.');
    }

    // Vessels
    const existingVessel = await prisma.vessel.count();
    const needVessel = Math.max(0, targetVessels - existingVessel);
    if (needVessel > 0) {
      console.log(`Seeding vessels: need ${needVessel} (existing=${existingVessel})`);
      for (let offset = 0; offset < needVessel; offset += batchSize) {
        const size = Math.min(batchSize, needVessel - offset);
        const startIndex = existingVessel + offset + 1;
        const data = Array.from({ length: size }, (_, i) => {
          const n = startIndex + i;
          const mmsi = (100_000_000 + (n % 900_000_000)).toString();
          return {
            mmsi,
            vesselName: `Vessel-${pad(n, 7)}`,
            vesselType: ['Cargo', 'Tanker', 'Passenger', 'Fishing', 'Tug'][n % 5],
            flag: ['VN', 'SG', 'MY', 'TH', 'PH'][n % 5],
            operator: ['OpA', 'OpB', 'OpC', 'OpD', 'OpE'][n % 5],
            length: Math.round(randomInRange(60, 320)),
            width: Math.round(randomInRange(10, 50)),
          } as const;
        });
        await prisma.vessel.createMany({ data, skipDuplicates: true });

        // Positions
        const ids = await prisma.vessel.findMany({
          where: { mmsi: { in: data.map((d) => d.mmsi) } },
          select: { id: true, mmsi: true },
        });
        const idMap = new Map(ids.map((x) => [x.mmsi, x.id] as const));
        const posBatch = data.map((d) => ({
          vesselId: idMap.get(d.mmsi)!,
          latitude: randomInRange(-70, 70),
          longitude: randomInRange(-179, 179),
          speed: Math.round(randomInRange(0, 25)),
          course: Math.round(randomInRange(0, 359)),
          heading: Math.round(randomInRange(0, 359)),
          status: 'Under way using engine',
          timestamp: new Date(),
        }));
        await prisma.vesselPosition.createMany({ data: posBatch });
        console.log(`  Inserted vessel batch ${offset + size}/${needVessel}`);
      }
    } else {
      console.log('Vessel dataset already satisfies target; skipping vessel seed.');
    }
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
