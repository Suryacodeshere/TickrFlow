import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'tickrflow-secret-jwt-token-key';

export async function signup(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if role is valid
    const userRole = role === 'ORGANIZER' ? 'ORGANIZER' : 'ATTENDEE';

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function googleLogin(req, res) {
  try {
    const { token, email, name, isMock } = req.body;
    let userEmail = email;
    let userName = name;

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

    if (GOOGLE_CLIENT_ID && !isMock) {
      if (!token) {
        return res.status(400).json({ error: 'Google ID token is required' });
      }

      // Verify Google ID token using Google TokenInfo endpoint (built-in, zero dependencies)
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;
      const verifyRes = await fetch(verifyUrl);
      const payload = await verifyRes.json();

      if (!verifyRes.ok) {
        return res.status(400).json({ error: 'Failed to verify Google ID token' });
      }

      if (payload.aud !== GOOGLE_CLIENT_ID) {
        return res.status(400).json({ error: 'Google ID token client audience mismatch' });
      }

      userEmail = payload.email;
      userName = payload.name;
    } else {
      // Mock Login Mode
      if (!userEmail) {
        return res.status(400).json({ error: 'Email is required for mock Google login' });
      }
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      // Generate dummy password for external auth accounts
      const dummyRawPassword = Math.random().toString(36).slice(-8) + Date.now().toString();
      const hashedPassword = await bcrypt.hash(dummyRawPassword, 10);

      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName || userEmail.split('@')[0],
          password: hashedPassword,
          role: 'ATTENDEE'
        }
      });
      console.log(`👤 Registered new Google user: ${userEmail}`);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Google login controller error:', error);
    res.status(500).json({ error: 'Failed to complete Google authentication' });
  }
}
