const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// Helper: generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" } // short-lived
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // long-lived
  );

  return { accessToken, refreshToken };
};

// Helper: cookie options
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // lax for development
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// User signup
const userSignUp = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password, username } =
    req.body;

  if (
    !firstName ||
    !lastName ||
    !email ||
    !phoneNumber ||
    !password ||
    !username
  ) {
    res.status(400);
    throw new Error("Please fill in all fields");
  }

  // Check if user already exists
  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      firstName,
      lastName,
      username,
      email,
      phoneNumber,
      password: hashedPassword,
    },
  });

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    username: newUser.username,
  });
});

// User login
const userSignIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("All fields are mandatory");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401);
    throw new Error("Email or Password not valid");
  }

  // Clean up any existing sessions for this user (optional)
  await prisma.session.deleteMany({
    where: { userId: user.id },
  });

  const { accessToken, refreshToken } = generateTokens(user);

  // Save session
  await prisma.session.create({
    data: {
      userId: user.id,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Set refresh token in HttpOnly cookie
  res.cookie("refreshToken", refreshToken, getCookieOptions());

  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
});

// Refresh token endpoint
// Add this temporarily to your refresh endpoint to debug the issue

// Refresh token endpoint with debug logging
const refreshAccessToken = asyncHandler(async (req, res) => {
  //console.log("=== REFRESH TOKEN DEBUG ===");
  //console.log("Cookies received:", req.cookies);
  //console.log("Headers:", req.headers);

  const refreshToken = req.cookies?.refreshToken;
  // console.log("Extracted refreshToken:", refreshToken ? "EXISTS" : "NULL");

  if (!refreshToken) {
    //console.log("❌ No refresh token found in cookies");
    return res.status(401).json({ error: "No refresh token found" });
  }

  //  console.log("🔍 Looking for session in database...");
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  //  console.log("Session found:", session ? "YES" : "NO");

  if (!session) {
    // console.log("❌ No session found for this refresh token");
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  //console.log("Session expires at:", session.refreshExpiresAt);
  //console.log("Current time:", new Date());
  //console.log("Is expired:", new Date() > session.refreshExpiresAt);

  if (new Date() > session.refreshExpiresAt) {
    console.log("❌ Refresh token expired, cleaning up...");
    await prisma.session.delete({ where: { id: session.id } });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(401).json({ error: "Refresh token expired" });
  }

  try {
    console.log("🔐 Verifying JWT signature...");
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log("✅ JWT signature valid");

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      session.user
    );
    console.log("🔄 Generated new tokens");

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log("💾 Updated session in database");

    // Set new refresh token cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    console.log("🍪 Setting new cookie with options:", cookieOptions);
    res.cookie("refreshToken", newRefreshToken, cookieOptions);

    console.log("✅ Refresh successful");
    return res.json({ accessToken });
  } catch (err) {
    console.error("❌ JWT verify failed:", err.message);
    await prisma.session.delete({ where: { id: session.id } });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

// Current user (requires middleware to decode access token)
const currentUser = asyncHandler(async (req, res) => {
  // req.user should be set by your auth middleware
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  res.json(req.user);
});

// User signout
const userSignout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    // Delete session from DB
    await prisma.session.deleteMany({
      where: { refreshToken },
    });
  }

  // Clear refresh token cookie (do this regardless of whether token exists)
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/", // ensure we're clearing the right cookie
  });

  res.status(200).json({ message: "Signed out successfully" });
});

// Optional: Check if refresh token exists and is valid
const checkRefreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ hasValidRefreshToken: false });
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken },
  });

  if (!session || new Date() > session.refreshExpiresAt) {
    return res.status(401).json({ hasValidRefreshToken: false });
  }

  try {
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    return res.json({ hasValidRefreshToken: true });
  } catch {
    return res.status(401).json({ hasValidRefreshToken: false });
  }
});

module.exports = {
  userSignUp,
  userSignIn,
  refreshAccessToken,
  currentUser,
  userSignout,
  checkRefreshToken,
};
