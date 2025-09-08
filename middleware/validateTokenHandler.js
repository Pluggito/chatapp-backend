const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const validateTokenHandler = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("No token provided or invalid format");
  }

  const token = authHeader.split(" ")[1];

  try {
    // Decode access token
     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Check session by accessToken
    const session = await prisma.session.findUnique({
      where: { accessToken: token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      res.status(401);
      throw new Error("Session expired or revoked");
    }

    // Attach full user to req for convenience
    req.user = {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    };

    next();
  } catch (err) {
    res.status(401);
    throw new Error("Invalid or expired token");
  }
});

module.exports = validateTokenHandler;
