import { PrismaClient, ForumType } from '../prisma/generated';

const prisma = new PrismaClient();

async function main(): Promise<void> {
    console.log("🚀 Seeding forums...");

    // 1️⃣ GENERAL forum
    const generalForum = await prisma.forum.findFirst({
        where: { type: ForumType.GENERAL }
    });

    if (!generalForum) {
        await prisma.forum.create({
            data: { type: ForumType.GENERAL }
        });
    }

    // 2️⃣ MATCH forum
    const matchForum = await prisma.forum.findFirst({
        where: { type: ForumType.MATCH }
    });

    if (!matchForum) {
        await prisma.forum.create({
            data: { type: ForumType.MATCH }
        });
    }

    console.log("✅ General and Match forums ensured.");

    // 3️⃣ TEAM forums (one per team)
    const teams = await prisma.team.findMany();

    for (const team of teams) {
        const teamForum = await prisma.forum.findFirst({
            where: { type: ForumType.TEAM, teamName: team.name }
        });

        if (!teamForum) {
            await prisma.forum.create({
                data: { type: ForumType.TEAM, teamName: team.name }
            });
        }
    }

    console.log(`✅ Created/verified ${teams.length} team forums.`);
}

main()
    .catch((e: Error) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });