const prisma = require("../lib/prisma");
const asyncHandler = require("express-async-handler");
const { getCurrentUser } = require("./authcontrollers");

// Get all users
const getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany();
  res.status(200).json(users);
});

// Search users by query
const getUserBySearch = asyncHandler(async (req, res) => {
  const { search } = req.query;

  if (!search || search.trim() === "") {
    return res.status(400).json({ message: "Search query is required" });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    take: 25, // limit results to avoid huge payloads
  });

  res.status(200).json(users);
});

module.exports = { getUsers, getUserBySearch };
