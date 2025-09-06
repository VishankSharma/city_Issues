import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

import User from "./models/user.model.js";
import Department from "./models/department.model.js";
import Issue from "./models/issue.model.js";

dotenv.config();

// ================= MongoDB Connect =================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
};

// ================= Seed Script =================
const seed = async () => {
  try {
    await connectDB();

    // Clear old data
    await User.deleteMany();
    await Department.deleteMany();
    await Issue.deleteMany();
    console.log("🗑️ Old data cleared");

    // ================= Departments =================
    const deptNames = [
      "Sanitation",
      "Water Supply",
      "Roads & Transport",
      "Electricity",
      "Parks & Greenery",
    ];
    const departments = await Department.insertMany(
      deptNames.map((name) => ({ name }))
    );
    console.log(`🏢 Departments Created: ${departments.length}`);

    // ================= Users =================
    const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

    // Admin
    const admin = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: await bcrypt.hash("Admin@123", saltRounds),
      role: "ADMIN",
      isVerified: true,
    });

    // Staff
    const staff1 = await User.create({
      name: "Staff One",
      email: "staff1@test.com",
      password: await bcrypt.hash("Staff@123", saltRounds),
      role: "STAFF",
      department: departments[0]._id,
      isVerified: true,
    });

    const staff2 = await User.create({
      name: "Staff Two",
      email: "staff2@test.com",
      password: await bcrypt.hash("Staff@123", saltRounds),
      role: "STAFF",
      department: departments[1]._id,
      isVerified: true,
    });

    console.log("👨‍💼 Admin & Staff Created");

    // Citizens
    const citizensData = [];
    for (let i = 1; i <= 22; i++) {
      citizensData.push({
        name: `Citizen ${i}`,
        email: `citizen${i}@test.com`,
        password: await bcrypt.hash("Citizen@123", saltRounds),
        role: "CITIZEN",
        isVerified: true,
      });
    }
    const citizens = await User.insertMany(citizensData);
    console.log(`👨‍👩‍👧 Citizens Created: ${citizens.length}`);

    // ================= Issues =================
    const categories = ["POTHOLE", "STREETLIGHT", "GARBAGE", "WATER", "OTHER"];
    const sampleAddresses = [
      "Main Road, City Center",
      "Park Street, Sector 5",
      "Near Water Tank, Sector 9",
      "Green Park Colony",
      "Bus Stand Road, Sector 3",
    ];

    const issuesData = [];
    for (let i = 0; i < 30; i++) {
      const citizen = citizens[i % citizens.length];
      issuesData.push({
        title: `Issue ${i + 1} reported by ${citizen.name}`,
        description: `This is a detailed description for issue ${
          i + 1
        }, reported by ${citizen.name}.`,
        category: categories[i % categories.length],
        media: [
          {
            type: "IMAGE",
            public_id: `sample_public_id_${i}`,
            secure_url: `https://placehold.co/600x400?text=Issue+${i + 1}`,
          },
        ],
        address: sampleAddresses[i % sampleAddresses.length],
        location: {
          type: "Point",
          coordinates: [77.2 + i * 0.01, 28.6 + i * 0.01],
        },
        createdBy: citizen._id,
        department: departments[i % departments.length]._id,
        status: "PENDING",
        priority: i % 2 === 0 ? "LOW" : "MEDIUM",
      });
    }

   const issues = await Issue.insertMany(issuesData);

// Link issues back to citizens
for (const issue of issues) {
  await User.findByIdAndUpdate(issue.createdBy, {
    $push: { issues: issue._id },
  });
}

console.log(`📌 Issues Created & Linked to Citizens: ${issues.length}`);

    console.log("✅ Database Seeded Successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error Seeding:", error);
    process.exit(1);
  }
};

seed();
