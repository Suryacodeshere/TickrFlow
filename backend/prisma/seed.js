import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start seeding database...');

  // 1. Clean existing data
  await prisma.payment.deleteMany({});
  await prisma.bookingSeat.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.seat.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Cleaned existing database tables.');

  // 2. Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const organizer = await prisma.user.create({
    data: {
      name: 'Sarah (Organizer)',
      email: 'organizer@tickrflow.com',
      password: hashedPassword,
      role: 'ORGANIZER'
    }
  });

  const attendee = await prisma.user.create({
    data: {
      name: 'Surya (Attendee)',
      email: 'attendee@tickrflow.com',
      password: hashedPassword,
      role: 'ATTENDEE'
    }
  });

  console.log('👥 Created Users:');
  console.log(`   - Organizer: ${organizer.email} (password123)`);
  console.log(`   - Attendee: ${attendee.email} (password123)`);

  // 3. Create Event 1: Coldplay Live in Mumbai
  const coldplayDate = new Date();
  coldplayDate.setDate(coldplayDate.getDate() + 30); // 30 days from now

  const event1 = await prisma.event.create({
    data: {
      title: 'Coldplay Live: Music of the Spheres',
      description: 'Experience Coldplay live in Mumbai. An evening filled with lights, color, and stellar performances.',
      date: coldplayDate,
      location: 'D.Y. Patil Stadium, Mumbai',
      totalSeats: 40
    }
  });

  // Generate seats for Event 1: 5 rows (A-E) x 8 columns = 40 seats
  const rowsEvent1 = ['A', 'B', 'C', 'D', 'E'];
  const colsEvent1 = 8;
  const seatsEvent1 = [];

  for (const row of rowsEvent1) {
    let category = 'General';
    let price = 800;

    if (row === 'A' || row === 'B') {
      category = 'VIP';
      price = 1500;
    } else if (row === 'E') {
      category = 'Balcony';
      price = 500;
    }

    for (let col = 1; col <= colsEvent1; col++) {
      seatsEvent1.push({
        eventId: event1.id,
        row,
        number: col,
        category,
        price,
        status: 'AVAILABLE'
      });
    }
  }

  await prisma.seat.createMany({ data: seatsEvent1 });
  console.log(`🎤 Created Event: "${event1.title}" with 40 seats.`);

  // 4. Create Event 2: Boiler Room Techno Night
  const technoDate = new Date();
  technoDate.setDate(technoDate.getDate() + 15); // 15 days from now

  const event2 = await prisma.event.create({
    data: {
      title: 'Boiler Room: Techno Syndicate',
      description: 'An underground warehouse techno session featuring international underground producers and DJs.',
      date: technoDate,
      location: 'The Warehouse Project, Bangalore',
      totalSeats: 18
    }
  });

  // Generate seats for Event 2: 3 rows (A-C) x 6 columns = 18 seats
  const rowsEvent2 = ['A', 'B', 'C'];
  const colsEvent2 = 6;
  const seatsEvent2 = [];

  for (const row of rowsEvent2) {
    let category = 'General';
    let price = 600;

    if (row === 'A') {
      category = 'VIP';
      price = 1200;
    }

    for (let col = 1; col <= colsEvent2; col++) {
      seatsEvent2.push({
        eventId: event2.id,
        row,
        number: col,
        category,
        price,
        status: 'AVAILABLE'
      });
    }
  }

  await prisma.seat.createMany({ data: seatsEvent2 });
  console.log(`🎧 Created Event: "${event2.title}" with 18 seats.`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
