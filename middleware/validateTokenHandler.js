const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const validateTokenHandler = asyncHandler(async (req, res, next) => {
  console.log("=".repeat(60));
  console.log("🔐 VALIDATE TOKEN HANDLER");
  console.log("=".repeat(60));
  console.log("1️⃣ Request Path:", req.path);
  console.log("2️⃣ Request Method:", req.method);
  console.log("3️⃣ Authorization Header:", req.headers.authorization);
  console.log("4️⃣ All Headers:", JSON.stringify(req.headers, null, 2));
  
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ No auth header or invalid format");
    console.log("=".repeat(60));
    res.status(401);
    throw new Error("No token provided or invalid format");
  }

  const token = authHeader.split(" ")[1];
  console.log("5️⃣ Extracted Token:", token);
  console.log("6️⃣ Token Length:", token?.length);
  console.log("7️⃣ Token Preview:", token?.substring(0, 30) + "...");

  try {
    // Decode access token
    console.log("8️⃣ Verifying token with JWT...");
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("✅ JWT verification successful");
    console.log("9️⃣ Decoded token:", decoded);

    // Check session by accessToken
    console.log("🔟 Looking up session in database...");
    const session = await prisma.session.findUnique({
      where: { accessToken: token },
      include: { user: true },
    });

    console.log("1️⃣1️⃣ Session found:", !!session);
    if (session) {
      console.log("1️⃣2️⃣ Session expires at:", session.expiresAt);
      console.log("1️⃣3️⃣ Current time:", new Date());
      console.log("1️⃣4️⃣ Is expired:", session.expiresAt < new Date());
      console.log("1️⃣5️⃣ Session user:", session.user);
    }

    if (!session) {
      console.log("❌ No session found in database for this token");
      console.log("=".repeat(60));
      res.status(401);
      throw new Error("Session not found");
    }

    if (session.expiresAt < new Date()) {
      console.log("❌ Session expired");
      console.log("=".repeat(60));
      res.status(401);
      throw new Error("Session expired");
    }

    // Attach full user to req for convenience
    req.user = {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    };

    console.log("✅ Token validation successful");
    console.log("1️⃣6️⃣ Attached user to request:", req.user);
    console.log("=".repeat(60));

    next();
  } catch (err) {
    console.log("❌ Token validation failed");
    console.log("1️⃣7️⃣ Error:", err.message);
    console.log("1️⃣8️⃣ Error stack:", err.stack);
    console.log("=".repeat(60));
    res.status(401);
    throw new Error("Invalid or expired token");
  }
});

module.exports = validateTokenHandler;